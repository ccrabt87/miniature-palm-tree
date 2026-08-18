/**
 * IFTA quarterly rollup.
 *
 * The return itself is per-jurisdiction: miles run in that state, gallons
 * bought in that state, and the difference between gallons burned there and
 * gallons purchased there. A positive net means you burned more than you
 * bought and owe that state; negative means you bought more and are due a
 * credit. Actual dollars depend on each state's tax rate for the quarter,
 * which changes quarterly and is not baked in here.
 */

export interface StateRow {
  state: string;
  miles: number;
  gallonsPurchased: number;
  /** Miles in this state divided by the fleet's average MPG for the quarter. */
  taxableGallons: number;
  /** taxableGallons - gallonsPurchased. Positive = short, negative = credit. */
  netGallons: number;
}

export interface IftaReport {
  quarter: string;
  from: string;
  to: string;
  totalMiles: number;
  totalGallons: number;
  /** Total miles over total gallons — the number the return asks for. */
  fleetMpg: number;
  rows: StateRow[];
  /** True when miles were logged but not split by state; the report is short. */
  unallocatedMiles: number;
}

export function quarterRange(year: number, quarter: number): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3;
  const from = new Date(Date.UTC(year, startMonth, 1));
  const to = new Date(Date.UTC(year, startMonth + 3, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function currentQuarter(d = new Date()): { year: number; quarter: number } {
  return { year: d.getUTCFullYear(), quarter: Math.floor(d.getUTCMonth() / 3) + 1 };
}

export function buildIfta(input: {
  year: number;
  quarter: number;
  stateMiles: { state: string; miles: number }[];
  fuel: { state: string; gallons: number }[];
  /** Every mile on loads in the quarter, split or not. */
  totalLoadMiles: number;
}): IftaReport {
  const { from, to } = quarterRange(input.year, input.quarter);

  const byState = new Map<string, { miles: number; gallons: number }>();
  const bump = (state: string, miles: number, gallons: number) => {
    const key = state.toUpperCase();
    const cur = byState.get(key) ?? { miles: 0, gallons: 0 };
    cur.miles += miles;
    cur.gallons += gallons;
    byState.set(key, cur);
  };

  for (const r of input.stateMiles) if (r.state) bump(r.state, r.miles, 0);
  for (const f of input.fuel) if (f.state) bump(f.state, 0, f.gallons);

  const totalMiles = [...byState.values()].reduce((a, r) => a + r.miles, 0);
  const totalGallons = [...byState.values()].reduce((a, r) => a + r.gallons, 0);

  // The return uses one fleet-wide MPG for the quarter, not per-state.
  const fleetMpg = totalGallons > 0 ? totalMiles / totalGallons : 0;

  const rows: StateRow[] = [...byState.entries()]
    .map(([state, r]) => {
      const taxableGallons = fleetMpg > 0 ? r.miles / fleetMpg : 0;
      return {
        state,
        miles: r.miles,
        gallonsPurchased: r.gallons,
        taxableGallons,
        netGallons: taxableGallons - r.gallons,
      };
    })
    .sort((a, b) => a.state.localeCompare(b.state));

  return {
    quarter: `Q${input.quarter} ${input.year}`,
    from,
    to,
    totalMiles,
    totalGallons,
    fleetMpg,
    rows,
    unallocatedMiles: Math.max(0, input.totalLoadMiles - totalMiles),
  };
}
