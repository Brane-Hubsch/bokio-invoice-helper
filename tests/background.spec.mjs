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

async function loadBackgroundWithChromeMock({ queryTabs = [] } = {}) {
  const code = await readFile(BACKGROUND_SCRIPT, "utf8");
  const calls = [];
  const scriptCalls = [];
  let installedListener;
  let messageListener;

  const chrome = {
    action: {
      setIcon(options) {
        calls.push(options);
        return Promise.resolve();
      }
    },
    runtime: {
      onInstalled: {
        addListener(listener) {
          installedListener = listener;
        }
      },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      },
      onStartup: { addListener() {} }
    },
    tabs: {
      get() {},
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
      query(options) {
        if (options?.url) {
          return Promise.resolve(queryTabs);
        }

        return Promise.resolve([]);
      }
    },
    scripting: {
      executeScript(options) {
        scriptCalls.push(options);
        return Promise.resolve();
      }
    }
  };

  vm.runInNewContext(code, { chrome, URL });

  return { calls, installedListener, messageListener, scriptCalls };
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
  assert.equal(manifest.permissions.includes("tabs"), true);
  assert.equal(manifest.permissions.includes("scripting"), true);
  assert.equal(manifest.host_permissions.includes("https://app.bokio.se/*"), true);
  assert.equal(
    manifest.content_scripts.some(
      (script) =>
        script.matches.includes("https://app.bokio.se/*") &&
        script.js.includes("src/icon-state.js")
    ),
    true
  );
  assert.equal(
    manifest.content_scripts.some(
      (script) =>
        script.matches.includes("https://app.bokio.se/*") &&
        script.js.includes("src/content.js")
    ),
    true
  );

  for (const iconPath of Object.values(manifest.action.default_icon)) {
    assert.equal(existsSync(resolve(ROOT, iconPath)), true, `${iconPath} should exist`);
  }
});

test("sets the active icon when app.bokio.se announces its tab", async () => {
  const { calls, messageListener } = await loadBackgroundWithChromeMock();

  messageListener(
    { type: "bokio-invoice-helper:app-tab" },
    { tab: { id: 12 }, url: "https://app.bokio.se/company-id" }
  );

  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), {
    tabId: 12,
    path: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png"
    }
  });
});

test("injects helper scripts into existing Bokio tabs on install", async () => {
  const { installedListener, scriptCalls } = await loadBackgroundWithChromeMock({
    queryTabs: [{ id: 7, url: "https://app.bokio.se/company-id/invoicing/invoices/" }]
  });

  installedListener();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(JSON.parse(JSON.stringify(scriptCalls)), [
    {
      target: { tabId: 7 },
      files: ["src/icon-state.js", "src/content.js"]
    }
  ]);
});
