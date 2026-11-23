import { test } from "node:test";
import assert from "node:assert/strict";
import { accessFor, parseCompEmails, type BillingConfig } from "../src/access.ts";

const NOW = Date.parse("2026-11-22T12:00:00Z");
const DAY = 864e5;

const user = (overrides: Partial<{ email: string; trial_ends_at: string; subscription_status: string }> = {}) => ({
  email: "driver@example.com",
  trial_ends_at: new Date(NOW - 30 * DAY).toISOString(), // trial long gone
  subscription_status: "trialing",
  ...overrides,
});

const off: BillingConfig = { enabled: false, compEmails: new Set() };
const on: BillingConfig = { enabled: true, compEmails: new Set() };

test("billing off: an expired trial never locks anyone out", () => {
  // The bug this guards: with no Stripe keys there is no way to pay, so the
  // old gate stranded every account on a billing page after 14 days.
  const a = accessFor(user(), off, NOW);
  assert.equal(a.allowed, true);
  assert.equal(a.reason, "free");
});

test("billing on: an expired trial is locked out", () => {
  const a = accessFor(user(), on, NOW);
  assert.equal(a.allowed, false);
  assert.equal(a.reason, "trial_expired");
});

test("billing on: a live trial gets in and reports days left", () => {
  const a = accessFor(user({ trial_ends_at: new Date(NOW + 3 * DAY).toISOString() }), on, NOW);
  assert.equal(a.allowed, true);
  assert.equal(a.reason, "trial");
  assert.equal(a.trialDaysLeft, 3);
});

test("comp email stays free once billing is switched on, whatever its case", () => {
  const config: BillingConfig = { enabled: true, compEmails: parseCompEmails(" Driver@Example.com , other@x.com") };
  const a = accessFor(user({ email: "driver@EXAMPLE.com" }), config, NOW);
  assert.equal(a.allowed, true);
  assert.equal(a.reason, "comp");
  assert.equal(accessFor(user({ email: "someone@else.com" }), config, NOW).allowed, false);
});

test("subscribed and past_due both get in; canceled does not", () => {
  assert.equal(accessFor(user({ subscription_status: "active" }), on, NOW).reason, "subscribed");
  assert.equal(accessFor(user({ subscription_status: "past_due" }), on, NOW).allowed, true);
  const canceled = accessFor(user({ subscription_status: "canceled" }), on, NOW);
  assert.equal(canceled.allowed, false);
  assert.equal(canceled.reason, "canceled");
});

test("parseCompEmails ignores blanks and stray commas", () => {
  assert.deepEqual([...parseCompEmails(",, a@b.com ,,")], ["a@b.com"]);
  assert.equal(parseCompEmails(undefined).size, 0);
});
