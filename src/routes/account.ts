import { Router } from "express";
import { html, raw } from "../views/html.js";
import { layout, APP_NAME } from "../views/layout.js";
import {
  createUser, findUserByEmail, verifyPassword, startSession, endSession, requireUser,
} from "../auth.js";
import {
  checkAccess, createCheckoutSession, createPortalSession, stripe, PRICE_ID,
} from "../billing.js";

export const accountRouter = Router();

const PRICE_LABEL = process.env.PRICE_LABEL ?? "$29/month";

function authPage(mode: "login" | "signup", error?: string, email = ""): string {
  const isSignup = mode === "signup";
  return layout({
    title: isSignup ? "Sign up" : "Log in",
    bare: true,
    body: html`
      <div class="auth">
        <h1>${APP_NAME}</h1>
        <p class="tag">Know what a load pays before you take it.</p>
        ${error ? html`<div class="err">${error}</div>` : raw("")}
        <form method="post" action="${isSignup ? "/signup" : "/login"}">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required autocomplete="email"
                   value="${email}">
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required
                   autocomplete="${isSignup ? "new-password" : "current-password"}">
            ${isSignup ? html`<p class="hint">At least 8 characters.</p>` : raw("")}
          </div>
          <button type="submit">${isSignup ? "Start free trial" : "Log in"}</button>
        </form>
        <p class="muted" style="text-align:center;margin-top:18px">
          ${isSignup
            ? html`Already have an account? <a href="/login">Log in</a>`
            : html`New here? <a href="/signup">Start a free trial</a>`}
        </p>
      </div>
    `,
  });
}

accountRouter.get("/signup", (req, res) => {
  if (req.user) { res.redirect("/"); return; }
  res.send(authPage("signup"));
});

accountRouter.post("/signup", (req, res) => {
  const email = String(req.body.email ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!email.includes("@")) {
    res.status(400).send(authPage("signup", "That does not look like an email address.", email));
    return;
  }
  if (password.length < 8) {
    res.status(400).send(authPage("signup", "Password needs at least 8 characters.", email));
    return;
  }
  if (findUserByEmail(email)) {
    res.status(400).send(authPage("signup", "There is already an account with that email.", email));
    return;
  }

  const user = createUser(email, password);
  startSession(res, user.id);
  res.redirect("/settings");
});

accountRouter.get("/login", (req, res) => {
  if (req.user) { res.redirect("/"); return; }
  res.send(authPage("login"));
});

accountRouter.post("/login", (req, res) => {
  const email = String(req.body.email ?? "").trim();
  const password = String(req.body.password ?? "");
  const user = findUserByEmail(email);

  // Same message either way so this cannot be used to discover which emails
  // have accounts.
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).send(authPage("login", "Email or password is not right.", email));
    return;
  }

  startSession(res, user.id);
  res.redirect("/");
});

accountRouter.post("/logout", (req, res) => {
  endSession(req, res);
  // The service worker caches pages for offline use; those belong to the
  // account that just left, so the client is told to drop them.
  res.redirect("/login?cleared=1");
});

accountRouter.get("/billing", requireUser, async (req, res) => {
  const user = req.user!;
  const access = checkAccess(user);
  const checkout = String(req.query.checkout ?? "");

  const status = (() => {
    switch (access.reason) {
      case "subscribed":
        return html`<div class="ok">Subscription active.</div>`;
      case "past_due":
        return html`<div class="err">
          Your last payment failed. Update your card to keep the account open.
        </div>`;
      case "trial":
        return html`<div class="card">
          <h2>Free trial</h2>
          <p style="margin:0">
            ${access.trialDaysLeft} ${access.trialDaysLeft === 1 ? "day" : "days"}
            left. Subscribe any time &mdash; nothing is lost.
          </p>
        </div>`;
      case "canceled":
        return html`<div class="err">Your subscription was canceled.</div>`;
      default:
        return html`<div class="err">
          Your free trial has ended. Subscribe to get back to your loads &mdash;
          your data is all still here.
        </div>`;
    }
  })();

  const configured = Boolean(stripe && PRICE_ID);

  res.send(
    layout({
      title: "Billing",
      user,
      body: html`
        <h1>Billing</h1>
        ${checkout === "success"
          ? html`<div class="ok">Thanks &mdash; you are all set.</div>`
          : raw("")}
        ${checkout === "canceled"
          ? html`<div class="card"><p style="margin:0">Checkout canceled. No charge was made.</p></div>`
          : raw("")}
        ${status}

        <div class="card">
          <h2>${APP_NAME} &mdash; ${PRICE_LABEL}</h2>
          <ul class="muted" style="padding-left:20px;margin:0 0 16px">
            <li>Rate check on every load before you commit</li>
            <li>Load book with status from booked to paid</li>
            <li>Printable broker invoices</li>
            <li>Quarterly IFTA figures and CSV export</li>
            <li>Expense log ready for your tax preparer</li>
          </ul>

          ${!configured
            ? html`<div class="err" style="margin:0">
                Billing is not configured on this server yet. Set
                <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_PRICE_ID</code>.
              </div>`
            : access.reason === "subscribed" || access.reason === "past_due"
              ? html`<form method="post" action="/billing/portal">
                  <button type="submit">Manage subscription</button>
                </form>`
              : html`<form method="post" action="/billing/checkout">
                  <button type="submit">Subscribe</button>
                </form>`}
        </div>

        <a class="btn sub" href="/settings">Back to settings</a>
      `,
    })
  );
});

accountRouter.post("/billing/checkout", requireUser, async (req, res, next) => {
  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    res.redirect(303, await createCheckoutSession(req.user!, origin));
  } catch (err) {
    next(err);
  }
});

accountRouter.post("/billing/portal", requireUser, async (req, res, next) => {
  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    res.redirect(303, await createPortalSession(req.user!, origin));
  } catch (err) {
    next(err);
  }
});
