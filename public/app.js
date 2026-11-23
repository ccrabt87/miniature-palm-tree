import { calcLoad, targetRateCents } from "./lib/calc.js";
import { parseMoneyToCents, parseNumber, formatCents } from "./lib/money.js";

// ---------------------------------------------------------------------------
// Storage helpers. Every access is guarded: localStorage throws outright in
// some privacy modes, and a dead rate check is worse than a forgetful one.
// ---------------------------------------------------------------------------

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* out of quota or blocked — carry on without persistence */
  }
}

const TRUCK_KEY = "haulmath.truck";
const OUTBOX_KEY = "haulmath.outbox";

// ---------------------------------------------------------------------------
// Truck settings
// ---------------------------------------------------------------------------

/**
 * The page embeds the driver's cost basis as JSON. It is mirrored into
 * localStorage so a cold start with no signal still computes real numbers
 * instead of silently falling back to defaults that flatter every load.
 */
function truckSettings() {
  const el = document.getElementById("truck-settings");
  if (el) {
    try {
      const fresh = JSON.parse(el.textContent);
      writeStore(TRUCK_KEY, fresh);
      return fresh;
    } catch {
      /* fall through to the cached copy */
    }
  }
  return readStore(TRUCK_KEY, null);
}

// ---------------------------------------------------------------------------
// Rate check — runs entirely on the phone
// ---------------------------------------------------------------------------

const money = (cents) => "$" + formatCents(cents);

const VERDICT_COPY = {
  take: { call: "TAKE IT", sum: "Clears your target profit per mile." },
  thin: { call: "THIN", sum: "Makes money, but under your target. Try to negotiate." },
  pass: { call: "PASS", sum: "This load loses money once you count every cost." },
};

function row(label, value) {
  return `<tr><td>${label}</td><td>${money(value)}</td></tr>`;
}

function renderVerdict(m, ask) {
  const copy = VERDICT_COPY[m.verdict];
  const tone = m.netProfitCents >= 0 ? "good" : "bad";

  return `
    <div class="verdict ${m.verdict}">
      <div class="call">${copy.call}</div>
      <div class="sum">${copy.sum}</div>
    </div>

    <div class="figs">
      <div class="fig"><div class="k">Net profit</div><div class="v ${tone}">${money(m.netProfitCents)}</div></div>
      <div class="fig"><div class="k">Profit / mile</div><div class="v ${tone}">${money(m.profitPerMileCents)}</div></div>
      <div class="fig"><div class="k">All-in $/mile</div><div class="v">${money(m.allInRatePerMileCents)}</div></div>
      <div class="fig"><div class="k">Total miles</div><div class="v">${Math.round(m.totalMiles).toLocaleString("en-US")}</div></div>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>Where the money goes</h2>
      <table>
        <tbody>
          ${row(`Fuel &mdash; ${m.gallons.toFixed(1)} gal`, m.fuelCents)}
          ${m.driverPayCents > 0 ? row("Driver pay", m.driverPayCents) : ""}
          ${row("Fixed costs (note, insurance, permits)", m.fixedCostCents)}
          ${m.tollsCents > 0 ? row("Tolls", m.tollsCents) : ""}
          ${m.otherCostsCents > 0 ? row("Lumper / other", m.otherCostsCents) : ""}
        </tbody>
        <tfoot><tr><td>Total cost to run it</td><td>${money(m.totalCostCents)}</td></tr></tfoot>
      </table>
      <p class="hint" style="margin-top:12px">
        Break even at ${money(m.breakEvenRateCents)}. Ask
        <strong>${money(ask)}</strong> to hit your target.
        Deadhead is ${m.deadheadPct.toFixed(0)}% of the run.
        ${m.netProfitPerDayCents !== m.netProfitCents
          ? ` That is ${money(m.netProfitPerDayCents)} a day.`
          : ""}
      </p>
    </div>
  `;
}

