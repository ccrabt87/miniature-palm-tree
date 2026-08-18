import { Router } from "express";
import { db, getSettings, truckFromLoad, loadInputFrom, type LoadRow } from "../db.js";
import { calcLoad } from "../calc.js";
import { formatCents } from "../money.js";
import { html, raw } from "../views/html.js";
import { layout } from "../views/layout.js";
import { money, route } from "../views/components.js";
import { requireAccess } from "../billing.js";
import { buildIfta, quarterRange, currentQuarter } from "../ifta.js";

export const reportsRouter = Router();

/** Loads counted in a period are the ones that were picked up in it. */
function loadsBetween(userId: number, from: string, to: string): LoadRow[] {
  return db
    .prepare(
      `SELECT * FROM loads
        WHERE user_id = ? AND status != 'canceled'
          AND pickup_date >= ? AND pickup_date <= ?
        ORDER BY pickup_date`
    )
    .all(userId, from, to) as LoadRow[];
}

reportsRouter.get("/reports", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const s = getSettings(userId);
  const now = currentQuarter();

  const year = Number(req.query.year ?? now.year);
  const quarter = Number(req.query.quarter ?? now.quarter);
  const { from, to } = quarterRange(year, quarter);

  const loads = loadsBetween(userId, from, to);

  // Profit summary, using each load's own cost snapshot.
  let revenue = 0, cost = 0, miles = 0, loadedMiles = 0;
  for (const l of loads) {
    const m = calcLoad(loadInputFrom(l), truckFromLoad(l, s.target_profit_per_mile_cents));
    revenue += l.rate_cents;
    cost += m.totalCostCents;
    miles += m.totalMiles;
    loadedMiles += l.loaded_miles;
  }
  const net = revenue - cost;

  // Out-of-pocket spend recorded separately from the per-load cost model.
  const spend = db
    .prepare(
      `SELECT category, COALESCE(SUM(amount_cents),0) AS total
         FROM expenses WHERE user_id=? AND date >= ? AND date <= ?
        GROUP BY category ORDER BY total DESC`
    )
    .all(userId, from, to) as { category: string; total: number }[];
  const spendTotal = spend.reduce((a, r) => a + r.total, 0);

  // IFTA inputs for the same window.
  const stateMiles = db
    .prepare(
      `SELECT sm.state, SUM(sm.miles) AS miles
         FROM load_state_miles sm JOIN loads l ON l.id = sm.load_id
        WHERE l.user_id = ? AND l.status != 'canceled'
          AND l.pickup_date >= ? AND l.pickup_date <= ?
        GROUP BY sm.state`
    )
    .all(userId, from, to) as { state: string; miles: number }[];

  const fuel = db
    .prepare(
      `SELECT state, SUM(gallons) AS gallons
         FROM expenses
        WHERE user_id=? AND date >= ? AND date <= ? AND gallons > 0 AND state != ''
        GROUP BY state`
    )
    .all(userId, from, to) as { state: string; gallons: number }[];

  const ifta = buildIfta({ year, quarter, stateMiles, fuel, totalLoadMiles: miles });

  const quarterOptions = [1, 2, 3, 4];
  const yearOptions = [now.year, now.year - 1, now.year - 2];

  const rpm = miles > 0 ? Math.round(revenue / miles) : 0;
  const ppm = miles > 0 ? Math.round(net / miles) : 0;

  res.send(
    layout({
      title: "Reports",
      user: req.user,
      active: "reports",
      body: html`
        <h1>Reports</h1>

        <form method="get" action="/reports" class="card">
          <div class="grid2">
            <div class="field" style="margin:0">
              <label>Quarter</label>
              <select name="quarter" onchange="this.form.submit()">
                ${quarterOptions.map(
                  (q) => html`<option value="${q}" ${q === quarter ? raw("selected") : raw("")}
                    >Q${q}</option>`
                )}
              </select>
            </div>
            <div class="field" style="margin:0">
              <label>Year</label>
              <select name="year" onchange="this.form.submit()">
                ${yearOptions.map(
                  (y) => html`<option value="${y}" ${y === year ? raw("selected") : raw("")}
                    >${y}</option>`
                )}
              </select>
            </div>
          </div>
          <p class="hint">
            ${from} to ${to} &middot; ${loads.length}
            ${loads.length === 1 ? "load" : "loads"}
          </p>
        </form>

        <h2>Profit</h2>
        <div class="figs">
          <div class="fig"><div class="k">Revenue</div><div class="v">$${formatCents(revenue)}</div></div>
          <div class="fig"><div class="k">Cost to run</div><div class="v">$${formatCents(cost)}</div></div>
          <div class="fig">
            <div class="k">Net</div>
            <div class="v ${net >= 0 ? "good" : "bad"}">$${formatCents(net)}</div>
          </div>
          <div class="fig"><div class="k">Miles</div><div class="v">${Math.round(miles).toLocaleString("en-US")}</div></div>
          <div class="fig"><div class="k">Rev / mile</div><div class="v">$${formatCents(rpm)}</div></div>
          <div class="fig">
            <div class="k">Profit / mile</div>
            <div class="v ${ppm >= 0 ? "good" : "bad"}">$${formatCents(ppm)}</div>
          </div>
        </div>

        <h2>Money out</h2>
        <div class="card">
          ${spend.length === 0
            ? html`<p class="muted" style="margin:0">No expenses logged this quarter.</p>`
            : html`<table>
                <tbody>
                  ${spend.map(
                    (r) => html`<tr><td>${r.category}</td><td>${money(r.total)}</td></tr>`
                  )}
                </tbody>
                <tfoot><tr><td>Total</td><td>${money(spendTotal)}</td></tr></tfoot>
              </table>`}
          <p class="hint" style="margin-top:12px">
            These are the receipts you logged. The profit numbers above use your
            per-mile cost settings instead, so do not add the two together &mdash;
            they are two ways of looking at the same quarter.
          </p>
        </div>

        <h2>IFTA &mdash; ${ifta.quarter}</h2>
        <div class="card">
          ${ifta.rows.length === 0
            ? html`<p class="muted" style="margin:0">
                Nothing to report yet. Split each load's miles by state on the load
                page, and put the state and gallons on every fuel receipt.
              </p>`
            : html`
                <div class="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>State</th><th>Miles</th><th>Gal bought</th>
                        <th>Gal burned</th><th>Net gal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${ifta.rows.map(
                        (r) => html`<tr>
                          <td>${r.state}</td>
                          <td>${Math.round(r.miles).toLocaleString("en-US")}</td>
                          <td>${r.gallonsPurchased.toFixed(1)}</td>
                          <td>${r.taxableGallons.toFixed(1)}</td>
                          <td class="${r.netGallons > 0 ? "" : ""}">${r.netGallons.toFixed(1)}</td>
                        </tr>`
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td>${Math.round(ifta.totalMiles).toLocaleString("en-US")}</td>
                        <td>${ifta.totalGallons.toFixed(1)}</td>
                        <td>${ifta.totalMiles > 0 && ifta.fleetMpg > 0
                          ? (ifta.totalMiles / ifta.fleetMpg).toFixed(1)
                          : "0.0"}</td>
                        <td>0.0</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p class="hint" style="margin-top:12px">
                  Fleet average this quarter: <strong>${ifta.fleetMpg.toFixed(2)} mpg</strong>.
                  A positive net means you burned more fuel in that state than you
                  bought there, so you owe it tax; negative is a credit. Dollar
                  amounts depend on each state's rate for the quarter &mdash; carry
                  these figures onto your return.
                </p>
                ${ifta.unallocatedMiles > 0
                  ? html`<div class="err" style="margin:12px 0 0">
                      ${Math.round(ifta.unallocatedMiles).toLocaleString("en-US")} miles
                      this quarter are not split by state yet. Your return will be
                      short until you fill those in.
                    </div>`
                  : raw("")}
                <a class="btn sub" style="margin-top:12px"
                   href="/reports/ifta.csv?year=${year}&quarter=${quarter}">Download CSV</a>
              `}
        </div>

        <h2>Loads this quarter</h2>
        ${loads.length === 0
          ? html`<div class="card empty">No loads in this quarter.</div>`
          : html`<div class="list">
              ${loads.map((l) => {
                const m = calcLoad(loadInputFrom(l), truckFromLoad(l, s.target_profit_per_mile_cents));
                return html`<a class="item" href="/loads/${l.id}">
                  <div class="t">
                    <span>${route(l)}</span>
                    <span>${money(l.rate_cents)}</span>
                  </div>
                  <div class="s">
                    <span>${l.pickup_date} &middot; ${l.broker_name || "—"}</span>
                    <span>net ${money(m.netProfitCents)}</span>
                  </div>
                </a>`;
              })}
            </div>`}
      `,
    })
  );
});

reportsRouter.get("/reports/ifta.csv", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const now = currentQuarter();
  const year = Number(req.query.year ?? now.year);
  const quarter = Number(req.query.quarter ?? now.quarter);
  const { from, to } = quarterRange(year, quarter);

  const stateMiles = db
    .prepare(
      `SELECT sm.state, SUM(sm.miles) AS miles
         FROM load_state_miles sm JOIN loads l ON l.id = sm.load_id
        WHERE l.user_id=? AND l.status != 'canceled'
          AND l.pickup_date >= ? AND l.pickup_date <= ?
        GROUP BY sm.state`
    )
    .all(userId, from, to) as { state: string; miles: number }[];

  const fuel = db
    .prepare(
      `SELECT state, SUM(gallons) AS gallons FROM expenses
        WHERE user_id=? AND date >= ? AND date <= ? AND gallons > 0 AND state != ''
        GROUP BY state`
    )
    .all(userId, from, to) as { state: string; gallons: number }[];

  const report = buildIfta({ year, quarter, stateMiles, fuel, totalLoadMiles: 0 });

  const lines = [
    `IFTA ${report.quarter},${report.from} to ${report.to}`,
    `Fleet MPG,${report.fleetMpg.toFixed(2)}`,
    "",
    "State,Miles,Gallons purchased,Taxable gallons,Net gallons",
    ...report.rows.map((r) =>
      [r.state, Math.round(r.miles), r.gallonsPurchased.toFixed(2),
       r.taxableGallons.toFixed(2), r.netGallons.toFixed(2)].join(",")
    ),
    ["TOTAL", Math.round(report.totalMiles), report.totalGallons.toFixed(2), "", ""].join(","),
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="ifta-${year}-Q${quarter}.csv"`
  );
  res.send(lines.join("\n"));
});
