(() => {
  // Prevent double-installing listeners if injected multiple times
  if (window.__studentPickerInstalled) return;
  window.__studentPickerInstalled = true;

  let abortController = null;

  // --- Your selectors (unchanged) ---
  const CREATE_SEL = '[data-testid="create-assignment-button"]';
  const STUDENTS_SEL = '[data-testid="for-students-button"]';
  const SEARCH_INPUT_SEL = '[data-testid="search-input"]';
  const SEARCH_BTN_SEL = '[data-testid="search-btn"]';
  const NEXT_BTN_SEL = '[data-testid="next-button"]';

  const MODAL_SEL = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    ".modal",
    ".rc-modal",
    ".rc-drawer",
    '[data-testid*="modal"]'
  ].join(",");

  function sleep(ms, signal) {
    return new Promise((res, rej) => {
      const t = setTimeout(res, ms);
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            rej(new Error("Aborted"));
          },
          { once: true }
        );
      }
    });
  }

  function centerPoint(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
  }

  function topElementAtCenter(el) {
    const { x, y } = centerPoint(el);
    return document.elementFromPoint(x, y);
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  }

  function isClickable(el) {
    if (!isVisible(el)) return false;
    const topEl = topElementAtCenter(el);
    return topEl === el || (topEl && el.contains(topEl));
  }

  function pointerTap(el) {
    el.scrollIntoView({ block: "center", inline: "center" });
    try { el.focus(); } catch (_) {}

    const { x, y } = centerPoint(el);
    const topEl = document.elementFromPoint(x, y) || el;

    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

    topEl.dispatchEvent(new PointerEvent("pointerover", { ...opts, pointerType: "mouse" }));
    topEl.dispatchEvent(new PointerEvent("pointerenter", { ...opts, pointerType: "mouse" }));
    topEl.dispatchEvent(new MouseEvent("mouseover", opts));
    topEl.dispatchEvent(new MouseEvent("mouseenter", opts));

    topEl.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse", button: 0 }));
    topEl.dispatchEvent(new MouseEvent("mousedown", { ...opts, button: 0 }));

    topEl.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerType: "mouse", button: 0 }));
    topEl.dispatchEvent(new MouseEvent("mouseup", { ...opts, button: 0 }));

    topEl.dispatchEvent(new MouseEvent("click", { ...opts, button: 0 }));
  }

  async function waitFor(selector, timeoutMs = 15000, root = document, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      const el = root.querySelector(selector);
      if (el) return el;
      await sleep(100, signal);
    }
    throw new Error(`Timeout waiting for ${selector}`);
  }

  async function waitForAll(selector, timeoutMs = 15000, root = document, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      const els = root.querySelectorAll(selector);
      if (els && els.length) return Array.from(els);
      await sleep(100, signal);
    }
    throw new Error(`Timeout waiting for any: ${selector}`);
  }

  async function waitUntilClickable(el, timeoutMs = 15000, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      if (isClickable(el)) return true;
      await sleep(100, signal);
    }
    throw new Error("Element never became clickable (possibly covered or disabled).");
  }

  async function waitUntilEnabled(el, timeoutMs = 15000, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      if (!el.disabled) return true;
      await sleep(100, signal);
    }
    throw new Error("Element never became enabled.");
  }

  function setNativeValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    const setter = desc && desc.set;
    if (setter) setter.call(input, value);
    else input.value = value;
  }

  function typeInto(inputEl, text) {
    inputEl.scrollIntoView({ block: "center", inline: "center" });
    inputEl.focus();

    setNativeValue(inputEl, "");
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));

    setNativeValue(inputEl, text);
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));

    const btn = document.querySelector(SEARCH_BTN_SEL);
    if (btn && !btn.disabled) pointerTap(btn);
  }

  function getTopmostVisibleModal() {
    const modals = Array.from(document.querySelectorAll(MODAL_SEL)).filter(isVisible);
    if (!modals.length) return null;

    modals.sort((a, b) => {
      const za = parseFloat(getComputedStyle(a).zIndex) || 0;
      const zb = parseFloat(getComputedStyle(b).zIndex) || 0;
      return zb - za;
    });
    return modals[0];
  }

  async function waitForModal(timeoutMs = 15000, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      const m = getTopmostVisibleModal();
      if (m) return m;
      await sleep(100, signal);
    }
    throw new Error("Timeout waiting for modal/dialog to appear.");
  }

  async function selectFirstStudent(modalRoot, signal) {
    const rows = await waitForAll('tbody[role="group"] tr.rc-table-row-clickable', 15000, modalRoot, signal);
    const firstRow = rows[0];

    const checkbox = firstRow.querySelector('input[type="checkbox"][name="students"]');
    if (!checkbox) throw new Error("Couldn't find checkbox in first row.");

    if (checkbox.checked) {
      console.log("ℹ️ First student already selected.");
      return;
    }

    const clickTarget =
      firstRow.querySelector("label.cds-checkbox__input-label") ||
      firstRow.querySelector(".cds-checkbox__control") ||
      checkbox;

    await waitUntilClickable(clickTarget, 15000, signal);
    pointerTap(clickTarget);

    await sleep(200, signal);
    if (!checkbox.checked) {
      await waitUntilClickable(firstRow, 15000, signal);
      pointerTap(firstRow);
      await sleep(200, signal);
    }

    const pickedNameEl = firstRow.querySelector('[data-testid="student-name"]');
    const pickedName = pickedNameEl ? pickedNameEl.textContent.trim() : "(unknown)";
    console.log("✅ Selected first student:", pickedName);
  }

  async function runAutomation(nameToSearch, signal) {
    console.log("▶️ Automation starting with search:", nameToSearch);

    // 1) Create Assignment
    const createBtn = await waitFor(CREATE_SEL, 15000, document, signal);
    await waitUntilClickable(createBtn, 15000, signal);
    pointerTap(createBtn);

    await sleep(300, signal);

    // 2) For Students
    const studentsBtn = await waitFor(STUDENTS_SEL, 15000, document, signal);
    await waitUntilClickable(studentsBtn, 15000, signal);
    pointerTap(studentsBtn);

    // 3) Wait for modal and search within it
    const modal = await waitForModal(15000, signal);
    const searchInput = await waitFor(SEARCH_INPUT_SEL, 15000, modal, signal);

    typeInto(searchInput, nameToSearch);

    // allow filter/render
    await sleep(300, signal);
    await sleep(3500, signal);

    // 4) Select first student in results
    await selectFirstStudent(modal, signal);

    // 5) Click Next
    const nextBtn = modal.querySelector(NEXT_BTN_SEL) || (await waitFor(NEXT_BTN_SEL, 15000, document, signal));
    await waitUntilEnabled(nextBtn, 15000, signal);
    await waitUntilClickable(nextBtn, 15000, signal);
    pointerTap(nextBtn);

    console.log("➡️ Clicked Next button.");
    console.log("✅ Done: create -> for students -> search -> select -> next.");
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        if (msg?.type === "RUN_AUTOMATION") {
          // Stop any existing run
          if (abortController) abortController.abort();

          abortController = new AbortController();
          runAutomation(msg.name, abortController.signal)
            .then(() => console.log("✅ Automation finished."))
            .catch((e) => console.error("❌ Automation failed:", e))
            .finally(() => {
              // Only clear if this is still the active controller
              if (abortController?.signal?.aborted === false) {
                abortController = null;
              }
            });

          sendResponse({ ok: true });
          return;
        }

        if (msg?.type === "STOP_AUTOMATION") {
          if (abortController) abortController.abort();
          abortController = null;
          sendResponse({ ok: true });
          return;
        }

        sendResponse({ ok: false, error: "Unknown message type" });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    })();

    // Keep the message channel open for async sendResponse
    return true;
  });
})();
