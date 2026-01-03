const fields = ["day", "subject", "batchData", "startDate", "startTime", "dueDate", "dueTime"];
const els = {};
fields.forEach(id => els[id] = document.getElementById(id));

const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");

async function saveAllData() {
  const data = {};
  fields.forEach(id => data[`saved_${id}`] = els[id].value);
  await chrome.storage.sync.set(data);
}

async function loadSavedData() {
  const keys = fields.map(id => `saved_${id}`);
  const data = await chrome.storage.get(keys);
  fields.forEach(id => { 
    if (data[`saved_${id}`] !== undefined) els[id].value = data[`saved_${id}`]; 
  });
}

fields.forEach(id => {
  els[id].addEventListener("change", saveAllData);
  els[id].addEventListener("input", saveAllData);
});

runBtn.addEventListener("click", async () => {
  const lines = els.batchData.value.split('\n').filter(l => l.trim() !== "");
  if (lines.length === 0) {
    statusEl.textContent = "Error: No data found.";
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

  await chrome.storage.local.set({ 
    "activeQueue": students, 
    "batchSettings": settings,
    "isPaused": false 
  });

  statusEl.textContent = `Batch started for ${students.length} students...`;
  statusEl.style.color = "blue";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: "START_BATCH" }).catch(err => {
          // If content script isn't ready, the page reload will trigger resumeBatch automatically
          console.log("Waiting for page interaction...");
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

loadSavedData();