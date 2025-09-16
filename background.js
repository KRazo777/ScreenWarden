// background.js
const DEFAULT_SETTINGS = {
  delaySeconds: 10,
  blockedDomains: ["twitter.com", "x.com", "reddit.com", "youtube.com", "tiktok.com"]
};

// tabId -> last intended URL to open for blocked navigation
const lastTargetByTab = new Map();

// Helpers
function getExtensionPath(path) {
  return chrome.runtime.getURL(path);
}

let updatingRules = false;

function buildRules(blockedDomains) {
  let id = 1000;
  const holdPath = "/hold.html";
  return blockedDomains.map(domain => ({
    id: id++,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: holdPath } },
    condition: {
      resourceTypes: ["main_frame"],
      urlFilter: `||${domain}/`
    }
  }));
}

async function ensureRules() {
  if (updatingRules) return;         // prevent concurrent calls
  updatingRules = true;
  try {
    const { blockedDomains = DEFAULT_SETTINGS.blockedDomains } =
      await chrome.storage.local.get("blockedDomains");

    const rules = buildRules(blockedDomains);

    // Remove whatever exists NOW (separate call)
    const current = await chrome.declarativeNetRequest.getDynamicRules();
    if (current.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: current.map(r => r.id)
      });
    }

    // Add our fresh set
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules
    });
  } finally {
    updatingRules = false;
  }
}

function domainFromUrl(u) {
  try { return new URL(u).hostname; } catch { return null; }
}

function allowRuleIdForTab(tabId) {
  return 500000 + (tabId || 0);
}

// IMPORTANT: session-scoped rules (so we can use tabIds)
async function addTemporaryAllowRule(tabId, targetUrl, ttlMs = 8000) {
  const host = domainFromUrl(targetUrl);
  if (!host) return;

  const ruleId = allowRuleIdForTab(tabId);
  const allowRule = {
    id: ruleId,
    priority: 10000,             // higher than your redirect rules
    action: { type: "allow" },
    condition: {
      resourceTypes: ["main_frame"],
      tabIds: [tabId],           // <-- only valid on session rules
      urlFilter: `||${host}/`
    }
  };

  // Remove any previous session rule with this id, then add fresh
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
    addRules: [allowRule]
  });

  // Auto-remove after ttlMs so the bypass doesn't persist
  setTimeout(async () => {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId]
    });
  }, ttlMs);
}


// Observe original URLs so we can show them on hold page (MV3 DNR can’t pass query easily)
chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.type !== "main_frame") return;
    const url = details.url;
    const tabId = details.tabId;
    // Only stash if it matches our blocked list (quick check)
    chrome.storage.local.get("blockedDomains", ({ blockedDomains = DEFAULT_SETTINGS.blockedDomains }) => {
      if (blockedDomains.some(d => url.includes(d))) {
        lastTargetByTab.set(tabId, url);
      }
    });
  },
  { urls: ["<all_urls>"] }
);

// Message channel: hold.js asks for target and settings, and to proceed
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_CONTEXT") {
    const tabId = sender.tab?.id;
    chrome.storage.local.get(DEFAULT_SETTINGS, data => {
      sendResponse({
        targetUrl: tabId != null ? lastTargetByTab.get(tabId) : null,
        delaySeconds: data.delaySeconds,
        blockedDomains: data.blockedDomains
      });
    });
    return true; // async response
  }

  if (msg.type === "PROCEED_TO_TARGET") {
    const { targetUrl } = msg;
    const tabId = sender.tab?.id;
  (async () => {
    if (tabId != null && targetUrl) {
      //  install temporary allow rule for this tab and domain
      await addTemporaryAllowRule(tabId, targetUrl, 8000);

      //  navigate to original target
      await chrome.tabs.update(tabId, { url: targetUrl });
      lastTargetByTab.delete(tabId);
    }
    })();
    
    sendResponse({ ok: true });
    return true;
  }

});

// Install/Startup: seed defaults + install rules
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["delaySeconds", "blockedDomains"]);
  if (!existing.delaySeconds) await chrome.storage.local.set({ delaySeconds: DEFAULT_SETTINGS.delaySeconds });

  if (!existing.blockedDomains) await chrome.storage.local.set({ blockedDomains: DEFAULT_SETTINGS.blockedDomains });

  await ensureRules();
});
chrome.runtime.onStartup.addListener(ensureRules);

// React to settings changes (from options page)
chrome.storage.onChanged.addListener(changes => {
  if (changes.blockedDomains) ensureRules();
});
