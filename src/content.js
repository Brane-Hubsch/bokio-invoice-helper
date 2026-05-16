(function () {
  "use strict";

  if (window.__bokioInvoiceHelperContentLoaded) {
    return;
  }

  window.__bokioInvoiceHelperContentLoaded = true;

  const ROUTE_RE = /^\/[^/]+\/invoicing\/invoices\/edit\/[^/]+(?:\/|$)/;
  const TARGET_LABEL_SELECTOR =
    'label[data-name="emailDeliveryType"][data-value="LinkAndPdf"]';
  const TARGET_INPUT_SELECTOR =
    'input[name="emailDeliveryType"][value="LinkAndPdf"]';
  const DELIVERY_INPUT_SELECTOR = 'input[name="emailDeliveryType"]';
  const EMAIL_DELIVERY_INPUT_SELECTOR =
    'input[data-testid="EmailMethod_DeliveryItem"][type="radio"]';
  const DELIVERY_METHOD_INPUT_SELECTOR =
    'input[type="radio"][data-testid$="DeliveryItem"]';
  const AUTOSELECT_EMAIL_DELIVERY_KEY = "autoselectEmailDelivery";
  const DEBOUNCE_MS = 50;

  const state = {
    routeKey: getRouteKey(),
    applied: false,
    manualOptOut: false,
    applying: false,
    autoselectEmailDelivery: false,
    emailDeliveryApplied: false,
    emailDeliveryManualOptOut: false,
    emailDeliveryApplying: false,
    timer: 0
  };

  function getRouteKey() {
    const match = window.location.pathname.match(ROUTE_RE);
    return match ? match[0] : "";
  }

  function syncRoute() {
    const nextRouteKey = getRouteKey();

    if (nextRouteKey !== state.routeKey) {
      state.routeKey = nextRouteKey;
      state.applied = false;
      state.manualOptOut = false;
      state.applying = false;
      state.emailDeliveryApplied = false;
      state.emailDeliveryManualOptOut = false;
      state.emailDeliveryApplying = false;
    }

    return nextRouteKey;
  }

  function findTargetControl() {
    const label = document.querySelector(TARGET_LABEL_SELECTOR);
    const labelInput = label
      ? label.querySelector('input[type="radio"], input[name="emailDeliveryType"]')
      : null;
    const input = labelInput || document.querySelector(TARGET_INPUT_SELECTOR);

    return { label, input };
  }

  function findEmailDeliveryControl() {
    const input = document.querySelector(EMAIL_DELIVERY_INPUT_SELECTOR);
    const label = input ? input.closest("label") : null;

    return { label, input };
  }

  function isDisabled(element) {
    return Boolean(
      element &&
        (element.disabled ||
          element.getAttribute("aria-disabled") === "true" ||
          element.closest("[aria-disabled='true']"))
    );
  }

  function markAppliedIfSelected(input) {
    if (input && input.checked) {
      state.applied = true;
      return true;
    }

    return false;
  }

  function chooseLinkAndPdf() {
    if (!syncRoute() || state.applied || state.manualOptOut || state.applying) {
      return;
    }

    const { label, input } = findTargetControl();

    if (!input || isDisabled(input) || isDisabled(label)) {
      return;
    }

    if (markAppliedIfSelected(input)) {
      return;
    }

    state.applying = true;
    (label || input).click();

    window.setTimeout(function () {
      const selectedInput = document.querySelector(TARGET_INPUT_SELECTOR);
      markAppliedIfSelected(selectedInput || input);
      state.applying = false;

      if (!state.applied && !state.manualOptOut) {
        scheduleChoose();
      }
    }, 0);
  }

  function markEmailDeliveryAppliedIfSelected(input) {
    if (input && input.checked) {
      state.emailDeliveryApplied = true;
      return true;
    }

    return false;
  }

  function chooseEmailDelivery() {
    if (
      !syncRoute() ||
      !state.autoselectEmailDelivery ||
      state.emailDeliveryApplied ||
      state.emailDeliveryManualOptOut ||
      state.emailDeliveryApplying
    ) {
      return;
    }

    const { label, input } = findEmailDeliveryControl();

    if (!input || isDisabled(input) || isDisabled(label)) {
      return;
    }

    if (markEmailDeliveryAppliedIfSelected(input)) {
      return;
    }

    state.emailDeliveryApplying = true;
    (label || input).click();

    window.setTimeout(function () {
      const selectedInput = document.querySelector(EMAIL_DELIVERY_INPUT_SELECTOR);
      markEmailDeliveryAppliedIfSelected(selectedInput || input);
      state.emailDeliveryApplying = false;

      if (!state.emailDeliveryApplied && !state.emailDeliveryManualOptOut) {
        scheduleChoose();
      }
    }, 0);
  }

  function chooseInvoiceOptions() {
    chooseEmailDelivery();
    chooseLinkAndPdf();
  }

  function scheduleChoose() {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(chooseInvoiceOptions, DEBOUNCE_MS);
  }

  function handleDeliveryTypeChange(event) {
    if (!syncRoute() || state.applying) {
      return;
    }

    const input = event.target;

    if (
      input instanceof HTMLInputElement &&
      input.matches(DELIVERY_INPUT_SELECTOR) &&
      input.checked
    ) {
      if (input.value === "LinkAndPdf") {
        state.applied = true;
        return;
      }

      if (state.applied) {
        state.manualOptOut = true;
      }
    }
  }

  function handleDeliveryMethodChange(event) {
    if (!syncRoute() || state.emailDeliveryApplying) {
      return;
    }

    const input = event.target;

    if (
      input instanceof HTMLInputElement &&
      input.matches(DELIVERY_METHOD_INPUT_SELECTOR) &&
      input.checked
    ) {
      if (input.matches(EMAIL_DELIVERY_INPUT_SELECTOR)) {
        state.emailDeliveryApplied = true;
        return;
      }

      if (state.emailDeliveryApplied) {
        state.emailDeliveryManualOptOut = true;
      }
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

  async function loadAutoselectEmailDelivery() {
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

  function watchAutoselectEmailDelivery() {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.onChanged ||
      typeof chrome.storage.onChanged.addListener !== "function"
    ) {
      return;
    }

    chrome.storage.onChanged.addListener(function (changes, areaName) {
      const change = changes[AUTOSELECT_EMAIL_DELIVERY_KEY];

      if (areaName !== "local" || !change) {
        return;
      }

      state.autoselectEmailDelivery = Boolean(change.newValue);
      state.emailDeliveryApplied = false;
      state.emailDeliveryManualOptOut = false;
      state.emailDeliveryApplying = false;
      scheduleChoose();
    });
  }

  function patchHistoryMethod(methodName) {
    const original = window.history[methodName];

    if (typeof original !== "function") {
      return;
    }

    window.history[methodName] = function () {
      const result = original.apply(this, arguments);
      scheduleChoose();
      return result;
    };
  }

  document.addEventListener("change", handleDeliveryTypeChange, true);
  document.addEventListener("change", handleDeliveryMethodChange, true);
  window.addEventListener("popstate", scheduleChoose);
  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
  watchAutoselectEmailDelivery();

  const observer = new MutationObserver(scheduleChoose);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  loadAutoselectEmailDelivery().then(function (value) {
    state.autoselectEmailDelivery = value;
    scheduleChoose();
  });
})();
