import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "icons/source/icon.png");
const SIZES = [16, 32, 48, 128];

await mkdir(dirname(SOURCE), { recursive: true });
await mkdir(resolve(ROOT, "icons"), { recursive: true });

const source = await readFile(SOURCE);

for (const size of SIZES) {
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(resolve(ROOT, `icons/icon-${size}.png`));
}

await writeFile(
  resolve(ROOT, "icons/README.md"),
  "Generated from icons/source/icon.png with tools/generate-icons.mjs.\n"
);
