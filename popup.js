const fields = ["day", "subject", "batchData", "startDate", "startTime", "dueDate", "dueTime"];
const els = {};
fields.forEach(id => els[id] = document.getElementById(id));

const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const saveBtn = document.getElementById("save"); // Get the save button

// --- PERSISTENCE LOGIC ---

async function saveAllData() {
  const data = {};
  fields.forEach(id => data[`saved_${id}`] = els[id].value);
  // Using sync so your settings follow your Chrome profile
  await chrome.storage.sync.set(data);
  console.log("Data saved automatically");
}

async function loadSavedData() {
  const keys = fields.map(id => `saved_${id}`);
  // FIXED: Changed chrome.storage.get to chrome.storage.sync.get
  const data = await chrome.storage.sync.get(keys);
  
  fields.forEach(id => { 
    if (data[`saved_${id}`] !== undefined) {
      els[id].value = data[`saved_${id}`];
    }
  });
}

// Add listeners to every input to save as you type
fields.forEach(id => {
  els[id].addEventListener("change", saveAllData);
  els[id].addEventListener("input", saveAllData);
});

// Manual save button feedback
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

  // Save the run-state to local (volatile) storage
  await chrome.storage.local.set({ 
    "activeQueue": students, 
    "batchSettings": settings,
    "isPaused": false 
  });

  statusEl.textContent = `Batch started for ${students.length} students...`;
  statusEl.style.color = "blue";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: "START_BATCH" }).catch(() => {
          console.log("Tab not ready. Automation will start on next page load.");
      });
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

// Initialize on open
loadSavedData();