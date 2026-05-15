(function () {
  "use strict";

  const ROUTE_RE = /^\/[^/]+\/invoicing\/invoices\/edit\/[^/]+(?:\/|$)/;
  const TARGET_LABEL_SELECTOR =
    'label[data-name="emailDeliveryType"][data-value="LinkAndPdf"]';
  const TARGET_INPUT_SELECTOR =
    'input[name="emailDeliveryType"][value="LinkAndPdf"]';
  const DELIVERY_INPUT_SELECTOR = 'input[name="emailDeliveryType"]';
  const DEBOUNCE_MS = 50;

  const state = {
    routeKey: getRouteKey(),
    applied: false,
    manualOptOut: false,
    applying: false,
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

  function scheduleChoose() {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(chooseLinkAndPdf, DEBOUNCE_MS);
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
  window.addEventListener("popstate", scheduleChoose);
  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  const observer = new MutationObserver(scheduleChoose);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  scheduleChoose();
})();
