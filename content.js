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
  
  // NEW SELECTOR: Course dropdown in the nuggets modal
  const COURSE_SELECT_SEL = 'select[name="course"]';

  // --- Fast Helper Functions ---
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

  // --- Automation Logic ---
  async function runAutomation(name, day, subject, duration, signal) {
    console.time("AutomationDuration");

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

    // 3) WAIT FOR RESULTS
    const firstRow = await waitFor(TABLE_ROW_SEL, 8000, modal, signal);
    
    // 4) Select & Next
    const checkbox = firstRow.querySelector("label.cds-checkbox__input-label") || firstRow;
    pointerTap(checkbox);
    
    const nextBtn = await waitFor(NEXT_BTN_SEL, 5000, modal, signal);
    nextBtn.click();

    // 5) Fill Settings
    const nameInput = await waitFor(ASSIGNMENT_NAME_SEL, 8000, document, signal);
    setNativeValue(nameInput, `${name} ${day} Homework`);

    const subSelect = await waitFor(SUBJECT_SELECT_SEL, 5000, document, signal);
    const targetOpt = Array.from(subSelect.options).find(o => o.text.trim() === subject);
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

    // 8) SELECT COURSE: With Smart Loading Check
    if (subject === "Mathematics") {
        console.log("📐 Subject is Mathematics. Waiting for courses to load...");
        try {
            const MATH_H_ID = "88dc59ab-6ede-46f2-831b-c3513c14f216";
            let courseSelect = null;
            let optionExists = false;

            // Loop for up to 10 seconds waiting for the OPTION to exist inside the SELECT
            const startTime = Date.now();
            while (Date.now() - startTime < 10000) {
                if (signal?.aborted) return;

                courseSelect = document.querySelector('select[name="course"]');
                if (courseSelect) {
                    // Check if the specific Mathematics Secondary (H) option is in the list yet
                    optionExists = Array.from(courseSelect.options).some(opt => opt.value === MATH_H_ID);
                    if (optionExists) break; 
                }
                await new Promise(r => setTimeout(r, 500)); // Wait 0.5s before checking again
            }

            if (optionExists && courseSelect) {
                // Force the selection
                courseSelect.value = MATH_H_ID;
                
                // Critical: Trigger multiple events to satisfy the website's framework
                courseSelect.dispatchEvent(new Event('input', { bubbles: true }));
                courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
                
                console.log("✅ Successfully selected Mathematics Secondary (H) after loading.");
                
                // Give the UI a moment to load the nuggets for this course
                await quickWait(1000);
            } else {
                console.warn("❌ Timed out waiting for Mathematics Secondary (H) to appear in dropdown.");
            }
        } catch (e) {
            console.error("❌ Error in selection loop:", e.message);
        }
    }

    console.timeEnd("AutomationDuration");
    console.log("🚀 Done!");
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "RUN_AUTOMATION") {
      if (abortController) abortController.abort();
      abortController = new AbortController();
      runAutomation(msg.name, msg.day, msg.subject, msg.duration, abortController.signal)
        .catch(e => console.warn("Automation stopped or failed:", e.message));
      sendResponse({ ok: true });
    }
    return true;
  });
})();