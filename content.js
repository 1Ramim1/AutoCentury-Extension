(() => {
  if (window.__studentPickerInstalled) return;
  window.__studentPickerInstalled = true;

  let abortController = null;

  // --- Selectors ---
  const CREATE_SEL = '[data-testid="create-assignment-button"]';
  const STUDENTS_SEL = '[data-testid="for-students-button"]';
  const SEARCH_INPUT_SEL = '[data-testid="search-input"]';
  const SEARCH_BTN_SEL = '[data-testid="search-btn"]';
  const NEXT_BTN_SEL = '[data-testid="next-button"]';
  
  const ASSIGNMENT_NAME_SEL = '[data-testid="text-input-assignmentName"]';
  const DATE_PICKER_SEL = 'input[placeholder="dd/mm/yyyy"]';
  const SUBJECT_DROPDOWN_SEL = '.cds-select__control';

  const MODAL_SEL = [
    '[role="dialog"]', '[aria-modal="true"]', ".modal", ".rc-modal", ".rc-drawer", '[data-testid*="modal"]'
  ].join(",");

  // --- Helper Functions ---
  function sleep(ms, signal) {
    return new Promise((res, rej) => {
      const t = setTimeout(res, ms);
      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          rej(new Error("Aborted"));
        }, { once: true });
      }
    });
  }

  function centerPoint(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function pointerTap(el) {
    el.scrollIntoView({ block: "center", inline: "center" });
    const { x, y } = centerPoint(el);
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    
    el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse", button: 0 }));
    el.dispatchEvent(new MouseEvent("mousedown", { ...opts, button: 0 }));
    el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerType: "mouse", button: 0 }));
    el.dispatchEvent(new MouseEvent("mouseup", { ...opts, button: 0 }));
    el.dispatchEvent(new MouseEvent("click", { ...opts, button: 0 }));
  }

  async function waitFor(selector, timeoutMs = 15000, root = document, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      const el = root.querySelector(selector);
      if (el) return el;
      await sleep(100, signal);
    }
    throw new Error(`Timeout: ${selector}`);
  }

  async function waitForAll(selector, timeoutMs = 15000, root = document, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      const els = root.querySelectorAll(selector);
      if (els?.length) return Array.from(els);
      await sleep(100, signal);
    }
    throw new Error(`Timeout: ${selector}`);
  }

  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function selectFirstStudent(modalRoot, signal) {
    const rows = await waitForAll('tbody[role="group"] tr.rc-table-row-clickable', 15000, modalRoot, signal);
    const firstRow = rows[0];
    const checkbox = firstRow.querySelector('input[type="checkbox"][name="students"]');
    
    if (checkbox && !checkbox.checked) {
      const clickTarget = firstRow.querySelector("label.cds-checkbox__input-label") || firstRow;
      pointerTap(clickTarget);
    }
  }

  // --- Core Automation Logic ---
  // --- Core Automation Logic ---
  async function runAutomation(name, day, subject, duration, signal) {
    console.log("▶️ Running automation...");

    // 1) Click Initial "Create Assignment"
    const createBtn = await waitFor(CREATE_SEL, 15000, document, signal);
    pointerTap(createBtn);
    await sleep(500, signal);

    // 2) Click "For Students"
    const studentsBtn = await waitFor(STUDENTS_SEL, 15000, document, signal);
    pointerTap(studentsBtn);

    // 3) Handle Search WITHIN the Modal only
    // This finds the pop-up first, then looks for the search bar inside it
    const modal = await waitFor(MODAL_SEL, 15000, document, signal);
    const searchInput = await waitFor(SEARCH_INPUT_SEL, 15000, modal, signal);
    
    console.log("🔍 Searching for student inside modal...");
    setNativeValue(searchInput, name);
    
    // Trigger the search button specifically inside the modal
    const modalSearchBtn = modal.querySelector(SEARCH_BTN_SEL);
    if (modalSearchBtn) pointerTap(modalSearchBtn);
    
    await sleep(3000, signal); // Wait for student list to filter

    // 4) Select first student
    await selectFirstStudent(modal, signal);
    
    // 5) Click Next
    const nextBtn = modal.querySelector(NEXT_BTN_SEL) || (await waitFor(NEXT_BTN_SEL, 15000, document, signal));
    pointerTap(nextBtn);

    // 6) Settings Screen
    console.log("➡️ Filling Assignment Settings...");
    await sleep(1500, signal);

    const nameInput = await waitFor(ASSIGNMENT_NAME_SEL, 15000, document, signal);
    const finalName = `${name} ${day} Homework`;
    setNativeValue(nameInput, finalName);

    console.log("✅ Automation finished. Ready for manual review.");
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "RUN_AUTOMATION") {
      if (abortController) abortController.abort();
      abortController = new AbortController();
      runAutomation(msg.name, msg.day, msg.subject, msg.duration, abortController.signal)
        .catch(e => { if (e.message !== "Aborted") console.error(e); });
      sendResponse({ ok: true });
    } else if (msg?.type === "STOP_AUTOMATION") {
      if (abortController) abortController.abort();
      abortController = null;
      sendResponse({ ok: true });
    }
    return true;
  });
})();