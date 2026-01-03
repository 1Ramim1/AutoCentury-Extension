const nameEl = document.getElementById("name");
const dayEl = document.getElementById("day");
const subjectEl = document.getElementById("subject");
const topicEl = document.getElementById("topic"); // Added
const durationEl = document.getElementById("duration");
const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const saveBtn = document.getElementById("save");
const stopBtn = document.getElementById("stop");

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

// --- PERSISTENCE LOGIC ---

async function saveAllData() {
  const data = {
    savedName: nameEl.value?.trim() || "",
    savedDay: dayEl.value,
    savedSubject: subjectEl.value,
    savedTopic: topicEl.value?.trim() || "", // Added
    savedDuration: durationEl.value
  };
  await chrome.storage.sync.set(data);
  console.log("Data auto-saved");
}

async function loadSavedData() {
  const data = await chrome.storage.sync.get([
    "savedName", 
    "savedDay", 
    "savedSubject", 
    "savedTopic", // Added
    "savedDuration"
  ]);
  
  if (data.savedName !== undefined) nameEl.value = data.savedName;
  if (data.savedDay !== undefined) dayEl.value = data.savedDay;
  if (data.savedSubject !== undefined) subjectEl.value = data.savedSubject;
  if (data.savedTopic !== undefined) topicEl.value = data.savedTopic; // Added
  if (data.savedDuration !== undefined) durationEl.value = data.savedDuration;
}

// Add listeners to save automatically
[nameEl, dayEl, subjectEl, topicEl, durationEl].forEach(el => {
  el.addEventListener("change", saveAllData);
  el.addEventListener("input", saveAllData); 
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
      topic: topicEl.value, // Added
      duration: durationEl.value 
    });
    setStatus(resp?.ok ? "Started." : `Failed: ${resp?.error || "unknown"}`);
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
});

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

loadSavedData();