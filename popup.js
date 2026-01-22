const fields = ["day", "subject", "batchData", "startDate", "startTime", "dueDate", "dueTime", "nuggetAutomation"];
const els = {};
fields.forEach(id => els[id] = document.getElementById(id));

const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const getInfoBtn = document.getElementById("getInfo");

// Copy and Main Dasboard
const mainView = document.getElementById("mainView");
const selectionView = document.getElementById("selectionView");
const studentList = document.getElementById("studentList");

async function checkUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes("tutor.tnx.dev/1/dashboard")) {
    getInfoBtn.style.display = "block";
  } else {
    getInfoBtn.style.display = "none";
  }
}

function scrapeStudentData() {
  const studentLis = Array.from(document.querySelectorAll('ul.space-y-4 > li'));
  
  function getTopicsFromSlide(slide) {
    if (!slide) return [];
    const topicDivs = Array.from(slide.querySelectorAll('div[class*="bg-secondary"][class*="leading-tight"]'));
    return [...new Set(topicDivs.map(d => d.textContent.trim()).filter(Boolean))];
  }

  function getSlideDateLabel(slide) {
    if (!slide) return null;
    const dateSpan = slide.querySelector('span[title][class*="truncate"]') || slide.querySelector('span[title]');
    return dateSpan ? dateSpan.textContent.trim() : null;
  }

  return studentLis.map(li => {
    const nameEl = li.querySelector("span.truncate.inline-block");
    if (!nameEl) return null;
    const name = nameEl.getAttribute("title") || nameEl.textContent.trim();
    const slides = Array.from(li.querySelectorAll(".swiper-slide"));
    
    const todaySlide = slides.find(s => s.textContent.includes("Today"));
    const todayTopics = getTopicsFromSlide(todaySlide);
    
    let topics = todayTopics;
    let dateLabel = "Today";

    if (!topics.length) {
      const latest = slides.map(s => ({ s, t: getTopicsFromSlide(s) })).find(x => x.t.length);
      if (latest) {
        topics = latest.t;
        dateLabel = getSlideDateLabel(latest.s) || "Previous";
      }
    }

    return {
      name,
      topic: topics.length ? topics.join(", ") : "NO TOPIC FOUND",
      date: dateLabel
    };
  }).filter(Boolean);
}

// This is for the copy dashboard and handles copy selection
getInfoBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeStudentData }, (injectionResults) => {
    const scrapedData = injectionResults[0].result;
    
    studentList.innerHTML = ""; // Clears Existing
    
    scrapedData.forEach((student, index) => {
      const item = document.createElement("div");
      item.className = "student-item";
      item.innerHTML = `
        <input type="checkbox" id="st-${index}" checked 
               data-name="${student.name}" 
               data-topic="${student.topic}" 
               data-date="${student.date}">
        <div class="student-info">
            <label for="st-${index}" class="student-name">${student.name}</label>
            <span class="student-topic">${student.topic} — <span class="date-tag">${student.date}</span></span>
        </div>
      `;
      studentList.appendChild(item);
    });

    mainView.style.display = "none";
    selectionView.style.display = "block";
  });
});

document.getElementById("confirmCopy").addEventListener("click", () => {
  const selected = Array.from(studentList.querySelectorAll('input:checked'));
  
  const formattedText = selected.map(cb => {
    const name = cb.dataset.name;
    const topic = cb.dataset.topic;
    const date = cb.dataset.date;
    const dateSuffix = date !== "Today" ? ` (${date})` : "";
    return `${name}, ${topic}${dateSuffix};`;
  }).join("\n");

  navigator.clipboard.writeText(formattedText).then(() => {
    statusEl.textContent = `✅ ${selected.length} students copied!`;
    statusEl.style.color = "green";
    selectionView.style.display = "none";
    mainView.style.display = "block";
    setTimeout(() => { statusEl.textContent = ""; }, 3000);
  });
});

document.getElementById("cancelSelection").addEventListener("click", () => {
  selectionView.style.display = "none";
  mainView.style.display = "block";
});

async function saveAllData() {
  const data = {};
  fields.forEach(id => {
    if (els[id].type === "checkbox") {
      data[`saved_${id}`] = els[id].checked;
    } else {
      data[`saved_${id}`] = els[id].value;
    }
  });
  await chrome.storage.sync.set(data);
}

async function loadSavedData() {
  const keys = fields.map(id => `saved_${id}`);
  const data = await chrome.storage.sync.get(keys);
  fields.forEach(id => { 
    if (data[`saved_${id}`] !== undefined) {
      if (els[id].type === "checkbox") {
        els[id].checked = data[`saved_${id}`];
      } else {
        els[id].value = data[`saved_${id}`];
      }
    }
  });
}

