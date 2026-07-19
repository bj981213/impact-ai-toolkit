import { mkdir, readFile, writeFile } from "node:fs/promises";
import { composeDetailedPrompt } from "../assets/prompt-utils.js";

const catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
const stageMap = new Map(catalog.stages.map((stage) => [stage.id, stage]));
const toolboxMap = new Map(catalog.toolboxes.map((toolbox) => [toolbox.id, toolbox]));

await mkdir("tools", { recursive: true });

for (const item of catalog.items) {
  const stage = stageMap.get(item.stage);
  const toolbox = toolboxMap.get(item.toolbox);
  const html = renderPage(item, stage, toolbox);
  await writeFile(`tools/${item.id}.html`, html, "utf8");
}

console.log(`Generated ${catalog.items.length} tool pages.`);

function renderPage(item, stage, toolbox) {
  const title = `${item.title}｜公益影響力 AI 工作箱`;
  const tools = item.supportedTools.map((tool) => `<span>${escapeHtml(tool)}</span>`).join("");
  const audiences = item.audiences.map((audience) => `<span>${escapeHtml(audience)}</span>`).join("");
  const detailedPrompt = composeDetailedPrompt(item, toolbox.title);
  const agentSettings = item.toolbox === "agent" ? renderAgentSettings(item.agentSettings) : "";
  const promptTitle = item.toolbox === "agent" ? "Agent 設定與系統提示詞" : "完整提示詞";
  const promptInstruction = item.toolbox === "agent"
    ? "先替換所有 [填入] 欄位，再貼入 Agent 的自訂指令或系統設定。沒有設定區時，貼到新對話的第一則訊息；先用虛構資料測試。"
    : "先替換所有 [填入] 欄位，再整段貼到組織核准使用的 AI。保留執行規格，不要只貼任務段落。";

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeAttr(item.summary)}">
  <meta name="theme-color" content="#164f4a">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="../assets/styles.css">
  <script src="../assets/detail.js" type="module"></script>
</head>
<body class="detail-body" data-item-id="${escapeAttr(item.id)}" data-item-title="${escapeAttr(item.title)}" data-item-kind="${escapeAttr(item.kind)}" data-item-toolbox="${escapeAttr(item.toolbox)}">
  <a class="skip-link" href="#main">跳到主要內容</a>
  <header class="detail-header">
    <a class="brand" href="../index.html" aria-label="回到公益影響力 AI 工作箱首頁">
      <span class="brand-mark" aria-hidden="true">AI</span>
      <span><strong>公益影響力 AI 工作箱</strong><small>課後可重複使用的工作流程</small></span>
    </a>
  </header>
  <main class="detail-main" id="main">
    <a class="detail-back" href="../index.html#library">← 回到工具箱</a>
    <section class="detail-hero">
      <div class="detail-tags"><span>${escapeHtml(toolbox.title)}</span><span>${escapeHtml(item.kind)}</span><span>${escapeHtml(stage.title)}</span>${tools}</div>
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(item.summary)}</p>
    </section>

    <div class="detail-grid">
      <section class="detail-section">
        <p class="eyebrow">適用情境</p>
        <h2>誰會用到？</h2>
        <div class="detail-tags" style="color:#17332f">${audiences}</div>
        <p>${escapeHtml(item.summary)}</p>
      </section>

      <section class="detail-section">
        <p class="eyebrow">準備資料</p>
        <h2>開始前請備妥</h2>
        ${renderList(item.inputs)}
      </section>

      <section class="detail-section warning full">
        <p class="eyebrow terracotta">不能直接上傳</p>
        <h2>個資與機密提醒</h2>
        <p>${escapeHtml(item.sensitiveDataWarning)}</p>
      </section>

      <section class="detail-section full">
        <p class="eyebrow">三步上手</p>
        <h2>怎麼使用這個流程</h2>
        ${renderList(item.steps, "ol")}
      </section>

${agentSettings}

      <section class="detail-section full" id="prompt-section">
        <p class="eyebrow">執行版・跨工具通用</p>
        <h2>${promptTitle}</h2>
        <p>${promptInstruction}</p>
        <div class="prompt-box">
          <button type="button" class="copy-detail" data-copy-target="#promptText">複製完整設定</button>
          <div class="prompt-text" id="promptText">${escapeHtml(detailedPrompt)}</div>
        </div>
      </section>

      <section class="detail-section">
        <p class="eyebrow">建議格式</p>
        <h2>應該得到什麼</h2>
        ${renderList(item.outputFormat)}
      </section>

      <section class="detail-section">
        <p class="eyebrow">人工負責</p>
        <h2>交付前驗收</h2>
        ${renderChecklist(item.reviewChecklist)}
      </section>

      <section class="detail-section full">
        <p class="eyebrow">虛構示例</p>
        <h2>輸入與輸出對照</h2>
        <div class="example-box">
          <div><h3>示範輸入</h3><p>${escapeHtml(item.example.input)}</p></div>
          <div><h3>合理輸出</h3><p>${escapeHtml(item.example.output)}</p></div>
        </div>
      </section>

      <section class="detail-section full">
        <p class="eyebrow">繼續使用</p>
        <h2>延伸用途</h2>
        ${renderList(item.extensions)}
      </section>
    </div>
  </main>
  <footer class="detail-footer">
    <p><strong>提醒：</strong>AI 可以協助整理與提出問題，但不能代替資料來源、專業判斷或利害關係人的聲音。</p>
    <p>版本 1.4・內容更新 ${escapeHtml(item.updatedAt)}</p>
  </footer>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
</body>
</html>
`;
}

function renderList(items, tag = "ul") {
  return `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
}

function renderChecklist(items) {
  return `<ul>${items.map((item) => `<li>□ ${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderAgentSettings(settings) {
  if (!settings) return "";
  return `<section class="detail-section full agent-settings-section">
        <p class="eyebrow terracotta">AI Agent 專用</p>
        <h2>執行設定與治理規格</h2>
        <p class="settings-intro"><strong>運作模式：</strong>${escapeHtml(settings.operatingMode)}</p>
        <div class="agent-settings-grid">
          <div><h3>觸發條件</h3>${renderList(settings.triggers)}</div>
          <div><h3>允許的資料來源</h3>${renderList(settings.inputSources)}</div>
          <div><h3>狀態流程</h3>${renderList(settings.states, "ol")}</div>
          <div><h3>允許執行</h3>${renderList(settings.allowedActions)}</div>
          <div class="agent-setting-warning"><h3>禁止自動執行</h3>${renderList(settings.forbiddenActions)}</div>
          <div class="agent-setting-warning"><h3>必須人工批准</h3>${renderList(settings.humanApprovals)}</div>
          <div><h3>例外與失敗處理</h3>${renderList(settings.exceptionHandling)}</div>
          <div><h3>最低紀錄要求</h3>${renderList(settings.logging)}</div>
          <div><h3>成效指標</h3>${renderList(settings.successMetrics)}</div>
        </div>
      </section>`;
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
