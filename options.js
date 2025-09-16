
const domainsInput = document.getElementById("domains");
const delayEnabledInput = document.getElementById("delayEnabled");
const delaySecondsInput = document.getElementById("delaySeconds");
const saveBtn = document.getElementById("save");

// Load saved settings
async function load() {
  const { delayEnabled = true, delaySeconds = 10, blockedDomains = [] } =
    await chrome.storage.local.get(["delayEnabled", "delaySeconds", "blockedDomains"]);

  delayEnabledInput.checked = delayEnabled;
  delaySecondsInput.value = delaySeconds;
  domainsInput.value = blockedDomains.join("\n");
}
load();

// Save settings
saveBtn.addEventListener("click", async () => {
  const blockedDomains = domainsInput.value
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  const delayEnabled = delayEnabledInput.checked;
  const delaySeconds = parseInt(delaySecondsInput.value, 10) || 0;

  await chrome.storage.local.set({
    blockedDomains,
    delayEnabled,
    delaySeconds
  });

  alert("Settings saved!");
});
