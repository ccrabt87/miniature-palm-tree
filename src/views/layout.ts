import { html, raw, type Raw } from "./html.js";
import type { UserRow } from "../db.js";
import { checkAccess } from "../billing.js";

export const APP_NAME = "HaulMath";

interface LayoutOptions {
  title: string;
  user?: UserRow;
  active?: string;
  body: Raw;
  /** Full-bleed pages (login, invoice print view) skip the nav chrome. */
  bare?: boolean;
}

const NAV = [
  { href: "/", label: "Home", key: "home", icon: "■" },
  { href: "/calculator", label: "Rate Check", key: "calculator", icon: "$" },
  { href: "/loads", label: "Loads", key: "loads", icon: "≡" },
  { href: "/expenses", label: "Expenses", key: "expenses", icon: "⬤" },
  { href: "/reports", label: "Reports", key: "reports", icon: "▲" },
];

export function layout(opts: LayoutOptions): string {
  const { title, user, active, body, bare } = opts;

  // Bare pages are the printable invoice and the auth screens; neither wants
  // app chrome across the top.
  const banner = (() => {
    if (!user || bare) return raw("");
    const access = checkAccess(user);
    if (access.reason === "trial") {
      return html`<div class="banner">
        Free trial &mdash; ${access.trialDaysLeft}
        ${access.trialDaysLeft === 1 ? "day" : "days"} left.
        <a href="/billing">Subscribe</a>
      </div>`;
    }
    if (access.reason === "past_due") {
      return html`<div class="banner warn">
        Your last payment did not go through.
        <a href="/billing">Update card</a>
      </div>`;
    }
    return raw("");
  })();

  const nav = bare
    ? raw("")
    : html`<nav class="tabbar">
        ${NAV.map(
          (item) => html`<a
            href="${item.href}"
            class="${active === item.key ? "tab on" : "tab"}"
            ><span class="ico">${item.icon}</span>${item.label}</a
          >`
        )}
      </nav>`;

  const header = bare
    ? raw("")
    : html`<header class="topbar">
        <a class="brand" href="/">${APP_NAME}</a>
        <a class="gear" href="/settings" aria-label="Settings">Settings</a>
      </header>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${title} &middot; ${APP_NAME}</title>
<link rel="stylesheet" href="/app.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>%F0%9F%9A%9B</text></svg>">
</head>
<body class="${bare ? "bare" : ""}">
${header}
${banner}
<main>${body}</main>
${nav}
<script src="/app.js" defer></script>
</body>
</html>`;
}
