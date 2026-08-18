/**
 * Load profitability math.
 *
 * Everything here is pure and money is handled in whole cents to avoid the
 * floating point drift you get from adding up dollars all day. Miles and
 * gallons stay as floats — nobody bills to the thousandth of a mile.
 */

export interface TruckSettings {
  /** Average loaded+empty fuel economy for the truck. */
  mpg: number;
  /** Pump price per gallon, in cents. */
  fuelPriceCents: number;
  /**
   * Fixed cost per mile in cents: truck note, insurance, permits, ELD,
   * phone, accounting — everything you pay whether the wheels turn or not,
   * divided by the miles you actually run in a month.
   */
  fixedCostPerMileCents: number;
  /** Driver pay in cents per mile. Zero when the owner drives it himself. */
  driverPayPerMileCents: number;
  /** Minimum profit per mile, in cents, worth turning a wheel for. */
  targetProfitPerMileCents: number;
}

export interface LoadInput {
  /** What the broker pays, in cents. */
  rateCents: number;
  /** Miles under load, pickup to delivery. */
  loadedMiles: number;
  /** Empty miles to get to the pickup. */
  deadheadMiles: number;
  /** Tolls, in cents. */
  tollsCents: number;
  /** Lumper, scale, detention advance, permits — anything else, in cents. */
  otherCostsCents: number;
  /** Days the load ties up the truck. Used for revenue-per-day only. */
  transitDays: number;
}

export type Verdict = "take" | "thin" | "pass";

export interface LoadMath {
  totalMiles: number;
  deadheadPct: number;
  gallons: number;
  fuelCents: number;
  driverPayCents: number;
  fixedCostCents: number;
  tollsCents: number;
  otherCostsCents: number;
  totalCostCents: number;
  netProfitCents: number;
  /** Rate divided by every mile you drive, loaded and empty. The honest one. */
  allInRatePerMileCents: number;
  /** Rate divided by loaded miles only. The number brokers quote. */
  loadedRatePerMileCents: number;
  profitPerMileCents: number;
  /** The rate at which this load exactly breaks even. */
  breakEvenRateCents: number;
  netProfitPerDayCents: number;
  verdict: Verdict;
}

const round = (n: number) => Math.round(n);

export function calcLoad(load: LoadInput, truck: TruckSettings): LoadMath {
  const totalMiles = load.loadedMiles + load.deadheadMiles;

  // A load with no miles has no fuel burn and no per-mile costs. Guard the
  // divisions rather than handing back NaN, which would render as blank
  // boxes on the phone and look like the app is broken.
  const gallons = truck.mpg > 0 ? totalMiles / truck.mpg : 0;
  const fuelCents = round(gallons * truck.fuelPriceCents);
  const driverPayCents = round(totalMiles * truck.driverPayPerMileCents);
  const fixedCostCents = round(totalMiles * truck.fixedCostPerMileCents);

  const totalCostCents =
    fuelCents +
    driverPayCents +
    fixedCostCents +
    load.tollsCents +
    load.otherCostsCents;

  const netProfitCents = load.rateCents - totalCostCents;

  const allInRatePerMileCents =
    totalMiles > 0 ? round(load.rateCents / totalMiles) : 0;
  const loadedRatePerMileCents =
    load.loadedMiles > 0 ? round(load.rateCents / load.loadedMiles) : 0;
  const profitPerMileCents =
    totalMiles > 0 ? round(netProfitCents / totalMiles) : 0;
  const netProfitPerDayCents =
    load.transitDays > 0 ? round(netProfitCents / load.transitDays) : netProfitCents;

  let verdict: Verdict;
  if (netProfitCents < 0) verdict = "pass";
  else if (profitPerMileCents < truck.targetProfitPerMileCents) verdict = "thin";
  else verdict = "take";

  return {
    totalMiles,
    deadheadPct: totalMiles > 0 ? (load.deadheadMiles / totalMiles) * 100 : 0,
    gallons,
    fuelCents,
    driverPayCents,
    fixedCostCents,
    tollsCents: load.tollsCents,
    otherCostsCents: load.otherCostsCents,
    totalCostCents,
    netProfitCents,
    allInRatePerMileCents,
    loadedRatePerMileCents,
    profitPerMileCents,
    breakEvenRateCents: totalCostCents,
    netProfitPerDayCents,
    verdict,
  };
}

/**
 * The rate to ask for to clear the target profit per mile. This is the number
 * to counter a broker with, not the number to accept.
 */
export function targetRateCents(load: LoadInput, truck: TruckSettings): number {
  const math = calcLoad(load, truck);
  return math.totalCostCents + round(math.totalMiles * truck.targetProfitPerMileCents);
}
