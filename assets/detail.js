const body = document.body;
const item = {
  id: body.dataset.itemId,
  title: body.dataset.itemTitle,
  kind: body.dataset.itemKind,
  toolbox: body.dataset.itemToolbox
};
const recentKey = "impact-ai-toolkit.recent";

rememberItem();

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-target]");
  if (!button) return;
  const target = document.querySelector(button.dataset.copyTarget);
  if (!target) return;
  await copyText(target.textContent.trim());
  showToast(item.toolbox === "agent"
    ? "已複製 Agent 指令，可貼到平台的 Agent 指令欄"
    : "已複製提示詞，可貼到組織核准使用的 AI");
});

function rememberItem() {
  if (!item.id) return;
  try {
    const current = JSON.parse(localStorage.getItem(recentKey) || "[]");
    const next = [
      { id: item.id, title: item.title, kind: item.kind, visitedAt: Date.now() },
      ...current.filter((entry) => entry.id !== item.id)
    ].slice(0, 8);
    localStorage.setItem(recentKey, JSON.stringify(next));
  } catch { /* 不影響工具頁使用 */ }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function showToast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => node.classList.remove("show"), 1800);
}
