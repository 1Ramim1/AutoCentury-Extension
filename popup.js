// Added nuggetAutomation to the fields array
const fields = ["day", "subject", "batchData", "startDate", "startTime", "dueDate", "dueTime", "nuggetAutomation"];
const els = {};
fields.forEach(id => els[id] = document.getElementById(id));

const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const getInfoBtn = document.getElementById("getInfo");

async function checkUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes("tutor.tnx.dev/1/dashboard")) {
    getInfoBtn.style.display = "block";
  } else {
    getInfoBtn.style.display = "none";
  }
}

function scrapeStudentData() {
  console.log("Scraping students...");
  const studentLis = Array.from(document.querySelectorAll('ul.space-y-4 > li'));
  function getTopicsFromSlide(slide) {
    if (!slide) return [];
    const topicDivs = Array.from(slide.querySelectorAll('div[class*="bg-secondary"][class*="leading-tight"]'));
    const topics = topicDivs.map(d => d.textContent.trim()).filter(Boolean);
    return [...new Set(topics)];
  }
  function getSlideDateLabel(slide) {
    if (!slide) return null;
    const dateSpan = slide.querySelector('span[title][class*="truncate"]') || slide.querySelector('span[title]');
    return dateSpan ? dateSpan.textContent.trim() : null;
  }
  const results = studentLis.map(li => {
    const nameEl = li.querySelector("span.truncate.inline-block");
    if (!nameEl) return null;
    const name = nameEl.getAttribute("title") || nameEl.textContent.trim();
    const slides = Array.from(li.querySelectorAll(".swiper-slide"));
    const todaySlide = slides.find(s => s.textContent.includes("Today"));
    const todayTopics = getTopicsFromSlide(todaySlide);
    if (todayTopics.length) return `${name}, ${todayTopics.join(", ")};`;
    const latestWithTopics = slides.map(slide => ({ slide, topics: getTopicsFromSlide(slide) })).find(x => x.topics.length);
    if (latestWithTopics) {
      const topicText = latestWithTopics.topics.join(", ");
      return `${name}, ${topicText};`;
    }
    return `${name}, NO TOPIC FOUND;`;
  }).filter(Boolean);
  return results.join("\n");
}

getInfoBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeStudentData }, (injectionResults) => {
    navigator.clipboard.writeText(injectionResults[0].result).then(() => {
      statusEl.textContent = "✅ Info copied!";
      statusEl.style.color = "green";
      setTimeout(() => { statusEl.textContent = ""; }, 3000);
    });
  });
});

async function saveAllData() {
  const data = {};
  fields.forEach(id => {
    // Logic to handle checkbox vs text/select
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

  // --- Date Validation ---
  const now = new Date();
  const selectedStart = new Date(`${els.startDate.value}T${els.startTime.value}`);
  const selectedDue = new Date(`${els.dueDate.value}T${els.dueTime.value}`);
  const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60000);

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

  // --- Semicolon Parsing & Validation ---
  const rawData = els.batchData.value.trim();
  if (!rawData) return;

  // Split by semicolon
  const blocks = rawData.split(';').map(b => b.trim()).filter(b => b !== "");
  const processedStudents = [];
  const isScience = (els.subject.value === "Science");

  for (let block of blocks) {
    const args = block.split(',').map(a => a.trim()).filter(a => a !== "");
    
    if (isScience) {
      // REQUIRE 4 ARGS
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
      // REQUIRE 2 ARGS
      if (args.length !== 2) {
        statusEl.textContent = "⚠️ Format incorrect: Maths or English subjects require 2 arguments.";
        statusEl.style.color = "red";
        return;
      }
    }

    processedStudents.push({ 
      name: args[0], 
      topic: args[1], 
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
      nuggetAutomation: els.nuggetAutomation.checked // Added to batch settings
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
    
    // 1. Clear storage immediately
    await chrome.storage.local.set({ "activeQueue": [], "isPaused": true });
    
    // 2. Tell content script to ABORT current waitFor loops
    if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "STOP_AUTOMATION" }).catch(() => {});
    }

    statusEl.textContent = "Stopped.";
    statusEl.style.color = "red";
});

checkUrl();
loadSavedData();