import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = resolve(import.meta.dirname, "..");
const SOURCES = [
  {
    source: resolve(ROOT, "icons/source/store-icon.png"),
    outputName: "store-icon"
  },
  {
    source: resolve(ROOT, "icons/source/icon.png"),
    outputName: "icon"
  },
  {
    source: resolve(ROOT, "icons/source/icon-inactive.png"),
    outputName: "icon-inactive"
  }
];
const SIZES = [16, 32, 48, 128];

await mkdir(resolve(ROOT, "icons/source"), { recursive: true });
await mkdir(resolve(ROOT, "icons"), { recursive: true });

for (const { source: sourcePath, outputName } of SOURCES) {
  const source = await readFile(sourcePath);

  for (const size of SIZES) {
    await sharp(source)
      .resize(size, size)
      .png()
      .toFile(resolve(ROOT, `icons/${outputName}-${size}.png`));
  }
}

await writeFile(
  resolve(ROOT, "icons/README.md"),
  [
    "Generated with tools/generate-icons.mjs.",
    "",
    "- Store icons: icons/source/store-icon.png",
    "- Active icons: icons/source/icon.png",
    "- Inactive icons: icons/source/icon-inactive.png",
    ""
  ].join("\n")
);
