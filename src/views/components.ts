import { html, raw, type Raw } from "./html.js";
import { formatCents } from "../money.js";
import type { LoadMath } from "../calc.js";

export const money = (cents: number): Raw => html`$${formatCents(cents)}`;

export function fig(key: string, value: Raw | string, tone?: "good" | "bad"): Raw {
  return html`<div class="fig">
    <div class="k">${key}</div>
    <div class="v ${tone ?? ""}">${value}</div>
  </div>`;
}

const VERDICT_COPY: Record<string, { call: string; sum: string }> = {
  take: { call: "TAKE IT", sum: "Clears your target profit per mile." },
  thin: { call: "THIN", sum: "Makes money, but under your target. Try to negotiate." },
  pass: { call: "PASS", sum: "This load loses money once you count every cost." },
};

/**
 * The whole answer on one screen: the call, the money, and the rate to counter
 * with. Shown on the rate check and on every saved load.
 */
export function verdictBlock(m: LoadMath, askCents: number): Raw {
  const copy = VERDICT_COPY[m.verdict] ?? VERDICT_COPY.pass!;
  const tone = m.netProfitCents >= 0 ? "good" : "bad";

  return html`
    <div class="verdict ${m.verdict}">
      <div class="call">${copy.call}</div>
      <div class="sum">${copy.sum}</div>
    </div>

    <div class="figs">
      ${fig("Net profit", money(m.netProfitCents), tone)}
      ${fig("Profit / mile", money(m.profitPerMileCents), tone)}
      ${fig("All-in $/mile", money(m.allInRatePerMileCents))}
      ${fig("Total miles", html`${Math.round(m.totalMiles).toLocaleString("en-US")}`)}
    </div>

    <div class="card" style="margin-top:14px">
      <h2>Where the money goes</h2>
      <table>
        <tbody>
          <tr>
            <td>Fuel &mdash; ${m.gallons.toFixed(1)} gal</td>
            <td>${money(m.fuelCents)}</td>
          </tr>
          ${m.driverPayCents > 0
            ? html`<tr><td>Driver pay</td><td>${money(m.driverPayCents)}</td></tr>`
            : raw("")}
          <tr>
            <td>Fixed costs (note, insurance, permits)</td>
            <td>${money(m.fixedCostCents)}</td>
          </tr>
          ${m.tollsCents > 0
            ? html`<tr><td>Tolls</td><td>${money(m.tollsCents)}</td></tr>`
            : raw("")}
          ${m.otherCostsCents > 0
            ? html`<tr><td>Lumper / other</td><td>${money(m.otherCostsCents)}</td></tr>`
            : raw("")}
        </tbody>
        <tfoot>
          <tr><td>Total cost to run it</td><td>${money(m.totalCostCents)}</td></tr>
        </tfoot>
      </table>
      <p class="hint" style="margin-top:12px">
        Break even at ${money(m.breakEvenRateCents)}. Ask
        <strong>${money(askCents)}</strong> to hit your target.
        Deadhead is ${m.deadheadPct.toFixed(0)}% of the run.
        ${m.netProfitPerDayCents !== m.netProfitCents
          ? html` That is ${money(m.netProfitPerDayCents)} a day.`
          : raw("")}
      </p>
    </div>
  `;
}

export function statusPill(status: string): Raw {
  const label = status.replace(/_/g, " ");
  return html`<span class="pill ${status}">${label}</span>`;
}

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

export function stateSelect(name: string, selected: string, blankLabel = "—"): Raw {
  return html`<select name="${name}">
    <option value="">${blankLabel}</option>
    ${US_STATES.map(
      (s) => html`<option value="${s}" ${selected === s ? raw("selected") : raw("")}>${s}</option>`
    )}
  </select>`;
}

/** "Salina, KS" — but never a bare comma when one half is missing. */
export function place(city: string, state: string): string {
  const c = (city ?? "").trim();
  const st = (state ?? "").trim();
  if (c && st) return `${c}, ${st}`;
  return c || st || "\u2014";
}

/** "Salina, KS \u2192 Denver, CO" for a load's route. */
export function route(
  load: { origin_city: string; origin_state: string; dest_city: string; dest_state: string }
): string {
  return `${place(load.origin_city, load.origin_state)} \u2192 ${place(load.dest_city, load.dest_state)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
