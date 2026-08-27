/**
 * Generates the PWA / Android launcher icons.
 *
 * There is no image tooling in this project on purpose — icons are drawn from
 * geometry and encoded straight to PNG with node:zlib, so `npm run icons`
 * reproduces them anywhere Node runs. Re-run it after changing BRAND.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BRAND = { bg: [20, 96, 122], ink: [255, 255, 255] };

// ---- PNG encoding ---------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8ClampedArray of size*size*4 */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  // 10..12 stay 0: deflate, adaptive filtering, no interlace

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const off = y * (size * 4 + 1);
    raw[off] = 0;
    for (let x = 0; x < size * 4; x++) raw[off + 1 + x] = rgba[y * size * 4 + x];
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- drawing --------------------------------------------------------------

/**
 * Shapes are described in a 0..1 unit square and sampled with a 4x4 grid per
 * pixel, which is enough antialiasing for wheels and rounded corners to read
 * cleanly at 48px on a launcher.
 */
const SS = 4;

const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

const roundRect = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

const union = (...fns) => (x, y) => fns.some((f) => f(x, y));
const without = (a, b) => (x, y) => a(x, y) && !b(x, y);

/**
 * A right-facing semi: trailer, sleeper cab, hood, and three wheels, sitting on
 * a road line. `inset` shrinks the whole drawing toward the centre so the
 * maskable variant survives Android's circular crop.
 */
function truck(inset) {
  const m = (v) => 0.5 + (v - 0.5) * inset;
  const box = (x0, y0, x1, y1, r) => roundRect(m(x0), m(y0), m(x1), m(y1), r * inset);
  const wheel = (cx, cy, r) => circle(m(cx), m(cy), r * inset);

  const body = union(
    box(0.10, 0.30, 0.60, 0.60, 0.025),  // trailer
    box(0.62, 0.28, 0.80, 0.60, 0.030),  // sleeper cab
    box(0.80, 0.42, 0.90, 0.60, 0.025)   // hood
  );

  const wheels = union(
    wheel(0.22, 0.655, 0.070),
    wheel(0.40, 0.655, 0.070),
    wheel(0.79, 0.655, 0.070)
  );

  // Punch the hubs out so the wheels read as wheels, not blobs.
  const hubs = union(
    wheel(0.22, 0.655, 0.026),
    wheel(0.40, 0.655, 0.026),
    wheel(0.79, 0.655, 0.026)
  );

  const road = box(0.08, 0.760, 0.92, 0.800, 0.020);

  return without(union(body, wheels, road), hubs);
}

function render(size, { maskable }) {
  const rgba = new Uint8ClampedArray(size * size * 4);
  // Maskable icons must fill the whole canvas; Android crops them to whatever
  // shape the launcher uses. Standard icons get a rounded plate instead.
  const plate = maskable ? () => true : roundRect(0.02, 0.02, 0.98, 0.98, 0.22);
  const shape = truck(maskable ? 0.72 : 0.92);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let inPlate = 0;
      let inInk = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          if (plate(x, y)) {
            inPlate++;
            if (shape(x, y)) inInk++;
          }
        }
      }
      const total = SS * SS;
      const alpha = inPlate / total;
      const ink = inInk / total;

      const i = (py * size + px) * 4;
      if (alpha === 0) continue;

      // Composite ink over background, then apply the plate's own coverage.
      const t = alpha > 0 ? ink / alpha : 0;
      for (let c = 0; c < 3; c++) {
        rgba[i + c] = BRAND.bg[c] + (BRAND.ink[c] - BRAND.bg[c]) * t;
      }
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync("public/icons", { recursive: true });

const OUTPUTS = [
  ["public/icons/icon-192.png", 192, { maskable: false }],
  ["public/icons/icon-512.png", 512, { maskable: false }],
  ["public/icons/icon-maskable-512.png", 512, { maskable: true }],
  ["public/icons/apple-touch-icon.png", 180, { maskable: true }],
];

for (const [path, size, opts] of OUTPUTS) {
  const png = render(size, opts);
  writeFileSync(path, png);
  console.log(`${path}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
