import { Router } from "express";
import {
  db, getSettings, truckFromLoad, loadInputFrom,
  type LoadRow, type InvoiceRow,
} from "../db.js";
import { calcLoad, targetRateCents } from "../calc.js";
import { parseNumber, formatCents } from "../money.js";
import { html, raw } from "../views/html.js";
import { layout } from "../views/layout.js";
import { verdictBlock, statusPill, stateSelect, money, route, todayISO } from "../views/components.js";
import { requireAccess } from "../billing.js";
import { loadInputFromForm } from "./calculator.js";

export const loadsRouter = Router();

const STATUSES = ["booked", "in_transit", "delivered", "invoiced", "paid", "canceled"];

/** Always scoped by user_id so one account can never read another's loads. */
function getLoad(userId: number, id: string): LoadRow | undefined {
  return db
    .prepare("SELECT * FROM loads WHERE id = ? AND user_id = ?")
    .get(id, userId) as LoadRow | undefined;
}

loadsRouter.get("/loads", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const filter = String(req.query.status ?? "");
  const rows = (
    filter && STATUSES.includes(filter)
      ? db.prepare(
          "SELECT * FROM loads WHERE user_id = ? AND status = ? ORDER BY pickup_date DESC, id DESC"
        ).all(userId, filter)
      : db.prepare(
          "SELECT * FROM loads WHERE user_id = ? ORDER BY pickup_date DESC, id DESC"
        ).all(userId)
  ) as LoadRow[];

  const s = getSettings(userId);

  const items = rows.map((load) => {
    const m = calcLoad(loadInputFrom(load), truckFromLoad(load, s.target_profit_per_mile_cents));
    const where = route(load);
    return html`<a class="item" href="/loads/${load.id}">
      <div class="t">
        <span>${where}</span>
        <span>${money(load.rate_cents)}</span>
      </div>
      <div class="s">
        <span>${load.broker_name || "No broker"} &middot; ${statusPill(load.status)}</span>
        <span class="${m.netProfitCents >= 0 ? "" : "bad"}">
          net ${money(m.netProfitCents)}
        </span>
      </div>
    </a>`;
  });

  res.send(
    layout({
      title: "Loads",
      user: req.user,
      active: "loads",
      body: html`
        <h1>Loads</h1>
        <div class="btn-row" style="margin-bottom:14px">
          <a class="btn sm ${filter ? "sub" : ""}" href="/loads">All</a>
          ${STATUSES.filter((x) => x !== "canceled").map(
            (x) => html`<a class="btn sm ${filter === x ? "" : "sub"}" href="/loads?status=${x}"
              >${x.replace(/_/g, " ")}</a
            >`
          )}
        </div>
        ${rows.length === 0
          ? html`<div class="card empty">
              <p>No loads yet.</p>
              <a class="btn" href="/calculator">Check a rate</a>
            </div>`
          : html`<div class="list">${items}</div>`}
      `,
    })
  );
});

