import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = resolve(import.meta.dirname, "..");
const CONTENT_SCRIPT = resolve(ROOT, "src/content.js");
const FIXTURE = resolve(ROOT, "fixtures/invoice-options.html");
const MATCHING_URL =
  "https://app.bokio.se/company-id/invoicing/invoices/edit/invoice-id/";
const OTHER_URL = "https://app.bokio.se/company-id/invoicing/invoices/";
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

async function withPage(url, bodyHtml, callback, options = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    if (Object.hasOwn(options, "autoselectEmailDelivery")) {
      await page.addInitScript((autoselectEmailDelivery) => {
        window.chrome = {
          storage: {
            local: {
              get(defaults, callback) {
                callback({
                  ...defaults,
                  autoselectEmailDelivery
                });
              }
            },
            onChanged: { addListener() {} }
          }
        };
      }, options.autoselectEmailDelivery);
    }

    await page.route("**/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: bodyHtml
      });
    });
    await page.goto(url);
    await page.addScriptTag({ path: CONTENT_SCRIPT });
    await callback(page);
  } finally {
    await browser.close();
  }
}

async function checkedValue(page) {
  return page.locator('input[name="emailDeliveryType"]:checked').inputValue();
}

async function checkedDeliveryMethod(page) {
  return page
    .locator('input[name="deliveryMethod"]:checked')
    .getAttribute("data-testid");
}

test("selects LinkAndPdf when email delivery options render on an invoice edit route", async () => {
  const bodyHtml = await readFile(FIXTURE, "utf8");

  await withPage(MATCHING_URL, bodyHtml, async (page) => {
    await page.waitForFunction(
      () =>
        document.querySelector(
          'input[name="emailDeliveryType"][value="LinkAndPdf"]'
        )?.checked
    );

    assert.equal(await checkedValue(page), "LinkAndPdf");
    assert.equal(await checkedDeliveryMethod(page), "EInvoiceDeliveryItem");
  });
});

test("selects EmailMethod delivery when the popup setting is enabled", async () => {
  const bodyHtml = await readFile(FIXTURE, "utf8");

  await withPage(
    MATCHING_URL,
    bodyHtml,
    async (page) => {
      await page.waitForFunction(
        () =>
          document.querySelector(
            'input[data-testid="EmailMethod_DeliveryItem"]'
          )?.checked &&
          document.querySelector(
            'input[name="emailDeliveryType"][value="LinkAndPdf"]'
          )?.checked
      );

      assert.equal(await checkedDeliveryMethod(page), "EmailMethod_DeliveryItem");
      assert.equal(await checkedValue(page), "LinkAndPdf");
    },
    { autoselectEmailDelivery: true }
  );
});

test("waits until the email delivery option group exists", async () => {
  const bodyHtml = "<!doctype html><main id=\"root\"></main>";
  const optionsHtml = await readFile(FIXTURE, "utf8");

  await withPage(MATCHING_URL, bodyHtml, async (page) => {
    assert.equal(await page.locator('input[name="emailDeliveryType"]').count(), 0);

    await page.locator("#root").evaluate((root, html) => {
      root.innerHTML = new DOMParser()
        .parseFromString(html, "text/html")
        .querySelector("main").innerHTML;
    }, optionsHtml);

    await page.waitForFunction(
      () =>
        document.querySelector(
          'input[name="emailDeliveryType"][value="LinkAndPdf"]'
        )?.checked
    );

    assert.equal(await checkedValue(page), "LinkAndPdf");
  });
});

test("waits until the delivery method exists when the popup setting is enabled", async () => {
  const bodyHtml = "<!doctype html><main id=\"root\"></main>";
  const optionsHtml = await readFile(FIXTURE, "utf8");

  await withPage(
    MATCHING_URL,
    bodyHtml,
    async (page) => {
      assert.equal(await page.locator('input[name="deliveryMethod"]').count(), 0);

      await page.locator("#root").evaluate((root, html) => {
        root.innerHTML = new DOMParser()
          .parseFromString(html, "text/html")
          .querySelector("main").innerHTML;
      }, optionsHtml);

      await page.waitForFunction(
        () =>
          document.querySelector(
            'input[data-testid="EmailMethod_DeliveryItem"]'
          )?.checked
      );

      assert.equal(await checkedDeliveryMethod(page), "EmailMethod_DeliveryItem");
    },
    { autoselectEmailDelivery: true }
  );
});

test("does not use visible label text", async () => {
  const bodyHtml = (await readFile(FIXTURE, "utf8"))
    .replaceAll("Language-independent placeholder A", "Send link only")
    .replaceAll("Language-independent placeholder B", "Send attachment too");

  await withPage(MATCHING_URL, bodyHtml, async (page) => {
    await page.waitForFunction(
      () =>
        document.querySelector(
          'input[name="emailDeliveryType"][value="LinkAndPdf"]'
        )?.checked
    );

    assert.equal(await checkedValue(page), "LinkAndPdf");
  });
});

