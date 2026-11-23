import { Router } from "express";
import { db, getSettings, truckFromSettings, findByIdempotencyKey } from "../db.js";
import { calcLoad, targetRateCents, type LoadInput } from "../calc.js";
import { parseMoneyToCents, parseNumber, formatCents } from "../money.js";
import { html, raw } from "../views/html.js";
import { layout } from "../views/layout.js";
import { verdictBlock, stateSelect, todayISO } from "../views/components.js";
import { requireAccess } from "../billing.js";

export const calculatorRouter = Router();

/** Pulls a load's numbers out of a submitted form. */
export function loadInputFromForm(body: Record<string, unknown>): LoadInput {
  return {
    rateCents: parseMoneyToCents(body.rate),
    loadedMiles: parseNumber(body.loaded_miles),
    deadheadMiles: parseNumber(body.deadhead_miles),
    tollsCents: parseMoneyToCents(body.tolls),
    otherCostsCents: parseMoneyToCents(body.other_costs),
    transitDays: Math.max(0, parseNumber(body.transit_days, 1)),
  };
}

function calcForm(body: Record<string, unknown>) {
  const v = (k: string, d = "") => String(body[k] ?? d);
  return html`
    <form method="post" action="/calculator/save" data-live-calc data-offline-ok>
      <div class="card">
        <h2>The load</h2>
        <div class="field">
          <label for="rate">What are they paying?</label>
          <input id="rate" name="rate" inputmode="decimal" placeholder="2500"
                 value="${v("rate")}" autocomplete="off">
        </div>
        <div class="grid2">
          <div class="field">
            <label for="loaded_miles">Loaded miles</label>
            <input id="loaded_miles" name="loaded_miles" inputmode="decimal"
                   placeholder="900" value="${v("loaded_miles")}" autocomplete="off">
          </div>
          <div class="field">
            <label for="deadhead_miles">Deadhead miles</label>
            <input id="deadhead_miles" name="deadhead_miles" inputmode="decimal"
                   placeholder="100" value="${v("deadhead_miles")}" autocomplete="off">
            <p class="hint">Empty miles to the pickup.</p>
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label for="tolls">Tolls</label>
            <input id="tolls" name="tolls" inputmode="decimal" placeholder="0"
                   value="${v("tolls")}" autocomplete="off">
          </div>
          <div class="field">
            <label for="other_costs">Lumper / other</label>
            <input id="other_costs" name="other_costs" inputmode="decimal" placeholder="0"
                   value="${v("other_costs")}" autocomplete="off">
          </div>
        </div>
        <div class="field">
          <label for="transit_days">Days it ties up the truck</label>
          <input id="transit_days" name="transit_days" inputmode="decimal"
                 value="${v("transit_days", "1")}" autocomplete="off">
        </div>
      </div>

      <div id="calc-result"></div>

      <div class="card">
        <h2>Book it</h2>
        <p class="hint" style="margin-top:0">
          Fill these in only if you are taking the load. Everything above is
          already saved with it.
        </p>
        <div class="field">
          <label for="broker_name">Broker</label>
          <input id="broker_name" name="broker_name" value="${v("broker_name")}"
                 autocomplete="off">
        </div>
        <div class="field">
          <label for="load_number">Load / ref number</label>
          <input id="load_number" name="load_number" value="${v("load_number")}"
                 autocomplete="off">
        </div>
        <div class="grid2">
          <div class="field">
            <label for="origin_city">From</label>
            <input id="origin_city" name="origin_city" placeholder="Salina"
                   value="${v("origin_city")}" autocomplete="off">
          </div>
          <div class="field">
            <label>State</label>
            ${stateSelect("origin_state", v("origin_state", "KS"))}
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label for="dest_city">To</label>
            <input id="dest_city" name="dest_city" placeholder="Denver"
                   value="${v("dest_city")}" autocomplete="off">
          </div>
          <div class="field">
            <label>State</label>
            ${stateSelect("dest_state", v("dest_state"))}
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label for="pickup_date">Pickup</label>
            <input id="pickup_date" name="pickup_date" type="date"
                   value="${v("pickup_date", todayISO())}">
          </div>
          <div class="field">
            <label for="delivery_date">Delivery</label>
            <input id="delivery_date" name="delivery_date" type="date"
                   value="${v("delivery_date")}">
          </div>
        </div>
        <button type="submit">Save this load</button>
      </div>
    </form>
  `;
}

calculatorRouter.get("/calculator", requireAccess, (req, res) => {
  const s = getSettings(req.user!.id);
  res.send(
    layout({
      title: "Rate Check",
      user: req.user,
      active: "calculator",
      body: html`
        <h1>Rate check</h1>
        <p class="muted">
          Your truck: ${s.mpg} mpg, fuel at $${formatCents(s.fuel_price_cents)}/gal,
          fixed costs $${formatCents(s.fixed_cost_per_mile_cents)}/mi.
          <a href="/settings">Change</a>
        </p>
        ${calcForm(req.query as Record<string, unknown>)}
        <script type="application/json" id="truck-settings">
          ${raw(JSON.stringify(truckFromSettings(s)))}
        </script>
      `,
    })
  );
});

/** Returns just the verdict fragment; the page swaps it in as he types. */
calculatorRouter.post("/calculator/preview", requireAccess, (req, res) => {
  const truck = truckFromSettings(getSettings(req.user!.id));
  const input = loadInputFromForm(req.body);

  if (input.rateCents <= 0 || input.loadedMiles + input.deadheadMiles <= 0) {
    res.type("html").send(
      `<div class="card"><p class="muted" style="margin:0">Enter a rate and the miles to see the numbers.</p></div>`
    );
    return;
  }

  const math = calcLoad(input, truck);
  res.type("html").send(verdictBlock(math, targetRateCents(input, truck)).value);
});

calculatorRouter.post("/calculator/save", requireAccess, (req, res) => {
  const userId = req.user!.id;
  const s = getSettings(userId);
  const input = loadInputFromForm(req.body);
  const b = (k: string) => String(req.body[k] ?? "").trim();

  // Reports and the dashboard select loads by pickup date. A blank one sorts
  // below every window, so the load would quietly never appear in a quarter
  // again — default it to today rather than lose the load.
  const pickup = b("pickup_date") || todayISO();

  // A submission queued on the phone can be replayed after a flaky connection.
  // If this key has already been stored, show the load that was created rather
  // than making a second copy of it.
  const key = b("idempotency_key");
  const existing = findByIdempotencyKey("loads", userId, key);
  if (existing !== undefined) {
    res.redirect(`/loads/${existing}`);
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO loads (
         user_id, broker_name, load_number, origin_city, origin_state,
         dest_city, dest_state, pickup_date, delivery_date, rate_cents,
         loaded_miles, deadhead_miles, tolls_cents, other_costs_cents,
         transit_days, mpg, fuel_price_cents, fixed_cost_per_mile_cents,
         driver_pay_per_mile_cents, status, idempotency_key
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'booked', ?)`
    )
    .run(
      userId,
      b("broker_name"),
      b("load_number"),
      b("origin_city"),
      b("origin_state"),
      b("dest_city"),
      b("dest_state"),
      pickup,
      b("delivery_date"),
      input.rateCents,
      input.loadedMiles,
      input.deadheadMiles,
      input.tollsCents,
      input.otherCostsCents,
      input.transitDays,
      s.mpg,
      s.fuel_price_cents,
      s.fixed_cost_per_mile_cents,
      s.driver_pay_per_mile_cents,
      key || null
    );

  res.redirect(`/loads/${info.lastInsertRowid}`);
});
