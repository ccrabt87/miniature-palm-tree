import { Router } from "express";
import { db, type ExpenseRow } from "../db.js";
import { parseMoneyToCents, parseNumber, formatCents } from "../money.js";
import { html, raw } from "../views/html.js";
import { layout } from "../views/layout.js";
import { money, stateSelect, todayISO } from "../views/components.js";
import { requireAccess } from "../billing.js";

export const expensesRouter = Router();

/** Schedule C-shaped buckets so the year-end handoff to a tax preparer is easy. */
export const CATEGORIES = [
  "Fuel",
  "Repairs & maintenance",
  "Tires",
  "Insurance",
  "Truck payment",
  "Permits & licensing",
  "Tolls & scales",
  "Lumper & loading",
  "Meals & lodging",
  "Phone & ELD",
  "Parking",
  "Other",
];

expensesRouter.get("/expenses", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const rows = db
    .prepare("SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 200")
    .all(userId) as ExpenseRow[];

  const monthStart = new Date().toISOString().slice(0, 7) + "-01";
  const monthTotal = (
    db.prepare(
      "SELECT COALESCE(SUM(amount_cents),0) AS t FROM expenses WHERE user_id=? AND date >= ?"
    ).get(userId, monthStart) as { t: number }
  ).t;

  res.send(
    layout({
      title: "Expenses",
      user: req.user,
      active: "expenses",
      body: html`
        <h1>Expenses</h1>

        <div class="card">
          <h2>Add an expense</h2>
          <form method="post" action="/expenses">
            <div class="grid2">
              <div class="field">
                <label for="date">Date</label>
                <input id="date" name="date" type="date" value="${todayISO()}" required>
              </div>
              <div class="field">
                <label for="amount">Amount</label>
                <input id="amount" name="amount" inputmode="decimal" placeholder="0.00" required>
              </div>
            </div>
            <div class="field">
              <label for="category">Category</label>
              <select id="category" name="category">
                ${CATEGORIES.map((c) => html`<option value="${c}">${c}</option>`)}
              </select>
            </div>
            <div class="grid2">
              <div class="field">
                <label>State bought in</label>
                ${stateSelect("state", "")}
                <p class="hint">Needed for IFTA on fuel.</p>
              </div>
              <div class="field">
                <label for="gallons">Gallons</label>
                <input id="gallons" name="gallons" inputmode="decimal" placeholder="0">
                <p class="hint">Fuel purchases only.</p>
              </div>
            </div>
            <div class="field">
              <label for="description">Note</label>
              <input id="description" name="description" placeholder="Loves, Salina">
            </div>
            <button type="submit">Add expense</button>
          </form>
        </div>

        <div class="card">
          <div class="row">
            <strong>This month</strong>
            <strong>$${formatCents(monthTotal)}</strong>
          </div>
        </div>

        <h2>Recent</h2>
        ${rows.length === 0
          ? html`<div class="card empty">Nothing logged yet.</div>`
          : html`<div class="list">
              ${rows.map(
                (e) => html`<div class="item">
                  <div class="t">
                    <span>${e.category}</span>
                    <span>${money(e.amount_cents)}</span>
                  </div>
                  <div class="s">
                    <span>
                      ${e.date}
                      ${e.description ? html` &middot; ${e.description}` : raw("")}
                      ${e.state ? html` &middot; ${e.state}` : raw("")}
                      ${e.gallons > 0 ? html` &middot; ${e.gallons} gal` : raw("")}
                    </span>
                    <form method="post" action="/expenses/${e.id}/delete">
                      <button class="btn sm sub" type="submit" style="padding:3px 9px;font-size:13px">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>`
              )}
            </div>`}
      `,
    })
  );
});

expensesRouter.post("/expenses", requireAccess, (req, res) => {
  const b = (k: string) => String(req.body[k] ?? "").trim();
  db.prepare(
    `INSERT INTO expenses (user_id, date, category, description, amount_cents, state, gallons)
     VALUES (?,?,?,?,?,?,?)`
  ).run(
    req.user!.id,
    b("date") || todayISO(),
    b("category") || "Other",
    b("description"),
    parseMoneyToCents(req.body.amount),
    b("state").toUpperCase(),
    parseNumber(req.body.gallons)
  );
  res.redirect("/expenses");
});

expensesRouter.post("/expenses/:id/delete", requireAccess, (req, res) => {
  db.prepare("DELETE FROM expenses WHERE id=? AND user_id=?").run(req.params.id, req.user!.id);
  res.redirect("/expenses");
});
