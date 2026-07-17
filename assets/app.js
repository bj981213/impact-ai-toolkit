const STORAGE = {
  favorites: "impact-ai-toolkit.favorites",
  recent: "impact-ai-toolkit.recent"
};

const state = {
  catalog: null,
  items: [],
  stages: [],
  query: "",
  stage: "all",
  kind: "all",
  favoritesOnly: false,
  sort: "stage",
  favorites: new Set(readStorage(STORAGE.favorites, [])),
  recent: readStorage(STORAGE.recent, [])
};

const $ = (selector) => document.querySelector(selector);

init();

async function init() {
  try {
    const response = await fetch("data/catalog.json");
    if (!response.ok) throw new Error(`資料讀取失敗（${response.status}）`);
    state.catalog = await response.json();
    state.items = state.catalog.items || [];
    state.stages = state.catalog.stages || [];
    renderNeedMap();
    populateFilters();
    bindEvents();
    renderLibrary();
    renderRecent();
  } catch (error) {
    $("#resultCount").textContent = "工具資料載入失敗";
    $("#libraryGrid").innerHTML = `<div class="empty-state"><h3>暫時無法開啟工具箱</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function bindEvents() {
  $("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    renderLibrary();
  });

  $("#stageFilter").addEventListener("change", (event) => {
    state.stage = event.target.value;
    renderLibrary();
  });

  $("#kindFilter").addEventListener("change", (event) => {
    state.kind = event.target.value;
    renderLibrary();
  });

  $("#favOnlyBtn").addEventListener("click", () => {
    state.favoritesOnly = !state.favoritesOnly;
    $("#favOnlyBtn").setAttribute("aria-pressed", String(state.favoritesOnly));
    renderLibrary();
  });

  $("#sortBtn").addEventListener("click", () => {
    state.sort = state.sort === "stage" ? "title" : "stage";
    $("#sortBtn").textContent = state.sort === "stage" ? "名稱排序" : "階段排序";
    renderLibrary();
  });

  $("#clearFiltersBtn").addEventListener("click", clearFilters);
  $("#clearRecentBtn").addEventListener("click", () => {
    state.recent = [];
    localStorage.removeItem(STORAGE.recent);
    renderRecent();
    toast("已清除這台裝置的瀏覽紀錄");
  });

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      $("#searchInput").focus();
    }
  });
}

function populateFilters() {
  $("#stageFilter").insertAdjacentHTML("beforeend", state.stages.map((stage) => `<option value="${escapeAttr(stage.id)}">${escapeHtml(stage.title)}</option>`).join(""));
  $("#kindFilter").insertAdjacentHTML("beforeend", (state.catalog.kinds || []).map((kind) => `<option value="${escapeAttr(kind)}">${escapeHtml(kind)}</option>`).join(""));
}

function renderNeedMap() {
  $("#needMap").innerHTML = state.stages.map((stage, index) => `
    <article class="need-card">
      <span class="need-index">0${index + 1}</span>
      <h3>${escapeHtml(stage.title)}</h3>
      <p>${escapeHtml(stage.summary)}</p>
      <div class="need-links">
        ${(stage.relatedIds || []).map((id) => {
          const item = findItem(id);
          return item ? `<a href="tools/${escapeAttr(item.id)}.html" data-open="${escapeAttr(item.id)}">${escapeHtml(item.title)}</a>` : "";
        }).join("")}
      </div>
    </article>
  `).join("");
}

function renderLibrary() {
  const items = filteredItems();
  $("#resultCount").textContent = `顯示 ${items.length}／${state.items.length} 個工具`;
  $("#emptyState").hidden = items.length > 0;
  $("#libraryGrid").innerHTML = items.map(renderCard).join("");
}

function filteredItems() {
  const query = normalize(state.query);
  const stageOrder = new Map(state.stages.map((stage, index) => [stage.id, index]));

  return state.items
    .filter((item) => {
      if (state.stage !== "all" && item.stage !== state.stage) return false;
      if (state.kind !== "all" && item.kind !== state.kind) return false;
      if (state.favoritesOnly && !state.favorites.has(item.id)) return false;
      if (!query) return true;
      const stage = findStage(item.stage);
      return normalize([
        item.title,
        item.summary,
        item.kind,
        stage?.title,
        ...(item.audiences || []),
        ...(item.supportedTools || []),
        ...(item.inputs || [])
      ].join(" ")).includes(query);
    })
    .sort((a, b) => {
      if (state.sort === "title") return a.title.localeCompare(b.title, "zh-Hant");
      const stageDiff = (stageOrder.get(a.stage) ?? 99) - (stageOrder.get(b.stage) ?? 99);
      return stageDiff || a.title.localeCompare(b.title, "zh-Hant");
    });
}

function renderCard(item) {
  const stage = findStage(item.stage);
  const favorite = state.favorites.has(item.id);
  return `
    <article class="tool-card">
      <div class="card-meta">
        <div><span class="kind">${escapeHtml(item.kind)}</span> <span class="stage-chip">${escapeHtml(stage?.title || item.stage)}</span></div>
        <button type="button" class="fav-btn ${favorite ? "active" : ""}" data-favorite="${escapeAttr(item.id)}" aria-label="${favorite ? "移除收藏" : "加入收藏"}：${escapeAttr(item.title)}" aria-pressed="${String(favorite)}">${favorite ? "已藏" : "收藏"}</button>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="summary">${escapeHtml(item.summary)}</p>
      <div class="card-tools" aria-label="支援工具">${(item.supportedTools || []).map((tool) => `<span class="tool-chip">${escapeHtml(tool)}</span>`).join("")}</div>
      <div class="card-actions">
        <button type="button" data-copy="${escapeAttr(item.id)}">複製提示詞</button>
        <a href="tools/${escapeAttr(item.id)}.html" data-open="${escapeAttr(item.id)}">開啟工具</a>
      </div>
    </article>
  `;
}

function handleDocumentClick(event) {
  const copyButton = event.target.closest("[data-copy]");
  if (copyButton) {
    const item = findItem(copyButton.dataset.copy);
    if (item) copyText(item.prompt, `已複製「${item.title}」提示詞`);
    return;
  }

  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.favorite);
    return;
  }

  const openLink = event.target.closest("[data-open]");
  if (openLink) {
    const item = findItem(openLink.dataset.open);
    if (item) addRecent(item);
  }
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  writeStorage(STORAGE.favorites, [...state.favorites]);
  renderLibrary();
  toast(state.favorites.has(id) ? "已收藏在這台裝置" : "已移除收藏");
}

function addRecent(item) {
  state.recent = [
    { id: item.id, title: item.title, kind: item.kind, visitedAt: Date.now() },
    ...state.recent.filter((entry) => entry.id !== item.id)
  ].slice(0, 8);
  writeStorage(STORAGE.recent, state.recent);
  renderRecent();
}

function renderRecent() {
  const entries = state.recent.map((entry) => ({ ...entry, item: findItem(entry.id) })).filter((entry) => entry.item);
  $("#recentList").innerHTML = entries.length
    ? entries.map((entry) => `<li><a href="tools/${escapeAttr(entry.id)}.html" data-open="${escapeAttr(entry.id)}">${escapeHtml(entry.title)}</a><br><span>${escapeHtml(entry.kind)}・${formatDate(entry.visitedAt)}</span></li>`).join("")
    : "<li><span>尚無瀏覽紀錄。開啟工具後會顯示在這裡。</span></li>";
}

function clearFilters() {
  state.query = "";
  state.stage = "all";
  state.kind = "all";
  state.favoritesOnly = false;
  $("#searchInput").value = "";
  $("#stageFilter").value = "all";
  $("#kindFilter").value = "all";
  $("#favOnlyBtn").setAttribute("aria-pressed", "false");
  renderLibrary();
  toast("已清除篩選條件");
}

async function copyText(text, message) {
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
  toast(message);
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 1800);
}

function findItem(id) { return state.items.find((item) => item.id === id); }
function findStage(id) { return state.stages.find((stage) => stage.id === id); }
function normalize(value = "") { return String(value).normalize("NFKC").toLowerCase(); }
function formatDate(value) { return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* 私密模式或儲存空間不足時仍可繼續使用網站 */ }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") { return escapeHtml(value); }
