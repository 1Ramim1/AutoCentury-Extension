const fields = ["day", "subject", "batchData", "startDate", "startTime", "dueDate", "dueTime"];
const els = {};
fields.forEach(id => els[id] = document.getElementById(id));

const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const saveBtn = document.getElementById("save");

// --- PERSISTENCE LOGIC ---

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

saveBtn.addEventListener("click", async () => {
  await saveAllData();
  statusEl.textContent = "Settings saved!";
  statusEl.style.color = "green";
  setTimeout(() => { statusEl.textContent = ""; }, 2000);
});

// --- AUTOMATION LOGIC ---

runBtn.addEventListener("click", async () => {
  const lines = els.batchData.value.split('\n').filter(l => l.trim() !== "");
  
  if (lines.length === 0) {
    statusEl.textContent = "Error: No data found.";
    statusEl.style.color = "red";
    return;
  }

  // 1. Create Date Objects for Comparison
  const now = new Date();
  const selectedStart = new Date(`${els.startDate.value}T${els.startTime.value}`);
  const selectedDue = new Date(`${els.dueDate.value}T${els.dueTime.value}`);
  
  // 2. Validate Start Time (at least 30 mins in future)
  const diffMs = selectedStart - now;
  const diffMins = diffMs / (1000 * 60);

  if (isNaN(selectedStart.getTime()) || isNaN(selectedDue.getTime())) {
    statusEl.textContent = "Error: Please enter valid dates and times.";
    statusEl.style.color = "red";
    return;
  }

  if (diffMins < 30) {
    statusEl.textContent = "⚠️ Start time must be at least 30 mins in the future.";
    statusEl.style.color = "orange";
    return;
  }

  // 3. Validate Due Date (must be after Start Date)
  if (selectedDue <= selectedStart) {
    statusEl.textContent = "⚠️ Due date must be AFTER the start date.";
    statusEl.style.color = "orange";
    return;
  }

  // 4. Proceed with Automation
  const students = lines.map(line => {
    const parts = line.split(',');
    return { 
        name: parts[0]?.trim() || "Student", 
        topic: parts[1]?.trim() || "Topic" 
    };
  });

  const settings = {
    day: els.day.value,
    subject: els.subject.value,
    startDate: els.startDate.value,
    startTime: els.startTime.value,
    dueDate: els.dueDate.value,
    dueTime: els.dueTime.value
  };

  await chrome.storage.local.set({ 
    "activeQueue": students, 
    "batchSettings": settings,
    "isPaused": false 
  });

  statusEl.textContent = `Batch started for ${students.length} students...`;
  statusEl.style.color = "blue";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: "START_BATCH" }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "BATCH_COMPLETE") {
    statusEl.textContent = "✅ All Assignments Done!";
    statusEl.style.color = "green";
  }
});

document.getElementById("stop").addEventListener("click", async () => {
    await chrome.storage.local.set({ "activeQueue": [], "isPaused": true });
    statusEl.textContent = "Stopped.";
    statusEl.style.color = "red";
});

loadSavedData();