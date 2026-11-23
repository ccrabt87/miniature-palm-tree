/**
 * Who gets into the working parts of the app. Pure, so it can be tested
 * without a database or Stripe keys.
 */

export interface AccessUser {
  email: string;
  trial_ends_at: string;
  subscription_status: string;
}

export interface BillingConfig {
  /**
   * True only when there is actually a way to pay (Stripe key and a price).
   * With billing off there is nothing to subscribe to, so a trial expiring
   * must not lock anyone out.
   */
  enabled: boolean;
  /** Lower-cased emails that never pay, e.g. the driver the app was built for. */
  compEmails: ReadonlySet<string>;
}

export type AccessReason =
  | "free"
  | "comp"
  | "subscribed"
  | "past_due"
  | "trial"
  | "trial_expired"
  | "canceled";

export interface Access {
  allowed: boolean;
  reason: AccessReason;
  trialDaysLeft: number;
}

export function parseCompEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function accessFor(
  user: AccessUser,
  config: BillingConfig,
  now: number = Date.now()
): Access {
  const msLeft = new Date(user.trial_ends_at).getTime() - now;
  const trialDaysLeft = Math.max(0, Math.ceil(msLeft / 864e5));

  if (!config.enabled) return { allowed: true, reason: "free", trialDaysLeft };

  if (config.compEmails.has(user.email.trim().toLowerCase())) {
    return { allowed: true, reason: "comp", trialDaysLeft };
  }

  if (user.subscription_status === "active") {
    return { allowed: true, reason: "subscribed", trialDaysLeft };
  }

  // past_due keeps the doors open — Stripe is still retrying the card, and
  // locking a driver out mid-week over a declined charge loses the customer.
  if (user.subscription_status === "past_due") {
    return { allowed: true, reason: "past_due", trialDaysLeft };
  }

  if (trialDaysLeft > 0) return { allowed: true, reason: "trial", trialDaysLeft };

  return {
    allowed: false,
    reason: user.subscription_status === "canceled" ? "canceled" : "trial_expired",
    trialDaysLeft: 0,
  };
}
