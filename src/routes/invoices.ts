import { Router } from "express";
import { db, getSettings, type LoadRow, type InvoiceRow, type SettingsRow } from "../db.js";
import { formatCents } from "../money.js";
import { html, raw } from "../views/html.js";
import { layout } from "../views/layout.js";
import { money, todayISO, place, route } from "../views/components.js";
import { requireAccess } from "../billing.js";

export const invoicesRouter = Router();

/** Brokers commonly pay on 30-day terms; that is the default we bill on. */
const NET_DAYS = 30;

invoicesRouter.get("/invoices", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const rows = db
    .prepare(
      `SELECT i.*, l.broker_name, l.origin_city, l.origin_state, l.dest_city, l.dest_state
         FROM invoices i JOIN loads l ON l.id = i.load_id
        WHERE i.user_id = ?
        ORDER BY i.issued_date DESC, i.id DESC`
    )
    .all(userId) as (InvoiceRow & Pick<LoadRow, "broker_name" | "origin_city" | "origin_state" | "dest_city" | "dest_state">)[];

  const outstanding = rows
    .filter((r) => r.status !== "paid")
    .reduce((a, r) => a + r.amount_cents, 0);

  const overdueBefore = new Date(Date.now() - 0).toISOString().slice(0, 10);

  res.send(
    layout({
      title: "Invoices",
      user: req.user,
      active: "reports",
      body: html`
        <h1>Invoices</h1>

        <div class="figs" style="margin-bottom:14px">
          <div class="fig">
            <div class="k">Outstanding</div>
            <div class="v">$${formatCents(outstanding)}</div>
          </div>
          <div class="fig">
            <div class="k">Unpaid</div>
            <div class="v">${rows.filter((r) => r.status !== "paid").length}</div>
          </div>
        </div>

        ${rows.length === 0
          ? html`<div class="card empty">
              <p>No invoices yet.</p>
              <p class="hint">Open a delivered load and hit <strong>Create invoice</strong>.</p>
            </div>`
          : html`<div class="list">
              ${rows.map((r) => {
                const overdue = r.status !== "paid" && r.due_date < overdueBefore;
                return html`<a class="item" href="/invoices/${r.id}">
                  <div class="t">
                    <span>${r.invoice_number} &middot; ${r.broker_name || "No broker"}</span>
                    <span>${money(r.amount_cents)}</span>
                  </div>
                  <div class="s">
                    <span>${route(r)}</span>
                    <span class="pill ${r.status === "paid" ? "paid" : overdue ? "canceled" : "invoiced"}">
                      ${r.status === "paid" ? "paid" : overdue ? "overdue" : `due ${r.due_date}`}
                    </span>
                  </div>
                </a>`;
              })}
            </div>`}
      `,
    })
  );
});

