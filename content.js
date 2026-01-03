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
  const TABLE_ROW_SEL = 'tbody tr.rc-table-row-clickable';
  const ADD_NUGGETS_BTN_SEL = '[data-testid="td-assignment-nuggets-widget-add-button"]';

  // --- Helper Functions ---
  const quickWait = (ms) => new Promise(res => setTimeout(res, ms));

  async function waitFor(selector, timeoutMs = 10000, root = document, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      const el = root.querySelector(selector);
      if (el && el.getBoundingClientRect().width > 0) return el;
      await new Promise(r => requestAnimationFrame(r)); 
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

  function pointerTap(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const opts = { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  // --- Main Automation Logic ---
  async function runAutomation(name, day, subject, duration, topic, signal) {
    console.time("AutomationDuration");

    // Subject Mapping
    let mappedSubject = subject; 
    if (["Physics", "Chemistry", "Biology"].includes(subject)) {
        mappedSubject = "Science";
    } else if (["English Language", "English Literature"].includes(subject)) {
        mappedSubject = "English";
    }

    // 1) Open Flow
    const createBtn = await waitFor(CREATE_SEL, 10000, document, signal);
    createBtn.click();
    
    const studentsBtn = await waitFor(STUDENTS_SEL, 10000, document, signal);
    studentsBtn.click();

    // 2) Search Student
    const modal = await waitFor(MODAL_SEL, 10000, document, signal);
    const searchInput = await waitFor('.rc-search-box--large ' + SEARCH_INPUT_SEL, 5000, modal, signal);
    setNativeValue(searchInput, name);
    
    const searchBtn = modal.querySelector('.rc-search-box--large ' + SEARCH_BTN_SEL);
    if (searchBtn) searchBtn.click();

    // 3) Wait for results
    const firstRow = await waitFor(TABLE_ROW_SEL, 8000, modal, signal);
    
    // 4) Select & Next
    const checkbox = firstRow.querySelector("label.cds-checkbox__input-label") || firstRow;
    pointerTap(checkbox);
    
    const nextBtn = await waitFor(NEXT_BTN_SEL, 5000, modal, signal);
    nextBtn.click();

    // 5) Fill Settings
    const nameInput = await waitFor(ASSIGNMENT_NAME_SEL, 8000, document, signal);
    setNativeValue(nameInput, `${name} ${day} ${subject} Homework`);

    const subSelect = await waitFor(SUBJECT_SELECT_SEL, 5000, document, signal);
    const targetOpt = Array.from(subSelect.options).find(o => o.text.trim() === mappedSubject);
    if (targetOpt) {
      subSelect.value = targetOpt.value;
      subSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Dates
    const startInput = await waitFor(START_DATE_SEL, 2000, document, signal);
    const dueInput = await waitFor(DUE_DATE_SEL, 2000, document, signal);
    const d = new Date();
    const fmt = (date) => date.toISOString().split('T')[0];
    setNativeValue(startInput, fmt(d));
    d.setDate(d.getDate() + (parseInt(duration) || 0));
    setNativeValue(dueInput, fmt(d));

    // 6) Final Create
    const finish = await waitFor(FINAL_CREATE_BTN_SEL, 5000, document, signal);
    finish.click();

    // 7) Select Nuggets
    const addNuggetsBtn = await waitFor(ADD_NUGGETS_BTN_SEL, 10000, document, signal);
    pointerTap(addNuggetsBtn);

    // 8) SELECT COURSE (Mathematics specific)
    if (subject === "Mathematics") {
        try {
            const MATH_H_ID = "88dc59ab-6ede-46f2-831b-c3513c14f216";
            let courseSelect = null;
            const startTime = Date.now();
            while (Date.now() - startTime < 10000) {
                if (signal?.aborted) return;
                courseSelect = document.querySelector('select[name="course"]');
                if (courseSelect && Array.from(courseSelect.options).some(opt => opt.value === MATH_H_ID)) break; 
                await new Promise(r => setTimeout(r, 500));
            }
            if (courseSelect) {
                courseSelect.value = MATH_H_ID;
                courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
                await quickWait(1000);
            }
        } catch (e) { console.warn("Math course selection failed:", e.message); }
    }

    // 9) SEARCH FOR TOPIC (Iframe piercing)
    if (topic) {
        let nuggetSearch = null;
        const iframes = Array.from(document.querySelectorAll('iframe'));
        for (const frame of iframes) {
            try {
                if (frame.contentDocument) {
                    nuggetSearch = frame.contentDocument.querySelector('input[placeholder="Search"][data-testid="search-input"]');
                    if (nuggetSearch) break;
                }
            } catch (e) { /* skip cross-origin */ }
        }
        if (!nuggetSearch) nuggetSearch = await waitFor('input[placeholder="Search"][data-testid="search-input"]', 5000, document, signal);

        if (nuggetSearch) {
            setNativeValue(nuggetSearch, topic);
            await quickWait(600);
            const parent = nuggetSearch.closest('.rc-search-box') || nuggetSearch.parentElement;
            const sBtn = parent.querySelector('button[data-testid="search-btn"]');
            if (sBtn) sBtn.click();
            else nuggetSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            
            await quickWait(1500);

            // 10) SELECT NUGGET & ADD
            try {
                const root = nuggetSearch.ownerDocument;
                const firstCheck = await waitFor('tbody tr.rc-table-row-clickable label.cds-checkbox__input-label', 5000, root, signal);
                if (firstCheck) {
                    pointerTap(firstCheck);
                    await quickWait(1000);
                    const addBtn = Array.from(root.querySelectorAll('button')).find(b => 
                        b.textContent.includes('ADD') || b.getAttribute('data-testid') === 'add-button' || b.className.includes('btn--primary')
                    );
                    if (addBtn) {
                        addBtn.click();
                        pointerTap(addBtn);
                    }
                }
            } catch (e) { console.warn("Nugget selection failed:", e.message); }
        }
    }

    // 11) BACK BUTTON
    try {
        const backBtn = await waitFor('[data-testid="back-btn"]', 5000, document, signal);
        if (backBtn) {
            const link = backBtn.querySelector('a') || backBtn;
            pointerTap(link);
            console.log("✅ Workflow complete.");
        }
    } catch (e) { console.warn("Back button failed:", e.message); }

    console.timeEnd("AutomationDuration");
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "RUN_AUTOMATION") {
      if (abortController) abortController.abort();
      abortController = new AbortController();
      runAutomation(msg.name, msg.day, msg.subject, msg.duration, msg.topic, abortController.signal)
        .catch(e => console.warn("Automation error:", e.message));
      sendResponse({ ok: true });
    } else if (msg.type === "STOP_AUTOMATION") {
      if (abortController) abortController.abort();
      sendResponse({ ok: true });
    }
    return true;
  });
})();