fields.forEach(id => {
  els[id].addEventListener("change", saveAllData);
  els[id].addEventListener("input", saveAllData);
});

runBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes("app.century.tech/teach/assignments")) {
    statusEl.textContent = "⚠️ Error: Wrong page";
    statusEl.style.color = "red";
    return;
  }

  const now = new Date();
  const selectedStart = new Date(`${els.startDate.value}T${els.startTime.value}`);
  const selectedDue = new Date(`${els.dueDate.value}T${els.dueTime.value}`);
  const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60000);

  if (!els.startDate.value || !els.startTime.value || !els.dueDate.value || !els.dueTime.value) {
    statusEl.textContent = "⚠️ Please fill in all date and time fields.";
    statusEl.style.color = "red";
    return;
  }
  if (selectedStart < thirtyMinsFromNow) {
    statusEl.textContent = "⚠️ Start time must be at least 30 mins in future.";
    statusEl.style.color = "red";
    return;
  }
  if (selectedDue <= selectedStart) { 
    statusEl.textContent = "⚠️ Due date must be AFTER start date."; 
    statusEl.style.color = "red";
    return; 
  }

  const rawData = els.batchData.value.trim();
  if (!rawData) return;

  if (!rawData.endsWith(';')) {
    statusEl.textContent = "⚠️ Error: Every entry must end with a semicolon (;)";
    statusEl.style.color = "red";
    return;
  }

  const blocks = rawData.split(';').map(b => b.trim()).filter(b => b !== "");
  const processedStudents = [];
  const isScience = (els.subject.value === "Science");

  // Right now this error code doesn't work in any scenario. Need to check further.
  for (let block of blocks) {
    if (!rawData.includes(block + ';')) {
      statusEl.textContent = `⚠️ Format incorrect: Missing semicolon after "${block}"`;
      statusEl.style.color = "red";
      return;
    }

    const args = block.split(',').map(a => a.trim()).filter(a => a !== "");
    
    if (isScience) {
      if (args.length !== 4) {
        statusEl.textContent = "⚠️ Format incorrect: Science requires 4 arguments per student.";
        statusEl.style.color = "red";
        return;
      }
      const sub = args[2].toLowerCase();
      const board = args[3].toLowerCase();
      if (!['phy', 'chem', 'bio'].includes(sub)) {
        statusEl.textContent = `⚠️ Format incorrect: "${args[2]}" is not phy, chem, or bio.`;
        statusEl.style.color = "red";
        return;
      }
      if (!['base', 'aqa', 'edexcel', 'ks3'].includes(board)) {
        statusEl.textContent = `⚠️ Format incorrect: "${args[3]}" is not aqa, edexcel, base or ks3.`;
        statusEl.style.color = "red";
        return;
      }
    } else {
      if (args.length !== 2) {
        statusEl.textContent = "⚠️ Format incorrect: Maths or English subjects require 2 arguments.";
        statusEl.style.color = "red";
        return;
      }
    }

    processedStudents.push({ 
      name: args[0],
      topic: args[1],  
      // topic: args[1].split('(')[0].trim(), would auto ignore the date if left behind 
      scienceSub: isScience ? args[2] : null, 
      scienceBoard: isScience ? args[3] : null 
    });
  }

  await chrome.storage.local.set({ 
    "activeQueue": processedStudents, 
    "totalInBatch": processedStudents.length,
    "batchSettings": { 
      day: els.day.value, 
      subject: els.subject.value, 
      startDate: els.startDate.value, 
      startTime: els.startTime.value, 
      dueDate: els.dueDate.value, 
      dueTime: els.dueTime.value,
      nuggetAutomation: els.nuggetAutomation.checked 
    }, 
    "isPaused": false 
  });

  statusEl.textContent = `Creating assignment 1 of ${processedStudents.length}`;
  statusEl.style.color = "blue";
  
  chrome.tabs.sendMessage(tab.id, { type: "START_BATCH" }).catch(() => {
    chrome.tabs.reload(tab.id);
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "UPDATE_STATUS") {
    statusEl.textContent = msg.text;
    statusEl.style.color = "blue";
  }
  if (msg.type === "STUDENT_SKIPPED") {
    statusEl.textContent = msg.text;
    statusEl.style.color = "orange";
  }
  if (msg.type === "BATCH_COMPLETE") {
    statusEl.textContent = "✅ All Assignments Done!";
    statusEl.style.color = "green";
  }
});

document.getElementById("stop").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.storage.local.set({ "activeQueue": [], "isPaused": true });
    if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "STOP_AUTOMATION" }).catch(() => {});
    }
    statusEl.textContent = "Stopped.";
    statusEl.style.color = "red";
});

checkUrl();
loadSavedData();