import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DATABASE_PATH ?? "./data/haulmath.db";

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash       TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  trial_ends_at       TEXT NOT NULL,
  stripe_customer_id  TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  subscription_ends_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- One row per user. Holds the truck's cost basis plus the letterhead details
-- that go on an invoice.
CREATE TABLE IF NOT EXISTS settings (
  user_id                      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name                 TEXT NOT NULL DEFAULT '',
  company_address              TEXT NOT NULL DEFAULT '',
  company_phone                TEXT NOT NULL DEFAULT '',
  company_email                TEXT NOT NULL DEFAULT '',
  mc_number                    TEXT NOT NULL DEFAULT '',
  dot_number                   TEXT NOT NULL DEFAULT '',
  mpg                          REAL NOT NULL DEFAULT 6.5,
  fuel_price_cents             INTEGER NOT NULL DEFAULT 380,
  fixed_cost_per_mile_cents    INTEGER NOT NULL DEFAULT 65,
  driver_pay_per_mile_cents    INTEGER NOT NULL DEFAULT 0,
  target_profit_per_mile_cents INTEGER NOT NULL DEFAULT 30,
  next_invoice_number          INTEGER NOT NULL DEFAULT 1001
);

-- Cost inputs are copied onto the load when it is saved. Fuel price moves
-- every week; without the snapshot, last quarter's profit would silently
-- rewrite itself every time he updates his settings.
CREATE TABLE IF NOT EXISTS loads (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_name               TEXT NOT NULL DEFAULT '',
  broker_email              TEXT NOT NULL DEFAULT '',
  load_number               TEXT NOT NULL DEFAULT '',
  origin_city               TEXT NOT NULL DEFAULT '',
  origin_state              TEXT NOT NULL DEFAULT '',
  dest_city                 TEXT NOT NULL DEFAULT '',
  dest_state                TEXT NOT NULL DEFAULT '',
  pickup_date               TEXT NOT NULL DEFAULT '',
  delivery_date             TEXT NOT NULL DEFAULT '',
  rate_cents                INTEGER NOT NULL DEFAULT 0,
  loaded_miles              REAL NOT NULL DEFAULT 0,
  deadhead_miles            REAL NOT NULL DEFAULT 0,
  tolls_cents               INTEGER NOT NULL DEFAULT 0,
  other_costs_cents         INTEGER NOT NULL DEFAULT 0,
  transit_days              REAL NOT NULL DEFAULT 1,
  mpg                       REAL NOT NULL DEFAULT 6.5,
  fuel_price_cents          INTEGER NOT NULL DEFAULT 380,
  fixed_cost_per_mile_cents INTEGER NOT NULL DEFAULT 65,
  driver_pay_per_mile_cents INTEGER NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'booked',
  notes                     TEXT NOT NULL DEFAULT '',
  created_at                TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loads_user ON loads(user_id, pickup_date DESC);

-- IFTA is reported per state, so miles have to be split per state.
CREATE TABLE IF NOT EXISTS load_state_miles (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  load_id INTEGER NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  state   TEXT NOT NULL,
  miles   REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_state_miles_load ON load_state_miles(load_id);

-- Fuel rows carry state + gallons so they feed the IFTA report. Everything
-- else is just tax-deductible spend.
CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  category     TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  state        TEXT NOT NULL DEFAULT '',
  gallons      REAL NOT NULL DEFAULT 0,
  load_id      INTEGER REFERENCES loads(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id, date DESC);

CREATE TABLE IF NOT EXISTS invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  load_id        INTEGER NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  issued_date    TEXT NOT NULL,
  due_date       TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'sent',
  paid_date      TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, issued_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_load ON invoices(load_id);
`);

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
  trial_ends_at: string;
  stripe_customer_id: string | null;
  subscription_status: string;
  subscription_ends_at: string | null;
}

export interface SettingsRow {
  user_id: number;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  mc_number: string;
  dot_number: string;
  mpg: number;
  fuel_price_cents: number;
  fixed_cost_per_mile_cents: number;
  driver_pay_per_mile_cents: number;
  target_profit_per_mile_cents: number;
  next_invoice_number: number;
}

export interface LoadRow {
  id: number;
  user_id: number;
  broker_name: string;
  broker_email: string;
  load_number: string;
  origin_city: string;
  origin_state: string;
  dest_city: string;
  dest_state: string;
  pickup_date: string;
  delivery_date: string;
  rate_cents: number;
  loaded_miles: number;
  deadhead_miles: number;
  tolls_cents: number;
  other_costs_cents: number;
  transit_days: number;
  mpg: number;
  fuel_price_cents: number;
  fixed_cost_per_mile_cents: number;
  driver_pay_per_mile_cents: number;
  status: string;
  notes: string;
  created_at: string;
}

export interface ExpenseRow {
  id: number;
  user_id: number;
  date: string;
  category: string;
  description: string;
  amount_cents: number;
  state: string;
  gallons: number;
  load_id: number | null;
  created_at: string;
}

export interface InvoiceRow {
  id: number;
  user_id: number;
  load_id: number;
  invoice_number: string;
  issued_date: string;
  due_date: string;
  amount_cents: number;
  status: string;
  paid_date: string;
  created_at: string;
}

export function getSettings(userId: number): SettingsRow {
  let row = db
    .prepare("SELECT * FROM settings WHERE user_id = ?")
    .get(userId) as SettingsRow | undefined;
  if (!row) {
    db.prepare("INSERT INTO settings (user_id) VALUES (?)").run(userId);
    row = db.prepare("SELECT * FROM settings WHERE user_id = ?").get(userId) as SettingsRow;
  }
  return row;
}

/** Cost basis as it stood when the load was saved. */
export function truckFromLoad(load: LoadRow, targetProfitPerMileCents: number) {
  return {
    mpg: load.mpg,
    fuelPriceCents: load.fuel_price_cents,
    fixedCostPerMileCents: load.fixed_cost_per_mile_cents,
    driverPayPerMileCents: load.driver_pay_per_mile_cents,
    targetProfitPerMileCents,
  };
}

export function truckFromSettings(s: SettingsRow) {
  return {
    mpg: s.mpg,
    fuelPriceCents: s.fuel_price_cents,
    fixedCostPerMileCents: s.fixed_cost_per_mile_cents,
    driverPayPerMileCents: s.driver_pay_per_mile_cents,
    targetProfitPerMileCents: s.target_profit_per_mile_cents,
  };
}

export function loadInputFrom(load: LoadRow) {
  return {
    rateCents: load.rate_cents,
    loadedMiles: load.loaded_miles,
    deadheadMiles: load.deadhead_miles,
    tollsCents: load.tolls_cents,
    otherCostsCents: load.other_costs_cents,
    transitDays: load.transit_days,
  };
}
