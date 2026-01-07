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

    if (settings.nuggetAutomation) {
        pointerTap(await waitFor('[data-testid="td-assignment-nuggets-widget-add-button"]', 10000, document, signal));
        
        let targetCourseId = null;
        if (settings.subject === "Mathematics") {
            targetCourseId = "88dc59ab-6ede-46f2-831b-c3513c14f216";
        } else if (settings.subject === "Science" && studentData.scienceSub && studentData.scienceBoard) {
            const sub = studentData.scienceSub.toLowerCase();
            const board = studentData.scienceBoard.toLowerCase();
            if (sub === 'bio'|| sub === 'biology') {
                if (board === 'edexcel') targetCourseId = "6733d990-e454-402e-8972-0e25196521e5";
                else if (board === 'aqa') targetCourseId = "cbdbbf43-46d3-49bf-904e-b8288c727394";
                else if (board === 'ks3') targetCourseId = "b3df9fbf-0962-4439-bb89-7d0fcc887ca0";
                else if (board === 'base') targetCourseId = "5e4482d1-4e81-4ffc-9e9a-5daa85b2fb75";
            } else if (sub === 'chem' || sub === 'chemistry') {
                if (board === 'edexcel') targetCourseId = "0a5541be-32ff-4f04-847b-c0a790cd0fa5";
                else if (board === 'aqa') targetCourseId = "cb7e6586-514b-465e-a618-ecae26bd9dd4";
                else if (board === 'ks3') targetCourseId = "01324b05-aeda-44ae-8851-d54909ced30a";
                else if (board === 'base') targetCourseId = "fce3e428-4df0-4c5a-8693-0aef611f01de";
            } else if (sub === 'phy' || sub === 'physics') {
                if (board === 'edexcel') targetCourseId = "060c1551-3592-4bbc-ab74-da98cbe5a65d";
                else if (board === 'aqa') targetCourseId = "9219bba2-8939-4511-91a7-12f78ce15519";
                else if (board === 'ks3') targetCourseId = "02dd6a47-6716-45f1-b78c-70bf4e74e0c2";
                else if (board === 'base') targetCourseId = "fb35f799-e198-466b-ba23-84175ce39fde";
            }
        }

        if (targetCourseId) {
            const start = Date.now();
            while (Date.now() - start < 10000 && !signal.aborted) {
                const courseSelect = document.querySelector('select[name="course"]') || document.querySelector('select.cds-select');
                if (courseSelect && Array.from(courseSelect.options).some(o => o.value === targetCourseId)) {
                    courseSelect.value = targetCourseId; 
                    courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    await quickWait(1500); 
                    break;
                }
                await quickWait(500);
            }
        }

        const nInput = await waitFor('input[placeholder="Search"][data-testid="search-input"]', 8000, document, signal);
        setNativeValue(nInput, topic);
        await quickWait(800);
        const searchBtn = (nInput.closest('.rc-search-box') || nInput.parentElement).querySelector('button[data-testid="search-btn"]');
        if (searchBtn) searchBtn.click(); else nInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        
        await quickWait(2000);
        const check = document.querySelector('tbody tr.rc-table-row-clickable label.cds-checkbox__input-label');
        if (check) {
            pointerTap(check);
            await quickWait(1200);
            const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'add');
            if (addBtn) {
                ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'].forEach(t => 
                    addBtn.dispatchEvent(new MouseEvent(t, { view: window, bubbles: true, buttons: 1 }))
                );
            }
        } else {
            throw new Error("SKIP_NUGGET");
        }
    }

    await quickWait(750); 
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

      chrome.runtime.sendMessage({ type: "UPDATE_STATUS", text: `Creating assignment ${currentNum} of ${total}` }).catch(() => {});
      
      try {
        await runSingleAssignment(current, data.batchSettings, abortController.signal);
        const newQueue = data.activeQueue.slice(1);
        await chrome.storage.local.set({ "activeQueue": newQueue });
        
        if (newQueue.length === 0) {
            chrome.runtime.sendMessage({ type: "BATCH_COMPLETE" }).catch(() => {});
        } else {
            window.location.reload(); 
        }
      } catch (e) {
        if (e.message === "Aborted") {
            console.log("Automation stopped by user.");
            return;
        }
        if (e.message === "SKIP_STUDENT" || e.message === "SKIP_NUGGET") {
           const msgText = e.message === "SKIP_STUDENT" 
             ? `⚠️ Skipping Student: "${current.name}" not found` 
             : `⚠️ Skipping Nugget: "${current.topic}" not found`;

           chrome.runtime.sendMessage({ type: "STUDENT_SKIPPED", text: msgText }).catch(() => {});

           const newQueue = data.activeQueue.slice(1);
           await chrome.storage.local.set({ "activeQueue": newQueue });

           if (e.message === "SKIP_NUGGET") {
              const dismissBtn = document.querySelector('[data-testid="dismiss-button"]');
              if (dismissBtn) dismissBtn.click();
              await quickWait(500);

              const backLink = document.querySelector('a[href="/teach/assignments"]') || 
                               Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.trim() === 'Back');
              if (backLink) pointerTap(backLink);
           }

           await quickWait(1000);

           if (newQueue.length === 0) {
               chrome.runtime.sendMessage({ type: "BATCH_COMPLETE" }).catch(() => {});
           } else {
               window.location.reload(); 
           }
        }
      }
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_BATCH") resumeBatch();
    if (msg.type === "STOP_AUTOMATION") {
        abortController.abort();
        chrome.storage.local.set({ "activeQueue": [], "isPaused": true });
    }
  });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(resumeBatch, 1000);
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(resumeBatch, 1500);
    });
  }
})();