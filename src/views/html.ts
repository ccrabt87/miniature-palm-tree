/** Tagged-template HTML with automatic escaping. */

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Wrapper marking a string as already-safe HTML so `html` will not escape it. */
export class Raw {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export const raw = (value: string): Raw => new Raw(value);

export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v instanceof Raw) out += v.value;
    else if (Array.isArray(v)) {
      out += v.map((item) => (item instanceof Raw ? item.value : escapeHtml(item))).join("");
    } else if (v === null || v === undefined || v === false) out += "";
    else out += escapeHtml(v);
    out += strings[i + 1] ?? "";
  }
  return new Raw(out);
}
