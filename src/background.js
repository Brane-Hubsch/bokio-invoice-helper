(function () {
  "use strict";

  const ACTIVE_ICON_PATHS = {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png"
  };
  const INACTIVE_ICON_PATHS = {
    16: "icons/icon-inactive-16.png",
    32: "icons/icon-inactive-32.png",
    48: "icons/icon-inactive-48.png",
    128: "icons/icon-inactive-128.png"
  };
  const ACTIVE_ORIGIN = "https://app.bokio.se";

  function isActiveUrl(url) {
    try {
      return new URL(url).origin === ACTIVE_ORIGIN;
    } catch {
      return false;
    }
  }

  function iconPathsForUrl(url) {
    return isActiveUrl(url) ? ACTIVE_ICON_PATHS : INACTIVE_ICON_PATHS;
  }

  async function setIconForTab(tab) {
    if (!tab || typeof tab.id !== "number") {
      return;
    }

    try {
      await chrome.action.setIcon({
        tabId: tab.id,
        path: iconPathsForUrl(tab.url)
      });
    } catch {
      // The tab can disappear while Chrome is delivering tab events.
    }
  }

  async function setIconForActiveTab() {
    let tabs;

    try {
      tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
    } catch {
      return;
    }

    await setIconForTab(tabs[0]);
  }

  function setIconForTabId(tabId) {
    chrome.tabs.get(tabId, function (tab) {
      if (chrome.runtime.lastError) {
        return;
      }

      setIconForTab(tab);
    });
  }

  if (
    typeof chrome === "undefined" ||
    !chrome.runtime ||
    !chrome.action ||
    !chrome.tabs ||
    !chrome.tabs.onActivated ||
    !chrome.tabs.onUpdated
  ) {
    if (typeof globalThis !== "undefined") {
      globalThis.__bokioInvoiceHelperBackground = {
        iconPathsForUrl,
        isActiveUrl
      };
    }

    return;
  }

  chrome.runtime.onInstalled.addListener(setIconForActiveTab);
  chrome.runtime.onStartup.addListener(setIconForActiveTab);

  chrome.tabs.onActivated.addListener(function ({ tabId }) {
    setIconForTabId(tabId);
  });

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.url || tab.active) {
      setIconForTab({
        id: tabId,
        url: changeInfo.url || tab.url
      });
    }
  });

  if (chrome.windows && chrome.windows.onFocusChanged) {
    chrome.windows.onFocusChanged.addListener(function (windowId) {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        setIconForActiveTab();
      }
    });
  }

  setIconForActiveTab();
})();
