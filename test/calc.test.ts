import { test } from "node:test";
import assert from "node:assert/strict";
import { calcLoad, targetRateCents, type TruckSettings, type LoadInput } from "../src/calc.ts";
import { parseMoneyToCents, formatCents } from "../src/money.ts";

const truck: TruckSettings = {
  mpg: 6.5,
  fuelPriceCents: 380,          // $3.80/gal
  fixedCostPerMileCents: 65,    // $0.65/mi
  driverPayPerMileCents: 0,     // owner drives it
  targetProfitPerMileCents: 30, // $0.30/mi
};

const base: LoadInput = {
  rateCents: 250000,  // $2,500
  loadedMiles: 900,
  deadheadMiles: 100,
  tollsCents: 0,
  otherCostsCents: 0,
  transitDays: 2,
};

test("computes fuel from total miles, not loaded miles", () => {
  const m = calcLoad(base, truck);
  assert.equal(m.totalMiles, 1000);
  // 1000 mi / 6.5 mpg = 153.846 gal * $3.80 = $584.62
  assert.equal(m.gallons.toFixed(3), "153.846");
  assert.equal(m.fuelCents, 58462);
});

test("separates all-in rate per mile from the broker's loaded number", () => {
  const m = calcLoad(base, truck);
  assert.equal(m.loadedRatePerMileCents, 278); // $2.78 — what the broker says
  assert.equal(m.allInRatePerMileCents, 250);  // $2.50 — what he actually gets
});

test("net profit subtracts fuel, fixed cost, tolls and extras", () => {
  const m = calcLoad({ ...base, tollsCents: 4200, otherCostsCents: 7500 }, truck);
  assert.equal(m.fixedCostCents, 65000);
  assert.equal(m.totalCostCents, 58462 + 65000 + 4200 + 7500);
  assert.equal(m.netProfitCents, 250000 - m.totalCostCents);
});

test("break-even rate equals total cost", () => {
  const m = calcLoad(base, truck);
  const atBreakEven = calcLoad({ ...base, rateCents: m.breakEvenRateCents }, truck);
  assert.equal(atBreakEven.netProfitCents, 0);
});

test("verdict is take / thin / pass around the target", () => {
  assert.equal(calcLoad(base, truck).verdict, "take");

  // Priced so it clears zero but not $0.30/mi.
  const costs = calcLoad(base, truck).totalCostCents;
  const thin = calcLoad({ ...base, rateCents: costs + 1000 }, truck);
  assert.equal(thin.verdict, "thin");

  const losing = calcLoad({ ...base, rateCents: costs - 1 }, truck);
  assert.equal(losing.verdict, "pass");
});

test("deadhead drags the load down", () => {
  const clean = calcLoad({ ...base, deadheadMiles: 0 }, truck);
  const dirty = calcLoad({ ...base, deadheadMiles: 250 }, truck);
  assert.ok(dirty.netProfitCents < clean.netProfitCents);
  assert.equal(Math.round(dirty.deadheadPct), 22);
});

test("driver pay comes out of the owner's cut", () => {
  const withDriver = calcLoad(base, { ...truck, driverPayPerMileCents: 60 });
  const owner = calcLoad(base, truck);
  assert.equal(withDriver.driverPayCents, 60000);
  assert.equal(owner.netProfitCents - withDriver.netProfitCents, 60000);
});

test("target rate is the number to counter with", () => {
  const ask = targetRateCents(base, truck);
  const m = calcLoad({ ...base, rateCents: ask }, truck);
  assert.equal(m.profitPerMileCents, truck.targetProfitPerMileCents);
  assert.equal(m.verdict, "take");
});

test("zero miles does not produce NaN", () => {
  const m = calcLoad({ ...base, loadedMiles: 0, deadheadMiles: 0 }, truck);
  for (const v of Object.values(m)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `got ${v}`);
  }
});

test("money parsing survives what people actually type", () => {
  assert.equal(parseMoneyToCents("$2,500.00"), 250000);
  assert.equal(parseMoneyToCents("2500"), 250000);
  assert.equal(parseMoneyToCents(" 1,234.5 "), 123450);
  assert.equal(parseMoneyToCents(""), 0);
  assert.equal(parseMoneyToCents("abc"), 0);
  assert.equal(formatCents(250000), "2,500.00");
  assert.equal(formatCents(-4205), "-42.05");
});
