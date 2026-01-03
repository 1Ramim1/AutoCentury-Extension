const fields = ["name", "day", "subject", "topic", "startDate", "startTime", "dueDate", "dueTime"];
const els = {};
fields.forEach(id => els[id] = document.getElementById(id));

const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const saveBtn = document.getElementById("save");
const stopBtn = document.getElementById("stop");

function setStatus(msg) { statusEl.textContent = msg || ""; }

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
  try {
    setStatus("Running...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const payload = { type: "RUN_AUTOMATION" };
    fields.forEach(id => payload[id] = els[id].value);
    
    await chrome.tabs.sendMessage(tab.id, payload);
    setStatus("Started.");
  } catch (e) { setStatus(`Error: ${e.message}`); }
});

saveBtn.addEventListener("click", async () => { await saveAllData(); setStatus("Saved."); });
loadSavedData();