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

async function loadBackgroundWithChromeMock({ activeTab } = {}) {
  const code = await readFile(BACKGROUND_SCRIPT, "utf8");
  const calls = [];
  const fetched = [];

  class FakeOffscreenCanvas {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.source = "";
    }

    getContext() {
      return {
        clearRect() {},
        drawImage: (bitmap) => {
          this.source = bitmap.source;
        },
        getImageData: () => ({
          source: this.source,
          width: this.width,
          height: this.height
        })
      };
    }
  }

  const chrome = {
    action: {
      setIcon(options, callback) {
        calls.push(options);

        if (callback) {
          callback();
        }
      }
    },
    runtime: {
      getURL(path) {
        return `chrome-extension://extension-id/${path}`;
      },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} }
    },
    tabs: {
      get() {},
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
      query() {
        return Promise.resolve(activeTab ? [activeTab] : []);
      }
    }
  };

  const sandbox = {
    chrome,
    createImageBitmap(blob) {
      return Promise.resolve({
        close() {},
        height: 850,
        source: blob.source,
        width: 850
      });
    },
    fetch(url) {
      fetched.push(url);

      return Promise.resolve({
        blob() {
          return Promise.resolve({ source: url });
        }
      });
    },
    OffscreenCanvas: FakeOffscreenCanvas,
    URL
  };

  vm.runInNewContext(code, sandbox);
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { calls, fetched };
}

function serialize(value) {
  return JSON.parse(JSON.stringify(value));
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

test("manifest keeps the icon feature route-scoped without troubleshooting scripts", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));

  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.equal(manifest.action.default_popup, "src/popup.html");
  assert.equal(existsSync(resolve(ROOT, manifest.action.default_popup)), true);
  assert.equal(manifest.permissions?.includes("tabs"), undefined);
  assert.equal(manifest.permissions?.includes("scripting"), undefined);
  assert.equal(manifest.host_permissions.includes("https://app.bokio.se/*"), true);
  assert.equal(existsSync(resolve(ROOT, "src/icon-state.js")), false);
  assert.equal(
    manifest.content_scripts.some((script) =>
      script.js.includes("src/icon-state.js")
    ),
    false
  );
  assert.equal(
    manifest.content_scripts.some(
      (script) =>
        script.matches.includes(
          "https://app.bokio.se/*/invoicing/invoices/edit/*"
        ) && script.js.includes("src/content.js")
    ),
    true
  );

  for (const iconPath of Object.values(manifest.icons)) {
    assert.match(iconPath, /^icons\/store-icon-\d+\.png$/);
    assert.equal(existsSync(resolve(ROOT, iconPath)), true, `${iconPath} should exist`);
  }

  for (const iconPath of Object.values(manifest.action.default_icon)) {
    assert.match(iconPath, /^icons\/icon-inactive-\d+\.png$/);
    assert.equal(existsSync(resolve(ROOT, iconPath)), true, `${iconPath} should exist`);
  }
});

test("sets active toolbar imageData for app.bokio.se tabs", async () => {
  const { calls, fetched } = await loadBackgroundWithChromeMock({
    activeTab: { id: 12, url: "https://app.bokio.se/company-id" }
  });
  const call = serialize(calls.at(-1));

  assert.equal(call.tabId, 12);
  assert.equal(call.path, undefined);
  assert.equal(
    call.imageData[16].source,
    "chrome-extension://extension-id/icons/icon-16.png"
  );
  assert.equal(call.imageData[128].width, 128);
  assert.equal(
    fetched.includes("chrome-extension://extension-id/icons/icon-16.png"),
    true
  );
});

test("sets inactive toolbar imageData outside app.bokio.se", async () => {
  const { calls, fetched } = await loadBackgroundWithChromeMock({
    activeTab: { id: 13, url: "https://bokio.se/" }
  });
  const call = serialize(calls.at(-1));

  assert.equal(call.tabId, 13);
  assert.equal(call.path, undefined);
  assert.equal(
    call.imageData[16].source,
    "chrome-extension://extension-id/icons/icon-inactive-16.png"
  );
  assert.equal(call.imageData[128].height, 128);
  assert.equal(
    fetched.includes("chrome-extension://extension-id/icons/icon-inactive-16.png"),
    true
  );
});
