import { Router } from "express";
import { db, getSettings, truckFromLoad, loadInputFrom, type LoadRow } from "../db.js";
import { calcLoad } from "../calc.js";
import { formatCents } from "../money.js";
import { html, raw } from "../views/html.js";
import { layout } from "../views/layout.js";
import { money, statusPill, route } from "../views/components.js";
import { requireAccess } from "../billing.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", (req, res, next) => {
  if (!req.user) { res.redirect("/login"); return; }
  next();
}, requireAccess, (req, res) => {
  const userId = req.user!.id;
  const s = getSettings(userId);

  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const recent = db
    .prepare(
      `SELECT * FROM loads
        WHERE user_id=? AND status != 'canceled' AND pickup_date >= ?`
    )
    .all(userId, since) as LoadRow[];

  let revenue = 0, net = 0, miles = 0;
  for (const l of recent) {
    const m = calcLoad(loadInputFrom(l), truckFromLoad(l, s.target_profit_per_mile_cents));
    revenue += l.rate_cents;
    net += m.netProfitCents;
    miles += m.totalMiles;
  }

  const unpaid = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents),0) AS total, COUNT(*) AS n
         FROM invoices WHERE user_id=? AND status != 'paid'`
    )
    .get(userId) as { total: number; n: number };

  const active = db
    .prepare(
      `SELECT * FROM loads
        WHERE user_id=? AND status IN ('booked','in_transit','delivered')
        ORDER BY pickup_date LIMIT 5`
    )
    .all(userId) as LoadRow[];

  const ppm = miles > 0 ? Math.round(net / miles) : 0;

  res.send(
    layout({
      title: "Home",
      user: req.user,
      active: "home",
      body: html`
        <h1>Last 30 days</h1>

        <div class="figs" style="margin-bottom:14px">
          <div class="fig"><div class="k">Revenue</div><div class="v">$${formatCents(revenue)}</div></div>
          <div class="fig">
            <div class="k">Net profit</div>
            <div class="v ${net >= 0 ? "good" : "bad"}">$${formatCents(net)}</div>
          </div>
          <div class="fig">
            <div class="k">Profit / mile</div>
            <div class="v ${ppm >= 0 ? "good" : "bad"}">$${formatCents(ppm)}</div>
          </div>
          <div class="fig"><div class="k">Miles</div><div class="v">${Math.round(miles).toLocaleString("en-US")}</div></div>
          <div class="fig"><div class="k">Loads</div><div class="v">${recent.length}</div></div>
          <div class="fig">
            <div class="k">Owed to you</div>
            <div class="v">$${formatCents(unpaid.total)}</div>
          </div>
        </div>

        <a class="btn" href="/calculator" style="margin-bottom:14px">Check a rate</a>

        <h2>Working on</h2>
        ${active.length === 0
          ? html`<div class="card empty">
              <p>Nothing booked right now.</p>
              <p class="hint">Run a rate check when a broker calls, and save it here if the numbers work.</p>
            </div>`
          : html`<div class="list">
              ${active.map((l) => {
                const m = calcLoad(loadInputFrom(l), truckFromLoad(l, s.target_profit_per_mile_cents));
                return html`<a class="item" href="/loads/${l.id}">
                  <div class="t">
                    <span>${route(l)}</span>
                    <span>${money(l.rate_cents)}</span>
                  </div>
                  <div class="s">
                    <span>${l.pickup_date || "no date"} &middot; ${statusPill(l.status)}</span>
                    <span>net ${money(m.netProfitCents)}</span>
                  </div>
                </a>`;
              })}
            </div>`}

        ${unpaid.n > 0
          ? html`<h2>Get paid</h2>
              <a class="item" href="/invoices">
                <div class="t">
                  <span>${unpaid.n} unpaid ${unpaid.n === 1 ? "invoice" : "invoices"}</span>
                  <span>$${formatCents(unpaid.total)}</span>
                </div>
                <div class="s"><span>Tap to review and chase ${unpaid.n === 1 ? "it" : "them"}</span></div>
              </a>`
          : raw("")}
      `,
    })
  );
});
