const nameEl = document.getElementById("name");
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

  // If the content script hasn't loaded yet on this tab, this can fail.
  // In that case we can inject content.js manually as a fallback.
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

async function loadSavedName() {
  const { savedName } = await chrome.storage.sync.get(["savedName"]);
  if (savedName) nameEl.value = savedName;
}

runBtn.addEventListener("click", async () => {
  try {
    setStatus("Running...");
    const name = nameEl.value?.trim();
    if (!name) return setStatus("Enter a name first.");

    const resp = await sendToContent({ type: "RUN_AUTOMATION", name });
    setStatus(resp?.ok ? "Started. Check the page console for logs." : `Failed to start: ${resp?.error || "unknown"}`);
  } catch (e) {
    setStatus(`Error: ${e.message || e}`);
  }
});

saveBtn.addEventListener("click", async () => {
  const name = nameEl.value?.trim() || "";
  await chrome.storage.sync.set({ savedName: name });
  setStatus("Saved.");
});

stopBtn.addEventListener("click", async () => {
  try {
    const resp = await sendToContent({ type: "STOP_AUTOMATION" });
    setStatus(resp?.ok ? "Stop requested." : `Stop failed: ${resp?.error || "unknown"}`);
  } catch (e) {
    setStatus(`Error: ${e.message || e}`);
  }
});

loadSavedName();
