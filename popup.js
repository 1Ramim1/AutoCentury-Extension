const nameEl = document.getElementById("name");
const dayEl = document.getElementById("day");
const subjectEl = document.getElementById("subject");
const durationEl = document.getElementById("duration");
const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const saveBtn = document.getElementById("save");
const stopBtn = document.getElementById("stop");

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

// --- PERSISTENCE LOGIC ---

// Function to save everything currently in the UI
async function saveAllData() {
  const data = {
    savedName: nameEl.value?.trim() || "",
    savedDay: dayEl.value,
    savedSubject: subjectEl.value,
    savedDuration: durationEl.value
  };
  await chrome.storage.sync.set(data);
  console.log("Data auto-saved");
}

// Loads data and sets the UI values
async function loadSavedData() {
  const data = await chrome.storage.sync.get([
    "savedName", 
    "savedDay", 
    "savedSubject", 
    "savedDuration"
  ]);
  
  if (data.savedName !== undefined) nameEl.value = data.savedName;
  if (data.savedDay !== undefined) dayEl.value = data.savedDay;
  if (data.savedSubject !== undefined) subjectEl.value = data.savedSubject;
  if (data.savedDuration !== undefined) durationEl.value = data.savedDuration;
}

// Add listeners to save automatically whenever a user changes a value
[nameEl, dayEl, subjectEl, durationEl].forEach(el => {
  el.addEventListener("change", saveAllData);
  el.addEventListener("input", saveAllData); // 'input' handles typing in real-time
});

// --- MESSAGING LOGIC ---

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(message) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active tab found.");

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (e) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    return await chrome.tabs.sendMessage(tab.id, message);
  }
}

runBtn.addEventListener("click", async () => {
  try {
    setStatus("Running...");
    const resp = await sendToContent({ 
      type: "RUN_AUTOMATION", 
      name: nameEl.value, 
      day: dayEl.value, 
      subject: subjectEl.value, 
      duration: durationEl.value 
    });
    setStatus(resp?.ok ? "Started." : `Failed: ${resp?.error || "unknown"}`);
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
});

// Explicit save button still works if preferred
saveBtn.addEventListener("click", async () => {
  await saveAllData();
  setStatus("Saved manually.");
});

stopBtn.addEventListener("click", async () => {
  try {
    const resp = await sendToContent({ type: "STOP_AUTOMATION" });
    setStatus(resp?.ok ? "Stop requested." : "Stop failed.");
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
});

// Initialize the UI with saved data when popup opens
loadSavedData();