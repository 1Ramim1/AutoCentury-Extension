const fields = ["day", "subject", "batchData", "startDate", "startTime", "dueDate", "dueTime"];
const els = {};
fields.forEach(id => els[id] = document.getElementById(id));

const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const getInfoBtn = document.getElementById("getInfo"); // New Reference

// --- URL CHECKER ---
async function checkUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes("tutor.tnx.dev/1/dashboard")) {
    getInfoBtn.style.display = "block";
  } else {
    getInfoBtn.style.display = "none";
  }
}

// --- SCRAPER FUNCTION (Runs in the website tab) ---
function scrapeStudentData() {
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
    if (todayTopics.length) return `${name}, ${todayTopics.join(", ")}`;

    const latestWithTopics = slides.map(slide => ({ slide, topics: getTopicsFromSlide(slide) })).find(x => x.topics.length);
    if (latestWithTopics) {
      const dateLabel = getSlideDateLabel(latestWithTopics.slide);
      const topicText = latestWithTopics.topics.join(", ");
      return dateLabel ? `${name}, ${topicText} (${dateLabel})` : `${name}, ${topicText}`;
    }
    return `${name}, NO TOPIC FOUND`;
  }).filter(Boolean);

  return results.join("\n");
}

// --- BUTTON EVENT LISTENERS ---

getInfoBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: scrapeStudentData
  }, (injectionResults) => {
    const result = injectionResults[0].result;
    
    // Copy to clipboard
    navigator.clipboard.writeText(result).then(() => {
      statusEl.textContent = "✅ Info copied to clipboard!";
      statusEl.style.color = "green";
      setTimeout(() => { statusEl.textContent = ""; }, 3000);
    });
  });
});

// ... Keep existing Run/Stop/Save/Load logic below ...

async function saveAllData() {
  const data = {};
  fields.forEach(id => data[`saved_${id}`] = els[id].value);
  await chrome.storage.sync.set(data);
}

async function loadSavedData() {
  const keys = fields.map(id => `saved_${id}`);
  const data = await chrome.storage.sync.get(keys);
  fields.forEach(id => { 
    if (data[`saved_${id}`] !== undefined) els[id].value = data[`saved_${id}`]; 
  });
}

fields.forEach(id => {
  els[id].addEventListener("change", saveAllData);
  els[id].addEventListener("input", saveAllData);
});

runBtn.addEventListener("click", async () => {
  // ... (Keep your existing validation and run logic here) ...
  const now = new Date();
  const selectedStart = new Date(`${els.startDate.value}T${els.startTime.value}`);
  const selectedDue = new Date(`${els.dueDate.value}T${els.dueTime.value}`);
  if (selectedDue <= selectedStart) { statusEl.textContent = "⚠️ Due date must be AFTER start date."; return; }
  
  // (Standard Run Logic)
  const lines = els.batchData.value.split('\n').filter(l => l.trim() !== "");
  const students = lines.map(line => ({ name: line.split(',')[0]?.trim(), topic: line.split(',')[1]?.trim() }));
  await chrome.storage.local.set({ "activeQueue": students, "batchSettings": { day: els.day.value, subject: els.subject.value, startDate: els.startDate.value, startTime: els.startTime.value, dueDate: els.dueDate.value, dueTime: els.dueTime.value }, "isPaused": false });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "START_BATCH" });
});

document.getElementById("stop").addEventListener("click", async () => {
    await chrome.storage.local.set({ "activeQueue": [], "isPaused": true });
    statusEl.textContent = "Stopped.";
});

// Initialize
checkUrl();
loadSavedData();