function initRateCheck() {
  const form = document.querySelector("[data-live-calc]");
  if (!form) return;

  const out = document.getElementById("calc-result");
  if (!out) return;

  const truck = truckSettings();
  if (!truck) return; // no cost basis cached yet; the server form still posts

  const field = (name) => form.elements.namedItem(name);
  const val = (name) => (field(name) ? field(name).value : "");

  function update() {
    const load = {
      rateCents: parseMoneyToCents(val("rate")),
      loadedMiles: parseNumber(val("loaded_miles")),
      deadheadMiles: parseNumber(val("deadhead_miles")),
      tollsCents: parseMoneyToCents(val("tolls")),
      otherCostsCents: parseMoneyToCents(val("other_costs")),
      transitDays: Math.max(0, parseNumber(val("transit_days"), 1)),
    };

    if (load.rateCents <= 0 || load.loadedMiles + load.deadheadMiles <= 0) {
      out.innerHTML =
        `<div class="card"><p class="muted" style="margin:0">` +
        `Enter a rate and the miles to see the numbers.</p></div>`;
      return;
    }

    out.innerHTML = renderVerdict(calcLoad(load, truck), targetRateCents(load, truck));
  }

  form.addEventListener("input", update);
  update();
}

// ---------------------------------------------------------------------------
// Outbox — hold writes made with no signal and replay them on reconnect
// ---------------------------------------------------------------------------

/**
 * Every queued submission carries a key the server dedupes on, so replaying
 * after a flaky connection can never create the same load twice.
 */
function newKey() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "k-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

const outbox = {
  all: () => readStore(OUTBOX_KEY, []),
  save: (items) => writeStore(OUTBOX_KEY, items),
  add(entry) {
    const items = this.all();
    items.push(entry);
    this.save(items);
  },
};

function showBadge() {
  const pending = outbox.all().length;
  let el = document.getElementById("offline-badge");

  if (!pending && navigator.onLine) {
    if (el) el.remove();
    return;
  }

  if (!el) {
    el = document.createElement("div");
    el.id = "offline-badge";
    el.className = "offline-badge";
    document.body.appendChild(el);
  }

  if (!navigator.onLine) {
    el.textContent = pending
      ? `Offline \u00b7 ${pending} saved on this phone`
      : "Offline \u2014 rate check still works";
  } else {
    el.textContent = `Sending ${pending}…`;
  }
}

async function flushOutbox() {
  if (!navigator.onLine) return;

  let items = outbox.all();
  if (!items.length) return;

  showBadge();

  const remaining = [];
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: item.body,
        redirect: "follow",
      });
      // 4xx means the server rejected it outright; retrying forever would jam
      // the queue, so drop it. 5xx and network errors are worth another go.
      if (!res.ok && res.status >= 500) remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }

  outbox.save(remaining);
  showBadge();

  if (remaining.length === 0 && items.length > 0) {
    // Pull in whatever the server now has, so the list reflects the sync.
    location.reload();
  }
}

/**
 * Queues a form instead of submitting it when the phone has no signal. Only
 * forms marked data-offline-ok take this path — status changes and deletes
 * still need the server.
 */
function initOfflineForms() {
  for (const form of document.querySelectorAll("form[data-offline-ok]")) {
    form.addEventListener("submit", (event) => {
      if (navigator.onLine) return;

      event.preventDefault();

      const data = new FormData(form);
      data.set("idempotency_key", newKey());

      outbox.add({
        url: form.getAttribute("action") || location.pathname,
        body: new URLSearchParams(data).toString(),
      });

      showBadge();
      form.reset();

      const note = document.createElement("div");
      note.className = "ok";
      note.textContent = "Saved on this phone. It will sync when you have signal.";
      form.prepend(note);
      setTimeout(() => note.remove(), 6000);
    });
  }
}

// ---------------------------------------------------------------------------

/** After a logout the previous account's cached pages must not survive. */
function purgeCacheIfSignedOut() {
  if (!new URLSearchParams(location.search).has("cleared")) return;
  navigator.serviceWorker?.controller?.postMessage("clear-cache");
  try {
    localStorage.removeItem(TRUCK_KEY);
  } catch {
    /* nothing to do */
  }
}

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* offline support is a bonus; never let it break the page */
  });
}

purgeCacheIfSignedOut();
initRateCheck();
initOfflineForms();
initServiceWorker();
showBadge();
flushOutbox();

window.addEventListener("online", flushOutbox);
window.addEventListener("offline", showBadge);
