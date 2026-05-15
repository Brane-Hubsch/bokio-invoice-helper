import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const BACKGROUND_SCRIPT = resolve(ROOT, "src/background.js");
const MANIFEST = resolve(ROOT, "manifest.json");

async function loadBackgroundHelpers() {
  const code = await readFile(BACKGROUND_SCRIPT, "utf8");
  const sandbox = { URL };

  vm.runInNewContext(code, sandbox);

  return sandbox.__bokioInvoiceHelperBackground;
}

test("uses the active icon on app.bokio.se pages", async () => {
  const helpers = await loadBackgroundHelpers();

  assert.equal(helpers.isActiveUrl("https://app.bokio.se/company-id"), true);
  assert.equal(
    helpers.iconPathsForUrl("https://app.bokio.se/company-id")[16],
    "icons/icon-16.png"
  );
});

test("uses the inactive icon outside app.bokio.se", async () => {
  const helpers = await loadBackgroundHelpers();

  assert.equal(helpers.isActiveUrl("https://bokio.se/"), false);
  assert.equal(helpers.isActiveUrl("http://app.bokio.se/company-id"), false);
  assert.equal(helpers.isActiveUrl("chrome://extensions"), false);
  assert.equal(
    helpers.iconPathsForUrl("https://bokio.se/")[16],
    "icons/icon-inactive-16.png"
  );
});

test("manifest declares toolbar icon assets that exist", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));

  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.equal(manifest.host_permissions.includes("https://app.bokio.se/*"), true);

  for (const iconPath of Object.values(manifest.action.default_icon)) {
    assert.equal(existsSync(resolve(ROOT, iconPath)), true, `${iconPath} should exist`);
  }
});
