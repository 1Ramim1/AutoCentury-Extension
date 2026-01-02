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
  
  // New Selectors from your screenshot
  const ASSIGNMENT_NAME_SEL = '[data-testid="text-input-assignmentName"]';
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

  function isClickable(el) {
    if (!isVisible(el)) return false;
    const { x, y } = centerPoint(el);
    const topEl = document.elementFromPoint(x, y);
    return topEl === el || (topEl && el.contains(topEl));
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
    throw new Error(`Timeout waiting for ${selector}`);
  }

  async function waitForAll(selector, timeoutMs = 15000, root = document, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      const els = root.querySelectorAll(selector);
      if (els?.length) return Array.from(els);
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
    throw new Error("Element never became clickable.");
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

  function typeInto(inputEl, text) {
    inputEl.focus();
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inputEl), "value")?.set;
    if (setter) setter.call(inputEl, text);
    else inputEl.value = text;
    
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));

    // Optional: Auto-trigger search button if it exists on the search screen
    const btn = document.querySelector(SEARCH_BTN_SEL);
    if (btn && !btn.disabled && isVisible(btn)) pointerTap(btn);
  }

  async function selectFirstStudent(modalRoot, signal) {
    const rows = await waitForAll('tbody[role="group"] tr.rc-table-row-clickable', 15000, modalRoot, signal);
    const firstRow = rows[0];
    const checkbox = firstRow.querySelector('input[type="checkbox"][name="students"]');
    
    if (checkbox && !checkbox.checked) {
      const clickTarget = firstRow.querySelector("label.cds-checkbox__input-label") || firstRow;
      await waitUntilClickable(clickTarget, 15000, signal);
      pointerTap(clickTarget);
    }
    console.log("✅ Selected first student result.");
  }

  // --- Core Automation Logic ---
  async function runAutomation(nameToSearch, dayOfWeek, signal) {
    console.log(`▶️ Starting: Searching "${nameToSearch}" for ${dayOfWeek}`);

    // 1) Click Initial "Create Assignment"
    const createBtn = await waitFor(CREATE_SEL, 15000, document, signal);
    await waitUntilClickable(createBtn, 15000, signal);
    pointerTap(createBtn);
    await sleep(500, signal);

    // 2) Click "For Students"
    const studentsBtn = await waitFor(STUDENTS_SEL, 15000, document, signal);
    await waitUntilClickable(studentsBtn, 15000, signal);
    pointerTap(studentsBtn);

    // 3) Handle Search Modal
    const modal = await waitFor(MODAL_SEL, 15000, document, signal);
    const searchInput = await waitFor(SEARCH_INPUT_SEL, 15000, modal, signal);
    typeInto(searchInput, nameToSearch);
    
    await sleep(3000, signal); // Wait for student list to filter

    // 4) Select first student
    await selectFirstStudent(modal, signal);

    // 5) Click Next
    const nextBtn = modal.querySelector(NEXT_BTN_SEL) || (await waitFor(NEXT_BTN_SEL, 15000, document, signal));
    await waitUntilEnabled(nextBtn, 15000, signal);
    pointerTap(nextBtn);

    console.log("➡️ Moving to Assignment Settings...");
    await sleep(1500, signal); // Give the new screen time to load

    // 6) Fill Assignment Name: [Name] [Day] Homework
    const assignmentInput = await waitFor(ASSIGNMENT_NAME_SEL, 15000, document, signal);
    const finalName = `${nameToSearch} ${dayOfWeek} Homework`;
    
    console.log(`✍️ Filling assignment name: ${finalName}`);
    typeInto(assignmentInput, finalName);
    await sleep(800, signal);

    // 7) Click the final "CREATE" button (The red button)
    const buttons = await waitForAll('button', 15000, document, signal);
    const createFinalBtn = buttons.find(b => b.textContent.trim().toUpperCase() === 'CREATE');

    if (createFinalBtn) {
        await waitUntilClickable(createFinalBtn, 15000, signal);
        pointerTap(createFinalBtn);
        console.log("🚀 Final CREATE button clicked!");
    } else {
        throw new Error("Could not find the final CREATE button.");
    }

    console.log(`✅ Fully completed: ${finalName}`);
  }

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "RUN_AUTOMATION") {
      if (abortController) abortController.abort();
      abortController = new AbortController();

      runAutomation(msg.name, msg.day, abortController.signal)
        .catch(e => {
            if (e.message !== "Aborted") {
                console.error("❌ Automation error:", e.message);
            }
        });

      sendResponse({ ok: true });
    } else if (msg?.type === "STOP_AUTOMATION") {
      if (abortController) abortController.abort();
      abortController = null;
      sendResponse({ ok: true });
    }
    return true;
  });
})();