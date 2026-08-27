import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import type Stripe from "stripe";

import { loadUser, purgeExpiredSessions } from "./auth.js";
import { stripe, handleWebhookEvent } from "./billing.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { calculatorRouter } from "./routes/calculator.js";
import { loadsRouter } from "./routes/loads.js";
import { expensesRouter } from "./routes/expenses.js";
import { invoicesRouter } from "./routes/invoices.js";
import { reportsRouter } from "./routes/reports.js";
import { settingsRouter } from "./routes/settings.js";
import { accountRouter } from "./routes/account.js";
import { layout } from "./views/layout.js";
import { html } from "./views/html.js";

const app = express();
const here = dirname(fileURLToPath(import.meta.url));

/**
 * public/ sits at the project root, but this file runs from src/ under tsx and
 * from dist/src/ once compiled — one level deeper. Resolve it either way so a
 * production build does not quietly serve an unstyled app.
 */
const publicDir = [
  join(here, "..", "public"),
  join(here, "..", "..", "public"),
].find(existsSync) ?? join(here, "..", "public");

// Needed so req.protocol reports https behind a platform proxy; otherwise
// Stripe redirect URLs come back as http and secure cookies never stick.
app.set("trust proxy", 1);
app.disable("x-powered-by");

/**
 * The webhook must see the raw bytes to verify Stripe's signature, so it is
 * mounted ahead of the JSON and urlencoded body parsers.
 */
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) {
      res.status(503).send("Stripe is not configured");
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        req.headers["stripe-signature"] as string,
        secret
      );
    } catch (err) {
      res.status(400).send(`Signature check failed: ${(err as Error).message}`);
      return;
    }

    try {
      handleWebhookEvent(event);
      res.json({ received: true });
    } catch (err) {
      // Return 500 so Stripe retries rather than dropping the event.
      console.error("webhook handler failed", err);
      res.status(500).send("handler error");
    }
  }
);

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(publicDir, { maxAge: "1h" }));
app.use(loadUser);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

/**
 * Precached by the service worker and served when a navigation fails with no
 * signal. It deliberately points at the rate check, which runs entirely on the
 * phone and is the one thing he needs while a broker is on the line.
 */
/**
 * Digital Asset Links. A Trusted Web Activity only hides the browser URL bar
 * if this file verifies that the Play Store app and this domain belong to the
 * same owner. Without it the app still runs, but with a browser bar across the
 * top that makes it look like a website rather than an app.
 *
 * ANDROID_PACKAGE_NAME and ANDROID_CERT_FINGERPRINT come from the signing key
 * (see android/README.md). With neither set, this 404s, which is correct for a
 * deployment that has no Android build.
 */
app.get("/.well-known/assetlinks.json", (_req, res) => {
  const pkg = process.env.ANDROID_PACKAGE_NAME;
  const fingerprint = process.env.ANDROID_CERT_FINGERPRINT;

  if (!pkg || !fingerprint) {
    res.status(404).json({ error: "No Android app is configured for this domain." });
    return;
  }

  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: pkg,
        // Accepts either one fingerprint or a comma-separated list, since the
        // upload key and Play's app-signing key are usually both needed.
        sha256_cert_fingerprints: fingerprint.split(",").map((f) => f.trim()).filter(Boolean),
      },
    },
  ]);
});

app.get("/offline", (_req, res) => {
  res.send(
    layout({
      title: "Offline",
      bare: true,
      body: html`
        <div class="offline-page">
          <div class="big">\u{1F6DC}</div>
          <h1>No signal</h1>
          <p class="muted">
            This page needs a connection. Your rate check does not &mdash; it runs
            on the phone.
          </p>
          <a class="btn" href="/calculator">Open rate check</a>
          <p class="hint" style="margin-top:16px">
            Anything you save while offline is held on the phone and sent when
            the bars come back.
          </p>
        </div>
      `,
    })
  );
});

app.use(accountRouter);
app.use(dashboardRouter);
app.use(calculatorRouter);
app.use(loadsRouter);
app.use(expensesRouter);
app.use(invoicesRouter);
app.use(reportsRouter);
app.use(settingsRouter);

app.use((req, res) => {
  res.status(404).send(
    layout({
      title: "Not found",
      user: req.user,
      body: html`
        <h1>Not found</h1>
        <p class="muted">That page does not exist.</p>
        <a class="btn sub" href="/">Go home</a>
      `,
    })
  );
});

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).send(
    layout({
      title: "Something broke",
      user: req.user,
      body: html`
        <h1>Something broke</h1>
        <p class="muted">
          That is on us. Nothing you entered was lost &mdash; try again.
        </p>
        <a class="btn sub" href="/">Go home</a>
      `,
    })
  );
});

purgeExpiredSessions();
setInterval(purgeExpiredSessions, 6 * 3600 * 1000).unref();

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`HaulMath listening on http://localhost:${port}`);
  if (!stripe) console.log("Stripe not configured — billing is in trial-only mode.");
});
