(() => {
  if (window.__studentPickerInstalled) return;
  window.__studentPickerInstalled = true;
  let abortController = null;

  // --- Selectors ---
  const START_TIME_SEL = '[data-testid="time-picker-startTime"]';
  const DUE_TIME_SEL = '[data-testid="time-picker-dueTime"]';
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
    if (!input || !value) return;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function pointerTap(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const opts = { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2, view: window };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  // New specific clicker for the Add button
  function forceAddClick(btn) {
    const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
    events.forEach(type => {
        btn.dispatchEvent(new MouseEvent(type, {
            view: window, bubbles: true, cancelable: true, buttons: 1
        }));
    });
  }

  async function runAutomation(data, signal) {
    const isMainDoc = window.location.href.includes('/teach/assignments');

    if (isMainDoc) {
        // --- PART A: ASSIGNMENT SETUP ---
        let mappedSubject = data.subject; 
        if (["Physics", "Chemistry", "Biology"].includes(data.subject)) mappedSubject = "Science";
        else if (["English Language", "English Literature"].includes(data.subject)) mappedSubject = "English";

        const createBtn = await waitFor(CREATE_SEL, 10000, document, signal);
        createBtn.click();
        const studentsBtn = await waitFor(STUDENTS_SEL, 10000, document, signal);
        studentsBtn.click();
        
        const modal = await waitFor(MODAL_SEL, 10000, document, signal);
        const searchInput = await waitFor('.rc-search-box--large ' + SEARCH_INPUT_SEL, 5000, modal, signal);
        setNativeValue(searchInput, data.name);
        
        const searchBtn = modal.querySelector('.rc-search-box--large ' + SEARCH_BTN_SEL);
        if (searchBtn) searchBtn.click();
        
        const firstRow = await waitFor(TABLE_ROW_SEL, 8000, modal, signal);
        pointerTap(firstRow.querySelector("label.cds-checkbox__input-label") || firstRow);
        (await waitFor(NEXT_BTN_SEL, 5000, modal, signal)).click();

        setNativeValue(await waitFor(ASSIGNMENT_NAME_SEL, 8000, document, signal), `${data.name} ${data.day} ${data.subject} Homework`);

        const subSelect = await waitFor(SUBJECT_SELECT_SEL, 5000, document, signal);
        const targetOpt = Array.from(subSelect.options).find(o => o.text.trim() === mappedSubject);
        if (targetOpt) { subSelect.value = targetOpt.value; subSelect.dispatchEvent(new Event('change', { bubbles: true })); }

        setNativeValue(await waitFor(START_DATE_SEL, 2000, document, signal), data.startDate);
        setNativeValue(await waitFor(START_TIME_SEL, 2000, document, signal), data.startTime);
        setNativeValue(await waitFor(DUE_DATE_SEL, 2000, document, signal), data.dueDate);
        setNativeValue(await waitFor(DUE_TIME_SEL, 2000, document, signal), data.dueTime);

        (await waitFor(FINAL_CREATE_BTN_SEL, 5000, document, signal)).click();
        pointerTap(await waitFor(ADD_NUGGETS_BTN_SEL, 10000, document, signal));
        
        if (data.subject === "Mathematics") {
            const MATH_H_ID = "88dc59ab-6ede-46f2-831b-c3513c14f216";
            const start = Date.now();
            while (Date.now() - start < 10000 && !signal.aborted) {
                const cs = document.querySelector('select[name="course"]');
                if (cs && Array.from(cs.options).some(o => o.value === MATH_H_ID)) {
                    cs.value = MATH_H_ID; cs.dispatchEvent(new Event('change', { bubbles: true }));
                    await quickWait(1000); break;
                }
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    // --- PART B: NUGGET SELECTION (In frame or main) ---
    if (data.topic) {
        try {
            const nInput = await waitFor('input[placeholder="Search"][data-testid="search-input"]', 8000, document, signal);
            setNativeValue(nInput, data.topic);
            await quickWait(800);
            
            const sBtn = (nInput.closest('.rc-search-box') || nInput.parentElement).querySelector('button[data-testid="search-btn"]');
            if (sBtn) sBtn.click(); 
            else nInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            
            await quickWait(2000);

            const check = await waitFor('tbody tr.rc-table-row-clickable label.cds-checkbox__input-label', 5000, document, signal);
            if (check) {
                pointerTap(check);
                console.log("Nugget checked. Waiting for button...");
                await quickWait(1500);

                // Find the ADD button using the info from Test 1
                const addBtn = Array.from(document.querySelectorAll('button')).find(b => 
                    b.textContent.trim().toLowerCase() === 'add' && 
                    b.className.includes('btn--primary')
                );

                if (addBtn) { 
                    console.log("Found button, applying nuclear click...");
                    forceAddClick(addBtn);
                    await quickWait(1000);
                }
            }
        } catch (e) { console.log("Frame check finished."); }
    }

    // --- PART C: FINAL BACK ---
    if (isMainDoc) {
        try {
            await quickWait(2500);
            const back = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.trim() === 'Back');
            if (back) pointerTap(back);
        } catch (e) {}
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "RUN_AUTOMATION") {
      if (abortController) abortController.abort();
      abortController = new AbortController();
      runAutomation(msg, abortController.signal).catch(console.warn);
      sendResponse({ ok: true });
    } else if (msg.type === "STOP_AUTOMATION") { abortController?.abort(); sendResponse({ ok: true }); }
    return true;
  });
})();