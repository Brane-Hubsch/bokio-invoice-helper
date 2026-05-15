import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "icons/source/favicon-32x32.png");
const SIZES = [16, 32, 48, 128];

function badgeSvg(size) {
  const badgeSize = Math.round(size * 0.47);
  const radius = Math.round(badgeSize / 2);
  const cx = size - radius - Math.max(1, Math.round(size * 0.04));
  const cy = cx;
  const plusStroke = Math.max(2, Math.round(size * 0.09));
  const arm = Math.round(badgeSize * 0.22);

  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#1259ef"/>
      <circle cx="${cx}" cy="${cy}" r="${radius - Math.max(1, Math.round(size * 0.03))}" fill="#1259ef" stroke="#ffffff" stroke-width="${Math.max(1, Math.round(size * 0.04))}"/>
      <path d="M ${cx - arm} ${cy} H ${cx + arm} M ${cx} ${cy - arm} V ${cy + arm}" stroke="#ffffff" stroke-width="${plusStroke}" stroke-linecap="round"/>
    </svg>
  `);
}

await mkdir(dirname(SOURCE), { recursive: true });
await mkdir(resolve(ROOT, "icons"), { recursive: true });

const source = await readFile(SOURCE);

for (const size of SIZES) {
  await sharp(source)
    .resize(size, size)
    .composite([{ input: badgeSvg(size), top: 0, left: 0 }])
    .png()
    .toFile(resolve(ROOT, `icons/icon-${size}.png`));
}

await writeFile(
  resolve(ROOT, "icons/README.md"),
  "Generated from Bokio favicon with tools/generate-icons.mjs.\n"
);
