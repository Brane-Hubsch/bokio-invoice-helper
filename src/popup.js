(function () {
  "use strict";

  const ACTIVE_ORIGIN = "https://app.bokio.se";
  const ACTIVE_COPY =
    "Invoice Helper automatically selects PDF & link as the invoice delivery option on Bokio invoice pages.";
  const INACTIVE_COPY =
    "Invoice Helper only runs on Bokio.se";
  const AUTOSELECT_EMAIL_DELIVERY_KEY = "autoselectEmailDelivery";

  function isActiveUrl(url) {
    try {
      return new URL(url).origin === ACTIVE_ORIGIN;
    } catch {
      return false;
    }
  }

  function copyForUrl(url) {
    return isActiveUrl(url) ? ACTIVE_COPY : INACTIVE_COPY;
  }

  async function getActiveTabUrl() {
    if (
      typeof chrome === "undefined" ||
      !chrome.tabs ||
      typeof chrome.tabs.query !== "function"
    ) {
      return "";
    }

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      return tabs[0]?.url || "";
    } catch {
      return "";
    }
  }

  function storageArea() {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      return null;
    }

    return chrome.storage.local;
  }

  async function getAutoselectEmailDelivery() {
    const storage = storageArea();

    if (!storage || typeof storage.get !== "function") {
      return false;
    }

    try {
      return await new Promise((resolve) => {
        const fallback = { [AUTOSELECT_EMAIL_DELIVERY_KEY]: false };
        const maybePromise = storage.get(fallback, function (items) {
          resolve(Boolean(items?.[AUTOSELECT_EMAIL_DELIVERY_KEY]));
        });

        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise
            .then((items) => resolve(Boolean(items?.[AUTOSELECT_EMAIL_DELIVERY_KEY])))
            .catch(() => resolve(false));
        }
      });
    } catch {
      return false;
    }
  }

  async function setAutoselectEmailDelivery(value) {
    const storage = storageArea();

    if (!storage || typeof storage.set !== "function") {
      return;
    }

    try {
      await storage.set({
        [AUTOSELECT_EMAIL_DELIVERY_KEY]: Boolean(value)
      });
    } catch {
      // The popup should stay usable even if extension storage is unavailable.
    }
  }

  async function renderPopup() {
    const statusCopy = document.getElementById("status-copy");
    const toggle = document.getElementById("autoselect-email-delivery");

    if (statusCopy) {
      statusCopy.textContent = copyForUrl(await getActiveTabUrl());
    }

    if (toggle) {
      toggle.checked = await getAutoselectEmailDelivery();
      toggle.addEventListener("change", function () {
        setAutoselectEmailDelivery(toggle.checked);
      });
    }
  }

  if (typeof globalThis !== "undefined") {
    globalThis.__bokioInvoiceHelperPopup = {
      ACTIVE_COPY,
      INACTIVE_COPY,
      AUTOSELECT_EMAIL_DELIVERY_KEY,
      copyForUrl,
      getAutoselectEmailDelivery,
      isActiveUrl
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPopup, { once: true });
    return;
  }

  renderPopup();
})();
