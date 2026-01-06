(() => {
  let abortController = new AbortController();

  const quickWait = (ms) => new Promise(res => setTimeout(res, ms));

  const capitalize = (str) => {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const setNativeValue = (input, value) => {
    if (!input || !value) return;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  
  const pointerTap = (el) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const opts = { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2, view: window };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t => 
      el.dispatchEvent(new (t.includes('pointer') ? PointerEvent : MouseEvent)(t, opts))
    );
  };

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

  async function waitForSearchResult(modal, timeoutMs = 15000, signal) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) throw new Error("Aborted");
      const row = modal.querySelector('tbody tr.rc-table-row-clickable');
      const noData = modal.querySelector('.no-data-message');
      if (row) return { found: true, element: row };
      if (noData) return { found: false };
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error("Search Timeout");
  }

  async function runSingleAssignment(studentData, settings, signal) {
    const studentName = studentData.name;
    const topic = studentData.topic;
    
    console.log(`🔍 Processing: ${studentName}`);
    
    (await waitFor('[data-testid="create-assignment-button"]', 10000, document, signal)).click();
    (await waitFor('[data-testid="for-students-button"]', 10000, document, signal)).click();
    
    const modal = await waitFor('[role="dialog"]', 10000, document, signal);
    const search = await waitFor('.rc-search-box--large [data-testid="search-input"]', 5000, modal, signal);
    
    setNativeValue(search, studentName);
    modal.querySelector('.rc-search-box--large [data-testid="search-btn"]')?.click();
    
    const result = await waitForSearchResult(modal, 15000, signal);

    if (!result.found) {
      const cancelBtn = modal.querySelector('[data-testid="cancel-button"]') || 
                        Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
      await quickWait(1000);
      throw new Error("SKIP_STUDENT");
    }

    pointerTap(result.element.querySelector("label.cds-checkbox__input-label") || result.element);
    (await waitFor('[data-testid="next-button"]', 5000, modal, signal)).click();

    const newAssignmentName = `${capitalize(studentName)} - ${capitalize(topic)} HW - ${settings.day.substring(0, 3)} Class`;

    setNativeValue(await waitFor('[data-testid="text-input-assignmentName"]', 8000, document, signal), newAssignmentName);
    
    const subSelect = await waitFor('select#select.cds-select', 5000, document, signal);
    const opt = Array.from(subSelect.options).find(o => o.text.trim() === settings.subject);
    
    if (opt) { 
        subSelect.value = opt.value; 
        subSelect.dispatchEvent(new Event('change', { bubbles: true })); 
    }

    setNativeValue(await waitFor('[data-testid="date-picker-startDate"]', 2000, document, signal), settings.startDate);
    setNativeValue(await waitFor('[data-testid="time-picker-startTime"]', 2000, document, signal), settings.startTime);
    setNativeValue(await waitFor('[data-testid="date-picker-dueDate"]', 2000, document, signal), settings.dueDate);
    setNativeValue(await waitFor('[data-testid="time-picker-dueTime"]', 2000, document, signal), settings.dueTime);

    (await waitFor('[data-testid="teacher-assignment-modal-create-button"]', 5000, document, signal)).click();

    pointerTap(await waitFor('[data-testid="td-assignment-nuggets-widget-add-button"]', 10000, document, signal));
    
    // --- START MATHEMATICS COURSE LOGIC ---
    if (settings.subject === "Mathematics") {
        console.log("📐 Subject is Mathematics, checking for Course selector...");
        const MATH_H_ID = "88dc59ab-6ede-46f2-831b-c3513c14f216"; // Secondary (H) ID
        const start = Date.now();
        while (Date.now() - start < 10000 && !signal.aborted) {
            const courseSelect = document.querySelector('select[name="course"]') || document.querySelector('select.cds-select');
            if (courseSelect && Array.from(courseSelect.options).some(o => o.value === MATH_H_ID)) {
                console.log("🎯 Found Math Course dropdown, selecting Secondary (H)");
                courseSelect.value = MATH_H_ID; 
                courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
                await quickWait(1500); 
                break;
            }
            await quickWait(500);
        }
    }
    // --- END MATHEMATICS COURSE LOGIC ---

    const nInput = await waitFor('input[placeholder="Search"][data-testid="search-input"]', 8000, document, signal);
    setNativeValue(nInput, topic);
    await quickWait(800);
    const searchBtn = (nInput.closest('.rc-search-box') || nInput.parentElement).querySelector('button[data-testid="search-btn"]');
    if (searchBtn) searchBtn.click(); else nInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    
    await quickWait(2000);
    const check = await waitFor('tbody tr.rc-table-row-clickable label.cds-checkbox__input-label', 5000, document, signal);
    if (check) {
        pointerTap(check);
        await quickWait(1200);
        const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'add');
        if (addBtn) {
            ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'].forEach(t => 
                addBtn.dispatchEvent(new MouseEvent(t, { view: window, bubbles: true, buttons: 1 }))
            );
        }
    }

    await quickWait(2500);
    const backLink = document.querySelector('a[href="/teach/assignments"]') || 
                     Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.trim() === 'Back');
    if (backLink) pointerTap(backLink);
  }

async function resumeBatch() {
    const data = await chrome.storage.local.get(["activeQueue", "batchSettings", "isPaused", "totalInBatch"]);
    
    if (data.isPaused) return;
    if (!data.activeQueue || data.activeQueue.length === 0) {
        chrome.runtime.sendMessage({ type: "BATCH_COMPLETE" }).catch(() => {});
        return;
    }

    if (window.location.href.includes('/teach/assignments')) {
      const current = data.activeQueue[0];
      const total = data.totalInBatch || data.activeQueue.length;
      const currentNum = total - data.activeQueue.length + 1;

      chrome.runtime.sendMessage({ 
        type: "UPDATE_STATUS", 
        text: `Creating assignment ${currentNum} of ${total}` 
      }).catch(() => {});
      
      try {
        // Passing the whole student object now
        await runSingleAssignment(current, data.batchSettings, abortController.signal);
        
        const newQueue = data.activeQueue.slice(1);
        await chrome.storage.local.set({ "activeQueue": newQueue });
        
        if (newQueue.length === 0) {
            chrome.runtime.sendMessage({ type: "BATCH_COMPLETE" }).catch(() => {});
        } else {
            window.location.reload(); 
        }
      } catch (e) {
        if (e.message === "SKIP_STUDENT") {
           chrome.runtime.sendMessage({ 
             type: "STUDENT_SKIPPED", 
             text: `⚠️ Skipping: ${current.name} (Not found)` 
           }).catch(() => {});

           const newQueue = data.activeQueue.slice(1);
           await chrome.storage.local.set({ "activeQueue": newQueue });
           await quickWait(1500);
           window.location.reload(); 
        }
      }
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_BATCH") resumeBatch();
    if (msg.type === "STOP_AUTOMATION") {
        abortController.abort();
        chrome.storage.local.set({ isPaused: true, activeQueue: [] });
    }
  });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(resumeBatch, 1500);
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(resumeBatch, 1500);
    });
  }
})();