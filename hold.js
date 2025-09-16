const countdownEl = document.getElementById("countdown");
const targetEl = document.getElementById("target");
const btnContinue = document.getElementById("continue");
const btnCancel = document.getElementById("cancel");

let targetUrl = null;

function truncateUrl(u) {
  try {
    const url = new URL(u);
    return url.origin + url.pathname + (url.search ? "…" : "");
  } catch {
    return u;
  }
}

chrome.runtime.sendMessage({ type: "GET_CONTEXT" }, (ctx) => {
  targetUrl = ctx.targetUrl;
  const { delayEnabled, delaySeconds } = ctx;

  if (targetUrl) {
    targetEl.textContent = truncateUrl(targetUrl);
    targetEl.style.display = "";
  } else {
    targetEl.textContent = "";
    targetEl.style.display = "none";
  }

  if (delayEnabled && delaySeconds > 0) {
    let remaining = delaySeconds;
    countdownEl.textContent = `${remaining}s`;
    const timer = setInterval(() => {
      remaining -= 1;
      countdownEl.textContent = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(timer);
        countdownEl.textContent = "";
        btnContinue.disabled = false;
        btnContinue.focus();
      }
    }, 1000);
  } else {
    countdownEl.textContent = "";
    btnContinue.disabled = false;
  }
});

btnContinue.addEventListener("click", () => {
  if (!targetUrl) return;
  chrome.runtime.sendMessage({ type: "PROCEED_TO_TARGET", targetUrl });
});

btnCancel.addEventListener("click", () => {
  // The DNR redirect creates a normal history entry—this goes back to the prior page.
  history.back();
});
