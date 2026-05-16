(function () {
  "use strict";

  const ACTIVE_ORIGIN = "https://app.bokio.se";
  const ACTIVE_COPY =
    "Invoice Helper automatically selects PDF & link as the invoice delivery option on Bokio invoice pages.";
  const INACTIVE_COPY =
    "Invoice Helper only runs on Bokio.se";

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

  async function renderPopup() {
    const statusCopy = document.getElementById("status-copy");

    if (!statusCopy) {
      return;
    }

    statusCopy.textContent = copyForUrl(await getActiveTabUrl());
  }

  if (typeof globalThis !== "undefined") {
    globalThis.__bokioInvoiceHelperPopup = {
      ACTIVE_COPY,
      INACTIVE_COPY,
      copyForUrl,
      isActiveUrl
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPopup, { once: true });
    return;
  }

  renderPopup();
})();
