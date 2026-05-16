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

  const iconImageDataCache = new Map();

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

  async function imageDataForIconPath(path, size) {
    const response = await fetch(chrome.runtime.getURL(path));
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, size, size);
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, size, size);

    if (typeof bitmap.close === "function") {
      bitmap.close();
    }

    return context.getImageData(0, 0, size, size);
  }

  async function imageDataForIconPaths(paths) {
    const cacheKey = JSON.stringify(paths);

    if (!iconImageDataCache.has(cacheKey)) {
      iconImageDataCache.set(
        cacheKey,
        Promise.all(
          Object.entries(paths).map(async ([size, path]) => [
            size,
            await imageDataForIconPath(path, Number(size))
          ])
        ).then(Object.fromEntries)
      );
    }

    return iconImageDataCache.get(cacheKey);
  }

  async function setIcon(tabId, imageData) {
    await new Promise((resolve, reject) => {
      chrome.action.setIcon(
        {
          tabId,
          imageData
        },
        function () {
          const error = chrome.runtime.lastError;

          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    });
  }

  async function setIconForTab(tab) {
    if (!tab || typeof tab.id !== "number") {
      return;
    }

    try {
      const imageData = await imageDataForIconPaths(iconPathsForUrl(tab.url));
      await setIcon(tab.id, imageData);
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
