import Stripe from "stripe";
import type { Request, Response, NextFunction } from "express";
import { db, type UserRow } from "./db.js";
import { accessFor, parseCompEmails, type Access, type BillingConfig } from "./access.js";

const key = process.env.STRIPE_SECRET_KEY ?? "";

/**
 * Stripe is optional. With no key and price set, billing is OFF: the app is
 * free for every account and no trial ever expires, since there would be
 * nothing to subscribe to.
 */
export const stripe = key ? new Stripe(key) : null;

export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";

export const BILLING: BillingConfig = {
  enabled: Boolean(stripe && PRICE_ID),
  // Accounts that stay free even once billing is switched on.
  compEmails: parseCompEmails(process.env.COMP_EMAILS),
};

export type { Access };

export function checkAccess(user: UserRow): Access {
  return accessFor(user, BILLING);
}

/** Blocks the working parts of the app once trial and subscription are both gone. */
export function requireAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  if (!checkAccess(req.user).allowed) {
    res.redirect("/billing");
    return;
  }
  next();
}

export async function ensureCustomer(user: UserRow): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");
  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { user_id: String(user.id) },
  });
  db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(
    customer.id,
    user.id
  );
  return customer.id;
}

export async function createCheckoutSession(
  user: UserRow,
  origin: string
): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");
  if (!PRICE_ID) throw new Error("STRIPE_PRICE_ID is not set");

  const customerId = await ensureCustomer(user);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: `${origin}/billing?checkout=success`,
    cancel_url: `${origin}/billing?checkout=canceled`,
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: String(user.id) } },
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

export async function createPortalSession(
  user: UserRow,
  origin: string
): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");
  const customerId = await ensureCustomer(user);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/billing`,
  });
  return session.url;
}

function applySubscription(sub: Stripe.Subscription): void {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // period_end sits on the subscription in this API version but moved onto the
  // subscription item in newer ones. Read whichever the account populates so a
  // version bump does not silently null the renewal date.
  const item = sub.items.data[0] as unknown as { current_period_end?: number } | undefined;
  const periodEnd =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;

  db.prepare(
    `UPDATE users
        SET subscription_status = ?, subscription_ends_at = ?
      WHERE stripe_customer_id = ?`
  ).run(
    sub.status,
    periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    customerId
  );
}

/**
 * Handles the webhook events that change whether a user can get in. Anything
 * else Stripe sends is acknowledged and ignored.
 */
export function handleWebhookEvent(event: Stripe.Event): void {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      applySubscription(event.data.object as Stripe.Subscription);
      break;

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (customerId) {
        db.prepare(
          "UPDATE users SET subscription_status = 'active' WHERE stripe_customer_id = ?"
        ).run(customerId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        db.prepare(
          "UPDATE users SET subscription_status = 'past_due' WHERE stripe_customer_id = ?"
        ).run(customerId);
      }
      break;
    }
  }
}
