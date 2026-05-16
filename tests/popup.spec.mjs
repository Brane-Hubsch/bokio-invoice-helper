import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import vm from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = resolve(import.meta.dirname, "..");
const POPUP_HTML = resolve(ROOT, "src/popup.html");
const POPUP_SCRIPT = resolve(ROOT, "src/popup.js");
const POPUP_FONT = resolve(ROOT, "src/fonts/pathway-extreme-extra-bold.ttf");
const ACTIVE_COPY =
  "Invoice Helper automatically selects PDF & link as the invoice delivery option on Bokio invoice pages.";
const INACTIVE_COPY =
  "Invoice Helper only runs on Bokio.se";
const LOCAL_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
];

async function launchBrowser() {
  const executablePath = LOCAL_CHROME_PATHS.find((path) => existsSync(path));

  if (executablePath) {
    return chromium.launch({ executablePath });
  }

  return chromium.launch();
}

async function loadPopupHelpers() {
  const code = await readFile(POPUP_SCRIPT, "utf8");
  const sandbox = {
    document: {
      readyState: "complete",
      getElementById() {
        return null;
      }
    },
    URL
  };

  vm.runInNewContext(code, sandbox);

  return sandbox.__bokioInvoiceHelperPopup;
}

async function withPopup(activeTabUrl, callback, options = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.addInitScript(({ url, autoselectEmailDelivery }) => {
      window.__storageWrites = [];
      window.chrome = {
        tabs: {
          query() {
            return Promise.resolve([{ url }]);
          }
        },
        storage: {
          local: {
            get(defaults, callback) {
              callback({
                ...defaults,
                autoselectEmailDelivery: Boolean(autoselectEmailDelivery)
              });
            },
            set(items) {
              window.__storageWrites.push(items);
              return Promise.resolve();
            }
          }
        }
      };
    }, {
      url: activeTabUrl,
      autoselectEmailDelivery: options.autoselectEmailDelivery
    });

    await page.goto(pathToFileURL(POPUP_HTML).href);
    await callback(page);
  } finally {
    await browser.close();
  }
}

test("popup helpers choose active copy only for app.bokio.se", async () => {
  const helpers = await loadPopupHelpers();

  assert.equal(helpers.copyForUrl("https://app.bokio.se/company-id"), ACTIVE_COPY);
  assert.equal(helpers.copyForUrl("https://bokio.se/"), INACTIVE_COPY);
  assert.equal(helpers.copyForUrl("not a url"), INACTIVE_COPY);
  assert.equal(helpers.copyForUrl(undefined), INACTIVE_COPY);
});

test("popup renders the extension title in Pathway Extreme Extra Bold", async () => {
  assert.equal(existsSync(POPUP_FONT), true);

  await withPopup("https://app.bokio.se/company-id", async (page) => {
    const title = page.locator(".popup-title");

    assert.equal(await title.textContent(), "Invoice Helper for Bokio");
    assert.equal(await title.evaluate((node) => getComputedStyle(node).fontWeight), "800");
    assert.match(
      await title.evaluate((node) => getComputedStyle(node).fontFamily),
      /Pathway Extreme/
    );
    assert.equal(
      await title.evaluate((node) => node.scrollWidth <= node.clientWidth),
      true
    );
  });
});

test("popup shows active copy on app.bokio.se", async () => {
  await withPopup("https://app.bokio.se/company-id", async (page) => {
    await page.waitForFunction(
      (copy) => document.querySelector("#status-copy")?.textContent === copy,
      ACTIVE_COPY
    );

    assert.equal(await page.locator("#status-copy").textContent(), ACTIVE_COPY);
  });
});

test("popup shows inactive copy outside app.bokio.se", async () => {
  await withPopup("https://bokio.se/", async (page) => {
    assert.equal(await page.locator("#status-copy").textContent(), INACTIVE_COPY);
  });
});

test("popup renders an unchecked e-mail delivery toggle by default", async () => {
  await withPopup("https://app.bokio.se/company-id", async (page) => {
    const toggle = page.locator('input[type="checkbox"]');

    assert.equal(await toggle.count(), 1);
    assert.equal(await toggle.isChecked(), false);
    assert.equal(
      await toggle.getAttribute("aria-label"),
      "Autoselect E-mail delivery"
    );
    assert.match(
      await page.locator("label.toggle-row").textContent(),
      /Autoselect E-mail delivery/
    );
  });
});

test("popup reads the saved e-mail delivery toggle setting", async () => {
  await withPopup(
    "https://app.bokio.se/company-id",
    async (page) => {
      const toggle = page.locator('input[type="checkbox"]');

      await page.waitForFunction(
        () => document.querySelector('input[type="checkbox"]')?.checked
      );

      assert.equal(await toggle.isChecked(), true);
    },
    { autoselectEmailDelivery: true }
  );
});

test("popup saves e-mail delivery toggle changes", async () => {
  await withPopup("https://app.bokio.se/company-id", async (page) => {
    await page.locator("label.toggle-row").click();
    await page.waitForFunction(() => window.__storageWrites.length > 0);

    assert.deepEqual(await page.evaluate(() => window.__storageWrites.at(-1)), {
      autoselectEmailDelivery: true
    });
  });
});

test("popup includes creator link and Bokio disclaimer", async () => {
  await withPopup("", async (page) => {
    const link = page.locator('a[href="https://bh.studio"]');

    assert.equal(await link.textContent(), "Bräne Hübsch");
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
    assert.match(await page.locator(".footer").textContent(), /Created by\s+Bräne Hübsch/);
    assert.match(
      await page.locator(".footer").textContent(),
      /No affiliation with Bokio AB/
    );
  });
});