loadsRouter.get("/loads/:id", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const load = getLoad(userId, req.params.id!);
  if (!load) {
    res.status(404).send(layout({ title: "Not found", user: req.user, body: html`<h1>Load not found</h1>` }));
    return;
  }

  const s = getSettings(userId);
  const truck = truckFromLoad(load, s.target_profit_per_mile_cents);
  const input = loadInputFrom(load);
  const m = calcLoad(input, truck);

  const invoice = db
    .prepare("SELECT * FROM invoices WHERE load_id = ?")
    .get(load.id) as InvoiceRow | undefined;

  const stateMiles = db
    .prepare("SELECT state, miles FROM load_state_miles WHERE load_id = ? ORDER BY state")
    .all(load.id) as { state: string; miles: number }[];

  const totalSplit = stateMiles.reduce((a, r) => a + r.miles, 0);

  const where = route(load);

  res.send(
    layout({
      title: where,
      user: req.user,
      active: "loads",
      body: html`
        <h1>${where}</h1>
        <p class="muted">
          ${load.broker_name || "No broker"}
          ${load.load_number ? html` &middot; Load #${load.load_number}` : raw("")}
          &middot; ${statusPill(load.status)}
        </p>

        ${verdictBlock(m, targetRateCents(input, truck))}

        <div class="card">
          <h2>Status</h2>
          <form method="post" action="/loads/${load.id}/status" class="row" style="gap:10px">
            <select name="status" style="flex:1">
              ${STATUSES.map(
                (x) => html`<option value="${x}" ${load.status === x ? raw("selected") : raw("")}
                  >${x.replace(/_/g, " ")}</option
                >`
              )}
            </select>
            <button class="sm" type="submit" style="width:auto">Update</button>
          </form>

          <div class="btn-row" style="margin-top:12px">
            ${invoice
              ? html`<a class="btn sub" href="/invoices/${invoice.id}"
                  >Invoice ${invoice.invoice_number}</a
                >`
              : html`<form method="post" action="/loads/${load.id}/invoice" style="flex:1">
                  <button type="submit">Create invoice</button>
                </form>`}
            <a class="btn sub" href="/loads/${load.id}/edit">Edit</a>
          </div>
        </div>

        <div class="card">
          <h2>Miles by state <span class="muted">(for IFTA)</span></h2>
          <p class="hint" style="margin-top:0">
            Split this trip's ${Math.round(m.totalMiles).toLocaleString("en-US")} miles
            across the states you ran. Feeds your quarterly IFTA report.
            ${totalSplit > 0
              ? html` Currently split: ${Math.round(totalSplit).toLocaleString("en-US")} mi.`
              : raw("")}
          </p>
          <form method="post" action="/loads/${load.id}/state-miles">
            <div class="stack">
              ${[0, 1, 2, 3, 4, 5].map((i) => {
                const row = stateMiles[i];
                return html`<div class="grid2">
                  ${stateSelect(`state_${i}`, row?.state ?? "")}
                  <input name="miles_${i}" inputmode="decimal" placeholder="miles"
                         value="${row ? String(row.miles) : ""}" autocomplete="off">
                </div>`;
              })}
            </div>
            <button class="sub" type="submit" style="margin-top:12px">Save state miles</button>
          </form>
        </div>

        <div class="card">
          <h2>Notes</h2>
          <form method="post" action="/loads/${load.id}/notes">
            <textarea name="notes" placeholder="Detention, dock hours, who to call…">${load.notes}</textarea>
            <button class="sub" type="submit" style="margin-top:10px">Save notes</button>
          </form>
        </div>

        <form method="post" action="/loads/${load.id}/delete"
              onsubmit="return confirm('Delete this load for good?')">
          <button class="btn danger" type="submit">Delete load</button>
        </form>
      `,
    })
  );
});

loadsRouter.get("/loads/:id/edit", requireAccess, (req, res) => {
  const load = getLoad(req.user!.id, req.params.id!);
  if (!load) { res.redirect("/loads"); return; }

  const cents = (c: number) => (c ? formatCents(c).replace(/,/g, "") : "");

  res.send(
    layout({
      title: "Edit load",
      user: req.user,
      active: "loads",
      body: html`
        <h1>Edit load</h1>
        <form method="post" action="/loads/${load.id}">
          <div class="card">
            <div class="field">
              <label>Rate</label>
              <input name="rate" inputmode="decimal" value="${cents(load.rate_cents)}">
            </div>
            <div class="grid2">
              <div class="field">
                <label>Loaded miles</label>
                <input name="loaded_miles" inputmode="decimal" value="${load.loaded_miles}">
              </div>
              <div class="field">
                <label>Deadhead miles</label>
                <input name="deadhead_miles" inputmode="decimal" value="${load.deadhead_miles}">
              </div>
            </div>
            <div class="grid2">
              <div class="field">
                <label>Tolls</label>
                <input name="tolls" inputmode="decimal" value="${cents(load.tolls_cents)}">
              </div>
              <div class="field">
                <label>Lumper / other</label>
                <input name="other_costs" inputmode="decimal" value="${cents(load.other_costs_cents)}">
              </div>
            </div>
            <div class="field">
              <label>Days</label>
              <input name="transit_days" inputmode="decimal" value="${load.transit_days}">
            </div>
          </div>

          <div class="card">
            <div class="field">
              <label>Broker</label>
              <input name="broker_name" value="${load.broker_name}">
            </div>
            <div class="field">
              <label>Broker email</label>
              <input name="broker_email" type="email" value="${load.broker_email}">
            </div>
            <div class="field">
              <label>Load / ref number</label>
              <input name="load_number" value="${load.load_number}">
            </div>
            <div class="grid2">
              <div class="field">
                <label>From</label>
                <input name="origin_city" value="${load.origin_city}">
              </div>
              <div class="field">
                <label>State</label>
                ${stateSelect("origin_state", load.origin_state)}
              </div>
            </div>
            <div class="grid2">
              <div class="field">
                <label>To</label>
                <input name="dest_city" value="${load.dest_city}">
              </div>
              <div class="field">
                <label>State</label>
                ${stateSelect("dest_state", load.dest_state)}
              </div>
            </div>
            <div class="grid2">
              <div class="field">
                <label>Pickup</label>
                <input name="pickup_date" type="date" value="${load.pickup_date}">
              </div>
              <div class="field">
                <label>Delivery</label>
                <input name="delivery_date" type="date" value="${load.delivery_date}">
              </div>
            </div>
          </div>

          <div class="btn-row">
            <a class="btn sub" href="/loads/${load.id}">Cancel</a>
            <button type="submit">Save changes</button>
          </div>
        </form>
      `,
    })
  );
});

loadsRouter.post("/loads/:id", requireAccess, (req, res) => {
  const load = getLoad(req.user!.id, req.params.id!);
  if (!load) { res.redirect("/loads"); return; }

  const input = loadInputFromForm(req.body);
  const b = (k: string) => String(req.body[k] ?? "").trim();

  // Clearing the pickup date would drop the load out of every report window,
  // so fall back to what it already had.
  const pickup = b("pickup_date") || load.pickup_date || todayISO();

  db.prepare(
    `UPDATE loads SET
       rate_cents=?, loaded_miles=?, deadhead_miles=?, tolls_cents=?,
       other_costs_cents=?, transit_days=?, broker_name=?, broker_email=?,
       load_number=?, origin_city=?, origin_state=?, dest_city=?, dest_state=?,
       pickup_date=?, delivery_date=?
     WHERE id=? AND user_id=?`
  ).run(
    input.rateCents, input.loadedMiles, input.deadheadMiles, input.tollsCents,
    input.otherCostsCents, input.transitDays, b("broker_name"), b("broker_email"),
    b("load_number"), b("origin_city"), b("origin_state"), b("dest_city"),
    b("dest_state"), pickup, b("delivery_date"),
    load.id, req.user!.id
  );

  res.redirect(`/loads/${load.id}`);
});

loadsRouter.post("/loads/:id/status", requireAccess, (req, res) => {
  const status = String(req.body.status ?? "");
  if (STATUSES.includes(status)) {
    db.prepare("UPDATE loads SET status=? WHERE id=? AND user_id=?")
      .run(status, req.params.id, req.user!.id);
  }
  res.redirect(`/loads/${req.params.id}`);
});

loadsRouter.post("/loads/:id/notes", requireAccess, (req, res) => {
  db.prepare("UPDATE loads SET notes=? WHERE id=? AND user_id=?")
    .run(String(req.body.notes ?? ""), req.params.id, req.user!.id);
  res.redirect(`/loads/${req.params.id}`);
});

loadsRouter.post("/loads/:id/state-miles", requireAccess, (req, res) => {
  const load = getLoad(req.user!.id, req.params.id!);
  if (!load) { res.redirect("/loads"); return; }

  // Rewrite the whole split each save — simpler than diffing six rows, and the
  // form always submits the complete picture.
  const replace = db.transaction(() => {
    db.prepare("DELETE FROM load_state_miles WHERE load_id = ?").run(load.id);
    const insert = db.prepare(
      "INSERT INTO load_state_miles (load_id, state, miles) VALUES (?,?,?)"
    );
    for (let i = 0; i < 6; i++) {
      const state = String(req.body[`state_${i}`] ?? "").trim().toUpperCase();
      const miles = parseNumber(req.body[`miles_${i}`]);
      if (state && miles > 0) insert.run(load.id, state, miles);
    }
  });
  replace();

  res.redirect(`/loads/${load.id}`);
});

loadsRouter.post("/loads/:id/delete", requireAccess, (req, res) => {
  db.prepare("DELETE FROM loads WHERE id=? AND user_id=?").run(req.params.id, req.user!.id);
  res.redirect("/loads");
});