test("respects a manual switch back to Link on the same route", async () => {
  const bodyHtml = await readFile(FIXTURE, "utf8");

  await withPage(MATCHING_URL, bodyHtml, async (page) => {
    await page.waitForFunction(
      () =>
        document.querySelector(
          'input[name="emailDeliveryType"][value="LinkAndPdf"]'
        )?.checked
    );

    await page.locator('label[data-value="Link"]').click();
    await page.locator("main").evaluate((main) => {
      main.append(document.createElement("div"));
    });
    await page.waitForTimeout(150);

    assert.equal(await checkedValue(page), "Link");
  });
});

test("respects a manual switch away from e-mail delivery on the same route", async () => {
  const bodyHtml = await readFile(FIXTURE, "utf8");

  await withPage(
    MATCHING_URL,
    bodyHtml,
    async (page) => {
      await page.waitForFunction(
        () =>
          document.querySelector(
            'input[data-testid="EmailMethod_DeliveryItem"]'
          )?.checked
      );

      await page.locator('input[data-testid="EInvoiceDeliveryItem"]').click();
      await page.locator("main").evaluate((main) => {
        main.append(document.createElement("div"));
      });
      await page.waitForTimeout(150);

      assert.equal(await checkedDeliveryMethod(page), "EInvoiceDeliveryItem");
    },
    { autoselectEmailDelivery: true }
  );
});

test("resets the one-time selection after SPA navigation to another invoice edit route", async () => {
  const bodyHtml = await readFile(FIXTURE, "utf8");

  await withPage(MATCHING_URL, bodyHtml, async (page) => {
    await page.waitForFunction(
      () =>
        document.querySelector(
          'input[name="emailDeliveryType"][value="LinkAndPdf"]'
        )?.checked
    );

    await page.locator('label[data-value="Link"]').click();
    assert.equal(await checkedValue(page), "Link");

    await page.evaluate(() => {
      window.history.pushState(
        {},
        "",
        "/company-id/invoicing/invoices/edit/another-invoice-id/"
      );
      document.querySelector("main").append(document.createElement("div"));
    });

    await page.waitForFunction(
      () =>
        document.querySelector(
          'input[name="emailDeliveryType"][value="LinkAndPdf"]'
        )?.checked
    );

    assert.equal(await checkedValue(page), "LinkAndPdf");
  });
});

test("resets e-mail delivery selection after SPA navigation to another invoice edit route", async () => {
  const bodyHtml = await readFile(FIXTURE, "utf8");

  await withPage(
    MATCHING_URL,
    bodyHtml,
    async (page) => {
      await page.waitForFunction(
        () =>
          document.querySelector(
            'input[data-testid="EmailMethod_DeliveryItem"]'
          )?.checked
      );

      await page.locator('input[data-testid="EInvoiceDeliveryItem"]').click();
      assert.equal(await checkedDeliveryMethod(page), "EInvoiceDeliveryItem");

      await page.evaluate(() => {
        window.history.pushState(
          {},
          "",
          "/company-id/invoicing/invoices/edit/another-invoice-id/"
        );
        document.querySelector("main").append(document.createElement("div"));
      });

      await page.waitForFunction(
        () =>
          document.querySelector(
            'input[data-testid="EmailMethod_DeliveryItem"]'
          )?.checked
      );

      assert.equal(await checkedDeliveryMethod(page), "EmailMethod_DeliveryItem");
    },
    { autoselectEmailDelivery: true }
  );
});

test("selects LinkAndPdf after SPA navigation from a non-invoice route", async () => {
  const bodyHtml = await readFile(FIXTURE, "utf8");

  await withPage(OTHER_URL, bodyHtml, async (page) => {
    assert.equal(await checkedValue(page), "Link");

    await page.evaluate((url) => {
      window.history.pushState({}, "", url);
      document.querySelector("main").append(document.createElement("div"));
    }, MATCHING_URL);

    await page.waitForFunction(
      () =>
        document.querySelector(
          'input[name="emailDeliveryType"][value="LinkAndPdf"]'
        )?.checked
    );

    assert.equal(await checkedValue(page), "LinkAndPdf");
  });
});

test("does nothing on non-invoice-edit Bokio routes", async () => {
  const bodyHtml = await readFile(FIXTURE, "utf8");

  await withPage(OTHER_URL, bodyHtml, async (page) => {
    await page.waitForTimeout(150);
    assert.equal(await checkedValue(page), "Link");
  });
});
