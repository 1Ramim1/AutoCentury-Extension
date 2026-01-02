const nameEl = document.getElementById("name");
const dayEl = document.getElementById("day");
const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const saveBtn = document.getElementById("save");
const stopBtn = document.getElementById("stop");

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

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
    // Fallback: inject content.js then retry
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    return await chrome.tabs.sendMessage(tab.id, message);
  }
}

// Loads both name and day from storage
async function loadSavedData() {
  const { savedName, savedDay } = await chrome.storage.sync.get(["savedName", "savedDay"]);
  if (savedName) nameEl.value = savedName;
  if (savedDay) dayEl.value = savedDay;
}

runBtn.addEventListener("click", async () => {
  try {
    setStatus("Running...");
    const name = nameEl.value?.trim();
    const day = dayEl.value; 

    if (!name) return setStatus("Enter a name first.");

    // Pass both name and day to the content script
    const resp = await sendToContent({ type: "RUN_AUTOMATION", name, day });
    setStatus(resp?.ok ? "Started. Check the page console." : `Failed: ${resp?.error}`);
  } catch (e) {
    setStatus(`Error: ${e.message || e}`);
  }
});

saveBtn.addEventListener("click", async () => {
  const name = nameEl.value?.trim() || "";
  const day = dayEl.value;
  await chrome.storage.sync.set({ savedName: name, savedDay: day });
  setStatus("Saved preferences.");
});

stopBtn.addEventListener("click", async () => {
  try {
    const resp = await sendToContent({ type: "STOP_AUTOMATION" });
    setStatus(resp?.ok ? "Stop requested." : `Stop failed: ${resp?.error}`);
  } catch (e) {
    setStatus(`Error: ${e.message || e}`);
  }
});

loadSavedData();