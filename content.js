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
  const SUBJECT_SELECT_SEL = 'select#select.cds-select';
  const START_DATE_SEL = '[data-testid="date-picker-startDate"]';
  const DUE_DATE_SEL = '[data-testid="date-picker-dueDate"]';
  const FINAL_CREATE_BTN_SEL = '[data-testid="teacher-assignment-modal-create-button"]';
  const MODAL_SEL = '[role="dialog"]';

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

  function pointerTap(el) {
    if (!el) return;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
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

  function setNativeValue(input, value) {
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function selectSubjectByText(selectEl, subjectToMatch) {
    const options = Array.from(selectEl.options);
    const targetOption = options.find(opt => opt.text.trim() === subjectToMatch);
    if (targetOption) {
      selectEl.value = targetOption.value;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`🎯 Subject matched: ${subjectToMatch}`);
    }
  }

  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // --- Core Automation Logic ---
  async function runAutomation(name, day, subject, duration, signal) {
    console.log("▶️ Running automation...");

    // 1) Open Assignment Flow
    (await waitFor(CREATE_SEL, 15000, document, signal)).click();
    await sleep(500, signal);
    (await waitFor(STUDENTS_SEL, 15000, document, signal)).click();

    // 2) Modal Student Search
    const modal = await waitFor(MODAL_SEL, 15000, document, signal);
    // Targeting specifically the search box in the modal to avoid dashboard search bar
    const searchInput = await waitFor('.rc-search-box--large [data-testid="search-input"]', 15000, modal, signal);
    setNativeValue(searchInput, name);
    
    const modalSearchBtn = modal.querySelector('.rc-search-box--large [data-testid="search-btn"]');
    if (modalSearchBtn) pointerTap(modalSearchBtn);
    await sleep(3000, signal); 

    // 3) Select First Result
    const rows = await waitFor('tbody tr.rc-table-row-clickable', 15000, modal, signal);
    const clickTarget = rows.querySelector("label.cds-checkbox__input-label") || rows;
    pointerTap(clickTarget);

    // 4) Go to Settings
    const nextBtn = modal.querySelector(NEXT_BTN_SEL) || (await waitFor(NEXT_BTN_SEL, 15000, document, signal));
    pointerTap(nextBtn);

    // 5) Fill Settings Screen
    console.log("➡️ Filling Assignment Settings...");
    await sleep(2000, signal);

    // Set Name
    const nameInput = await waitFor(ASSIGNMENT_NAME_SEL, 15000, document, signal);
    setNativeValue(nameInput, `${name} ${day} Homework`);

    // Set Subject
    try {
        const subjectSelect = await waitFor(SUBJECT_SELECT_SEL, 5000, document, signal);
        selectSubjectByText(subjectSelect, subject);
    } catch (e) { console.warn("Subject dropdown not found."); }

    // Set Dates
    const startInput = await waitFor(START_DATE_SEL, 5000, document, signal);
    const dueInput = await waitFor(DUE_DATE_SEL, 5000, document, signal);

    const today = new Date();
    const dueDate = new Date();
    const daysToAdd = parseInt(duration, 10) || 0;
    dueDate.setDate(today.getDate() + daysToAdd);

    setNativeValue(startInput, formatDateForInput(today));
    setNativeValue(dueInput, formatDateForInput(dueDate));

    // 6) Click Final Create
    console.log("🚀 Clicking Create...");
    await sleep(1000, signal);
    const finalCreateBtn = await waitFor(FINAL_CREATE_BTN_SEL, 5000, document, signal);
    pointerTap(finalCreateBtn);

    console.log("✅ Assignment Created Successfully.");
  }

  // --- Message Listener ---
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