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
  const APP_URL_PATTERN = "https://app.bokio.se/*";
  const CONTENT_SCRIPT_FILES = ["src/icon-state.js", "src/content.js"];

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

  function isActiveSender(sender) {
    return isActiveUrl(sender.url || sender.origin || "");
  }

  function setIcon(tabId, path) {
    return chrome.action.setIcon({
      tabId,
      path
    });
  }

  async function setIconForTab(tab) {
    if (!tab || typeof tab.id !== "number") {
      return;
    }

    try {
      await setIcon(tab.id, iconPathsForUrl(tab.url));
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

  async function injectScriptsIntoTab(tab) {
    if (!tab || typeof tab.id !== "number" || !isActiveUrl(tab.url)) {
      return;
    }

    if (!chrome.scripting || typeof chrome.scripting.executeScript !== "function") {
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: CONTENT_SCRIPT_FILES
      });
    } catch {
      // Existing tabs may be restricted, discarded, or navigating while we inject.
    }
  }

  async function injectScriptsIntoExistingTabs() {
    if (!chrome.tabs || typeof chrome.tabs.query !== "function") {
      return;
    }

    let tabs;

    try {
      tabs = await chrome.tabs.query({ url: APP_URL_PATTERN });
    } catch {
      return;
    }

    await Promise.all(tabs.map(injectScriptsIntoTab));
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

  chrome.runtime.onMessage.addListener(function (message, sender) {
    if (
      message?.type !== "bokio-invoice-helper:app-tab" ||
      !isActiveSender(sender) ||
      typeof sender.tab?.id !== "number"
    ) {
      return;
    }

    const pending = setIcon(sender.tab.id, ACTIVE_ICON_PATHS);

    if (pending && typeof pending.catch === "function") {
      pending.catch(function () {});
    }
  });

  chrome.runtime.onInstalled.addListener(function () {
    setIconForActiveTab();
    injectScriptsIntoExistingTabs();
  });

  chrome.runtime.onStartup.addListener(function () {
    setIconForActiveTab();
    injectScriptsIntoExistingTabs();
  });

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
