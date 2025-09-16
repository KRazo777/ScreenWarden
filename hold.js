const countdownEl = document.getElementById("countdown");
const targetEl = document.getElementById("target");
const btnContinue = document.getElementById("continue");
const btnCancel = document.getElementById("cancel");

let targetUrl = null;
let delay = 10;

function truncateUrl(u) {
  try {
    const url = new URL(u);
    return url.origin + url.pathname + (url.search ? "…" : "");
  } catch {
    return u;
  }
}

chrome.runtime.sendMessage({ type: "GET_CONTEXT" }, ({ targetUrl: t, delaySeconds }) => {
  targetUrl = t || null;
  delay = (typeof delaySeconds === "number" ? delaySeconds : 10);

  targetEl.textContent = targetUrl ? truncateUrl(targetUrl) : "(no target)";

  let remaining = delay;
  countdownEl.textContent = `${remaining}s`;
  const timer = setInterval(() => {
    remaining -= 1;
    countdownEl.textContent = `${remaining}s`;
    if (remaining <= 0) {
      clearInterval(timer);
      btnContinue.disabled = false;
      btnContinue.focus();
    }
  }, 1000);
});

btnContinue.addEventListener("click", () => {
  if (!targetUrl) return;
  chrome.runtime.sendMessage({ type: "PROCEED_TO_TARGET", targetUrl });
});

btnCancel.addEventListener("click", () => {
  // The DNR redirect creates a normal history entry—this goes back to the prior page.
  history.back();
});