invoicesRouter.post("/loads/:id/invoice", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const load = db
    .prepare("SELECT * FROM loads WHERE id=? AND user_id=?")
    .get(req.params.id, userId) as LoadRow | undefined;
  if (!load) { res.redirect("/loads"); return; }

  const existing = db
    .prepare("SELECT id FROM invoices WHERE load_id=?")
    .get(load.id) as { id: number } | undefined;
  if (existing) { res.redirect(`/invoices/${existing.id}`); return; }

  const s = getSettings(userId);
  const issued = todayISO();
  const due = new Date(Date.now() + NET_DAYS * 864e5).toISOString().slice(0, 10);
  const number = `INV-${s.next_invoice_number}`;

  // Number allocation and creation go together, so two fast taps cannot hand
  // out the same invoice number twice.
  const create = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO invoices (user_id, load_id, invoice_number, issued_date, due_date, amount_cents)
         VALUES (?,?,?,?,?,?)`
      )
      .run(userId, load.id, number, issued, due, load.rate_cents);
    db.prepare("UPDATE settings SET next_invoice_number = next_invoice_number + 1 WHERE user_id=?")
      .run(userId);
    db.prepare("UPDATE loads SET status='invoiced' WHERE id=?").run(load.id);
    return info.lastInsertRowid;
  });

  res.redirect(`/invoices/${create()}`);
});

invoicesRouter.get("/invoices/:id", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const inv = db
    .prepare("SELECT * FROM invoices WHERE id=? AND user_id=?")
    .get(req.params.id, userId) as InvoiceRow | undefined;
  if (!inv) { res.redirect("/invoices"); return; }

  const load = db.prepare("SELECT * FROM loads WHERE id=?").get(inv.load_id) as LoadRow;
  const s: SettingsRow = getSettings(userId);

  const from = place(load.origin_city, load.origin_state);
  const to = place(load.dest_city, load.dest_state);

  res.send(
    layout({
      title: inv.invoice_number,
      user: req.user,
      bare: true,
      body: html`
        <div class="sheet">
          <div class="row head" style="align-items:flex-start;margin-bottom:26px">
            <div>
              <h1>${s.company_name || "Your Company"}</h1>
              <div class="muted" style="white-space:pre-line">${s.company_address}</div>
              <div class="muted">${s.company_phone}</div>
              <div class="muted">${s.company_email}</div>
              <div class="muted">
                ${s.mc_number ? html`MC ${s.mc_number}` : raw("")}
                ${s.dot_number ? html` &middot; DOT ${s.dot_number}` : raw("")}
              </div>
            </div>
            <div class="right meta">
              <div style="font-size:22px;font-weight:750">INVOICE</div>
              <div>${inv.invoice_number}</div>
              <div class="muted">Issued ${inv.issued_date}</div>
              <div class="muted">Due ${inv.due_date}</div>
            </div>
          </div>

          <div style="margin-bottom:22px">
            <div class="muted" style="font-size:13px;text-transform:uppercase;letter-spacing:.04em">
              Bill to
            </div>
            <div style="font-weight:650">${load.broker_name || "—"}</div>
            <div class="muted">${load.broker_email}</div>
          </div>

          <table>
            <thead>
              <tr><th>Description</th><th>Amount</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Freight: ${from} → ${to}<br>
                  <span class="muted" style="font-size:14px">
                    ${load.load_number ? `Load #${load.load_number} · ` : ""}
                    Picked up ${load.pickup_date || "—"} ·
                    Delivered ${load.delivery_date || "—"} ·
                    ${Math.round(load.loaded_miles).toLocaleString("en-US")} loaded miles
                  </span>
                </td>
                <td>${money(inv.amount_cents)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr><td>Total due</td><td>${money(inv.amount_cents)}</td></tr>
            </tfoot>
          </table>

          <p class="muted" style="margin-top:26px;font-size:14px">
            Payment terms: net ${NET_DAYS} days. Please reference
            ${inv.invoice_number} with payment.
          </p>

          <div class="noprint" style="margin-top:30px">
            <div class="btn-row">
              <button class="sub" type="button" onclick="window.print()">Print / Save PDF</button>
              ${inv.status === "paid"
                ? html`<span class="btn sub">Paid ${inv.paid_date}</span>`
                : html`<form method="post" action="/invoices/${inv.id}/paid" style="flex:1">
                    <button type="submit">Mark paid</button>
                  </form>`}
            </div>
            <div class="btn-row" style="margin-top:10px">
              <a class="btn sub" href="/invoices">All invoices</a>
              <a class="btn sub" href="/loads/${load.id}">Back to load</a>
            </div>
          </div>
        </div>
      `,
    })
  );
});

invoicesRouter.post("/invoices/:id/paid", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const inv = db
    .prepare("SELECT * FROM invoices WHERE id=? AND user_id=?")
    .get(req.params.id, userId) as InvoiceRow | undefined;
  if (!inv) { res.redirect("/invoices"); return; }

  const settle = db.transaction(() => {
    db.prepare("UPDATE invoices SET status='paid', paid_date=? WHERE id=?")
      .run(todayISO(), inv.id);
    db.prepare("UPDATE loads SET status='paid' WHERE id=?").run(inv.load_id);
  });
  settle();

  res.redirect(`/invoices/${inv.id}`);
});
