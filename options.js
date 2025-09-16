const delayInput = document.getElementById("delay");
const domainsInput = document.getElementById("domains");
const saveBtn = document.getElementById("save");

async function load() {
  const { delaySeconds = 12, blockedDomains = [] } = await chrome.storage.local.get(["delaySeconds", "blockedDomains"]);
  delayInput.value = delaySeconds;
  domainsInput.value = blockedDomains.join("\n");
}
load();

saveBtn.addEventListener("click", async () => {
  const delaySeconds = parseInt(delayInput.value, 10) || 0;
  const blockedDomains = domainsInput.value
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);
  await chrome.storage.local.set({ delaySeconds, blockedDomains });
  alert("Saved! (Rules reloaded)");
});
