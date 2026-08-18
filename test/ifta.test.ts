import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIfta, quarterRange, currentQuarter } from "../src/ifta.ts";

test("quarter ranges cover the right months", () => {
  assert.deepEqual(quarterRange(2026, 1), { from: "2026-01-01", to: "2026-03-31" });
  assert.deepEqual(quarterRange(2026, 2), { from: "2026-04-01", to: "2026-06-30" });
  assert.deepEqual(quarterRange(2026, 4), { from: "2026-10-01", to: "2026-12-31" });
});

test("current quarter maps months correctly", () => {
  assert.deepEqual(currentQuarter(new Date("2026-03-18T00:00:00Z")), { year: 2026, quarter: 1 });
  assert.deepEqual(currentQuarter(new Date("2026-12-31T00:00:00Z")), { year: 2026, quarter: 4 });
});

test("fleet mpg drives taxable gallons per state", () => {
  const r = buildIfta({
    year: 2026,
    quarter: 1,
    // 6,000 miles total
    stateMiles: [
      { state: "KS", miles: 3000 },
      { state: "CO", miles: 2000 },
      { state: "NE", miles: 1000 },
    ],
    // 1,000 gallons total -> fleet mpg exactly 6.0
    fuel: [
      { state: "KS", gallons: 900 },
      { state: "CO", gallons: 100 },
    ],
    totalLoadMiles: 6000,
  });

  assert.equal(r.totalMiles, 6000);
  assert.equal(r.totalGallons, 1000);
  assert.equal(r.fleetMpg, 6);

  const ks = r.rows.find((x) => x.state === "KS")!;
  assert.equal(ks.taxableGallons, 500);       // 3000 / 6
  assert.equal(ks.netGallons, -400);          // bought 900, burned 500 -> credit

  const ne = r.rows.find((x) => x.state === "NE")!;
  assert.equal(ne.gallonsPurchased, 0);
  assert.equal(ne.netGallons, 1000 / 6);      // ran it, bought nothing -> owes
});

test("net gallons across all states cancel out", () => {
  const r = buildIfta({
    year: 2026, quarter: 1,
    stateMiles: [{ state: "KS", miles: 1200 }, { state: "MO", miles: 800 }],
    fuel: [{ state: "KS", gallons: 250 }, { state: "MO", gallons: 150 }],
    totalLoadMiles: 2000,
  });
  const sum = r.rows.reduce((a, x) => a + x.netGallons, 0);
  assert.ok(Math.abs(sum) < 1e-9, `expected ~0, got ${sum}`);
});

test("flags miles that were never split by state", () => {
  const r = buildIfta({
    year: 2026, quarter: 1,
    stateMiles: [{ state: "KS", miles: 400 }],
    fuel: [], totalLoadMiles: 1000,
  });
  assert.equal(r.unallocatedMiles, 600);
  assert.equal(r.fleetMpg, 0); // no fuel logged, so no MPG to report
});

test("fuel bought in a state never driven still shows up", () => {
  const r = buildIfta({
    year: 2026, quarter: 1,
    stateMiles: [{ state: "KS", miles: 600 }],
    fuel: [{ state: "OK", gallons: 100 }],
    totalLoadMiles: 600,
  });
  assert.ok(r.rows.some((x) => x.state === "OK"));
});
