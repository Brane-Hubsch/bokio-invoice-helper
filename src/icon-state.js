(function () {
  "use strict";

  if (window.__bokioInvoiceHelperIconStateLoaded) {
    if (typeof window.__bokioInvoiceHelperAnnounceTab === "function") {
      window.__bokioInvoiceHelperAnnounceTab();
    }

    return;
  }

  window.__bokioInvoiceHelperIconStateLoaded = true;

  function announceBokioTab() {
    try {
      const pending = chrome.runtime.sendMessage({
        type: "bokio-invoice-helper:app-tab"
      });

      if (pending && typeof pending.catch === "function") {
        pending.catch(function () {});
      }
    } catch {
      // The extension context can disappear while Chrome reloads the extension.
    }
  }

  window.__bokioInvoiceHelperAnnounceTab = announceBokioTab;

  announceBokioTab();
  window.addEventListener("focus", announceBokioTab);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      announceBokioTab();
    }
  });
})();
