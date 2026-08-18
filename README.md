# HaulMath

Load profitability, load book, invoicing and IFTA tracking for independent
truckers and small carriers.

The one thing it does that a notebook can't: before he commits to a load, it
tells him what that load actually pays *after* fuel, deadhead, and the fixed
costs the truck racks up whether it moves or not. Then it keeps the load,
invoices the broker, and rolls the quarter up for IFTA.

Built for a phone in a cab: big targets, numeric keypads, dark mode, no jargon.

---

## What's in it

**Rate check.** Enter the broker's rate and the miles. It answers
**TAKE IT / THIN / PASS**, shows net profit, profit per mile, all-in dollars
per mile, the break-even rate, and the rate to counter with to hit his target.
Updates live as he types.

**Load book.** Save any load he takes. Status runs booked → in transit →
delivered → invoiced → paid. Each load stores the cost basis *as it stood the
day it was booked*, so last quarter's profit doesn't silently change when fuel
prices move.

**Invoices.** One tap on a delivered load makes a numbered, printable invoice
on his letterhead with the load number, lane, dates and miles. Print or Save as
PDF from the browser. Mark paid when the money lands.

**Expenses.** Fuel, tires, repairs, permits, tolls — categorized the way a tax
preparer wants them. Fuel rows carry state and gallons so they feed IFTA.

**IFTA.** Per-state miles and gallons for any quarter, with taxable gallons
computed off the fleet average, plus net gallons owed or credited per state.
CSV export. It warns him when miles haven't been split by state yet, so the
return doesn't come out short.

It does not file anything with any agency, and it does not carry state tax
rates — those change quarterly. It produces the figures that go **onto** the
return.

---

## Running it

```bash
npm install
cp .env.example .env     # optional; it runs fine without one
npm run dev              # http://localhost:3000
```

Sign up, then go straight to **Settings** and put in the truck's real numbers.
Everything downstream depends on them:

| Setting | What it means | Typical |
|---|---|---|
| Miles per gallon | Real average, loaded and empty | 5.5 – 7.0 |
| Fuel price | What he's paying this week | market |
| **Fixed cost per mile** | Truck note + insurance + permits + ELD + phone + accounting, divided by monthly miles | **$0.50 – $0.80** |
| Driver pay per mile | 0 if he drives it himself | 0 |
| Target profit per mile | The line between TAKE IT and THIN | $0.25 – $0.50 |

Fixed cost per mile is the one people get wrong, and getting it wrong is the
whole ballgame — set it too low and the app will cheerfully green-light loads
that lose money.

### Other commands

```bash
npm test          # unit tests for the profit math and the IFTA rollup
npm run typecheck
npm run build && npm start
```

---

## Deploying

It's one Node process plus a SQLite file. Anywhere that runs a container and
gives you a persistent disk works — Railway, Render, Fly.io, or a $5 VPS.

```bash
docker build -t haulmath .
docker run -p 3000:3000 -v haulmath-data:/app/data --env-file .env haulmath
```

**The disk must persist.** SQLite lives in `DATABASE_PATH`. On a host without a
mounted volume, every redeploy wipes every customer's loads. Mount a volume and
point `DATABASE_PATH` inside it.

---

## Billing

Stripe is optional. With no keys set, the app runs and billing is disabled —
useful while it's just for one truck.

To charge for it:

1. Create a recurring product in Stripe, copy its **price ID** (`price_…`).
2. Add a webhook endpoint at `https://your-domain/webhook`, subscribed to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`.
3. Fill in `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`,
   and `PRICE_LABEL`.

New accounts get a 14-day trial. A failed payment flips the account to
`past_due` but **keeps it open** — locking a driver out mid-week over a declined
card is how you lose the customer, not how you collect.

---

## How it's put together

```
src/
  calc.ts          the profit math — pure, unit-tested
  ifta.ts          quarterly per-state rollup — pure, unit-tested
  money.ts         cents in, formatted strings out
  db.ts            SQLite schema and row types
  auth.ts          scrypt passwords, cookie sessions
  billing.ts       Stripe checkout, portal, webhooks, access gate
  routes/          one file per section of the app
  views/           escaped-by-default HTML templates
public/            stylesheet and the live-calc script
test/              tests for calc.ts and ifta.ts
```

Notes on the parts that matter:

- **Money is integer cents everywhere.** Dollars as floats drift once you start
  summing a quarter.
- **Templates escape by default.** The `html` tagged template escapes every
  interpolation unless it's explicitly wrapped in `raw()`.
- **Every query is scoped by `user_id`.** One account cannot read or delete
  another's rows, including by guessing IDs.
- **Loads snapshot their cost inputs.** Changing settings never rewrites
  history.
- **No AI, no external APIs.** It's arithmetic and records. Nothing to pay for
  per request, nothing to break when a vendor changes a model.

---

## If you extend it

The obvious next things, roughly in order of what a driver would pay for:

1. **Fuel-stop pricing** — cheapest diesel along the lane. Needs a paid data feed.
2. **Rate-per-mile history by lane** — he already has the data; it just needs a
   query and a chart.
3. **Maintenance and compliance reminders** — DOT inspection, UCR, IRP renewal,
   Form 2290. All date math, no new integrations.
4. **Emailing invoices to brokers** — currently print/PDF only.
5. **Photo attachments** — BOLs and fuel receipts on the load record.
