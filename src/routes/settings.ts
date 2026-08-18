import { Router } from "express";
import { db, getSettings } from "../db.js";
import { parseMoneyToCents, parseNumber, formatCents } from "../money.js";
import { html } from "../views/html.js";
import { layout } from "../views/layout.js";
import { requireUser } from "../auth.js";

export const settingsRouter = Router();

settingsRouter.get("/settings", requireUser, (req, res) => {
  const s = getSettings(req.user!.id);
  const saved = req.query.saved === "1";
  const c = (v: number) => formatCents(v).replace(/,/g, "");

  res.send(
    layout({
      title: "Settings",
      user: req.user,
      body: html`
        <h1>Settings</h1>
        ${saved ? html`<div class="ok">Saved.</div>` : ""}

        <form method="post" action="/settings">
          <div class="card">
            <h2>Your truck's costs</h2>
            <p class="hint" style="margin-top:0">
              These drive every rate check. Get them close and the app tells you
              the truth; guess badly and it does not.
            </p>

            <div class="field">
              <label for="mpg">Miles per gallon</label>
              <input id="mpg" name="mpg" inputmode="decimal" value="${s.mpg}">
              <p class="hint">Your real average, loaded and empty. Not the brochure number.</p>
            </div>

            <div class="field">
              <label for="fuel_price">Fuel price per gallon</label>
              <input id="fuel_price" name="fuel_price" inputmode="decimal"
                     value="${c(s.fuel_price_cents)}">
              <p class="hint">What you are actually paying at the pump this week.</p>
            </div>

            <div class="field">
              <label for="fixed_cost">Fixed cost per mile</label>
              <input id="fixed_cost" name="fixed_cost" inputmode="decimal"
                     value="${c(s.fixed_cost_per_mile_cents)}">
              <p class="hint">
                Truck payment, insurance, permits, ELD, phone, accounting &mdash;
                add up a month of it and divide by the miles you run in a month.
                Most owner-operators land between $0.50 and $0.80.
              </p>
            </div>

            <div class="field">
              <label for="driver_pay">Driver pay per mile</label>
              <input id="driver_pay" name="driver_pay" inputmode="decimal"
                     value="${c(s.driver_pay_per_mile_cents)}">
              <p class="hint">Leave at 0 if you drive it yourself.</p>
            </div>

            <div class="field">
              <label for="target_profit">Target profit per mile</label>
              <input id="target_profit" name="target_profit" inputmode="decimal"
                     value="${c(s.target_profit_per_mile_cents)}">
              <p class="hint">
                The line between <strong>TAKE IT</strong> and <strong>THIN</strong>.
              </p>
            </div>
          </div>

          <div class="card">
            <h2>Invoice letterhead</h2>
            <div class="field">
              <label for="company_name">Company name</label>
              <input id="company_name" name="company_name" value="${s.company_name}">
            </div>
            <div class="field">
              <label for="company_address">Address</label>
              <textarea id="company_address" name="company_address">${s.company_address}</textarea>
            </div>
            <div class="grid2">
              <div class="field">
                <label for="company_phone">Phone</label>
                <input id="company_phone" name="company_phone" value="${s.company_phone}">
              </div>
              <div class="field">
                <label for="company_email">Email</label>
                <input id="company_email" name="company_email" type="email"
                       value="${s.company_email}">
              </div>
            </div>
            <div class="grid2">
              <div class="field">
                <label for="mc_number">MC number</label>
                <input id="mc_number" name="mc_number" value="${s.mc_number}">
              </div>
              <div class="field">
                <label for="dot_number">DOT number</label>
                <input id="dot_number" name="dot_number" value="${s.dot_number}">
              </div>
            </div>
          </div>

          <button type="submit">Save settings</button>
        </form>

        <div class="card" style="margin-top:14px">
          <h2>Account</h2>
          <p class="muted">${req.user!.email}</p>
          <div class="btn-row">
            <a class="btn sub" href="/billing">Billing</a>
            <form method="post" action="/logout" style="flex:1">
              <button class="sub" type="submit">Log out</button>
            </form>
          </div>
        </div>
      `,
    })
  );
});

settingsRouter.post("/settings", requireUser, (req, res) => {
  const b = (k: string) => String(req.body[k] ?? "").trim();
  const s = getSettings(req.user!.id);

  db.prepare(
    `UPDATE settings SET
       mpg=?, fuel_price_cents=?, fixed_cost_per_mile_cents=?,
       driver_pay_per_mile_cents=?, target_profit_per_mile_cents=?,
       company_name=?, company_address=?, company_phone=?, company_email=?,
       mc_number=?, dot_number=?
     WHERE user_id=?`
  ).run(
    // An mpg of 0 would zero out fuel cost and make every load look great,
    // so keep the previous value rather than accept a blank.
    Math.max(0.1, parseNumber(req.body.mpg, s.mpg)),
    parseMoneyToCents(req.body.fuel_price),
    parseMoneyToCents(req.body.fixed_cost),
    parseMoneyToCents(req.body.driver_pay),
    parseMoneyToCents(req.body.target_profit),
    b("company_name"), b("company_address"), b("company_phone"), b("company_email"),
    b("mc_number"), b("dot_number"),
    req.user!.id
  );

  res.redirect("/settings?saved=1");
});
