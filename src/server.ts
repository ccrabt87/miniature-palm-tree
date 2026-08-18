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
