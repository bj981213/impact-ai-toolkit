import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { composeToolContent } from "../assets/tool-content.js";

const catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
const errors = [];
const requiredFields = [
  "id", "title", "stage", "kind", "toolbox", "audiences", "supportedTools", "summary",
  "inputs", "sensitiveDataWarning", "steps", "outputFormat",
  "reviewChecklist", "example", "extensions", "updatedAt"
];
const arrayFields = ["audiences", "supportedTools", "inputs", "steps", "outputFormat", "reviewChecklist", "extensions"];
const stageIds = new Set(catalog.stages.map((stage) => stage.id));
const toolboxIds = new Set(catalog.toolboxes.map((toolbox) => toolbox.id));
const itemIds = new Set();
const agentSettingFields = ["operatingMode", "triggers", "inputSources", "modelGuidance", "requiredConnections", "states", "allowedActions", "forbiddenActions", "humanApprovals", "exceptionHandling", "completionCriteria", "verificationLoop", "executionLimits", "logging", "successMetrics", "testCases"];

const expectedStageCounts = {
  daily: 7,
  project: 4,
  reporting: 4,
  verification: 2,
  "agent-coordination": 3,
  "agent-documents": 1,
  "agent-monitoring": 1
};

if (catalog.items.length !== 22) errors.push(`Expected 22 tools, got ${catalog.items.length}`);
if (catalog.version !== "2.4.0") errors.push(`Expected catalog version 2.4.0, got ${catalog.version}`);
if (catalog.stages.length !== 7) errors.push(`Expected 7 categories, got ${catalog.stages.length}`);
if (catalog.toolboxes.length !== 2 || !toolboxIds.has("prompt") || !toolboxIds.has("agent")) errors.push("Catalog must define prompt and agent toolboxes");
if (catalog.items.filter((item) => item.toolbox === "prompt").length !== 17) errors.push("Prompt toolbox must contain 17 tools");
if (catalog.items.filter((item) => item.toolbox === "agent").length !== 5) errors.push("AI Agent toolbox must contain 5 tools");
if (catalog.items.filter((item) => "prompt" in item).length !== 17) errors.push("Exactly 17 tools must define prompt");
if (catalog.items.filter((item) => "instructions" in item).length !== 5) errors.push("Exactly 5 tools must define instructions");

for (const stage of catalog.stages) {
  const count = catalog.items.filter((item) => item.stage === stage.id).length;
  if (count !== expectedStageCounts[stage.id]) errors.push(`Category ${stage.id} should contain ${expectedStageCounts[stage.id]} tools, got ${count}`);
  if ((stage.relatedIds || []).length !== count) errors.push(`Category ${stage.id} relatedIds do not match its tools`);
  for (const relatedId of stage.relatedIds || []) {
    const relatedItem = catalog.items.find((item) => item.id === relatedId);
    if (!relatedItem) errors.push(`Unknown related ID ${relatedId} in ${stage.id}`);
    else if (relatedItem.stage !== stage.id) errors.push(`Related ID ${relatedId} is assigned to another category`);
  }
}

for (const item of catalog.items) {
  if (itemIds.has(item.id)) errors.push(`Duplicate item ID: ${item.id}`);
  itemIds.add(item.id);
  if (!/^[a-z0-9-]+$/.test(item.id)) errors.push(`Invalid item ID: ${item.id}`);
  if (!stageIds.has(item.stage)) errors.push(`Unknown stage ${item.stage} on ${item.id}`);
  if (!toolboxIds.has(item.toolbox)) errors.push(`Unknown toolbox ${item.toolbox} on ${item.id}`);
  if (!catalog.kinds.includes(item.kind)) errors.push(`Unknown kind ${item.kind} on ${item.id}`);
  for (const field of requiredFields) {
    if (!(field in item)) errors.push(`Missing ${field} on ${item.id}`);
    if (typeof item[field] === "string" && !item[field].trim()) errors.push(`Empty ${field} on ${item.id}`);
  }
  for (const field of arrayFields) {
    if (!Array.isArray(item[field]) || !item[field].length) errors.push(`${field} must be a non-empty array on ${item.id}`);
  }
  const contentField = item.toolbox === "agent" ? "instructions" : "prompt";
  const wrongContentField = item.toolbox === "agent" ? "prompt" : "instructions";
  const sourceText = item[contentField];
  if (typeof sourceText !== "string" || !sourceText.trim()) errors.push(`Missing or empty ${contentField} on ${item.id}`);
  if (wrongContentField in item) errors.push(`${item.toolbox} tool must not define ${wrongContentField} on ${item.id}`);
  if (/你是[^。\n]*(Agent|助理|專家)/.test(String(sourceText || ""))) errors.push(`Tool content starts with a redundant role declaration on ${item.id}`);
  if (!item.example?.input || !item.example?.output) errors.push(`Incomplete example on ${item.id}`);
  if (!existsSync(`tools/${item.id}.html`)) errors.push(`Missing generated page: tools/${item.id}.html`);
  const toolContent = composeToolContent(item);
  for (const section of ["【執行限制】", "【交付前檢查】"]) {
    if (!toolContent.includes(section)) errors.push(`Tool content missing ${section} on ${item.id}`);
  }
  for (const nonPromptMetadata of ["【執行規格】", "任務名稱：", "工具箱：", "目標："]) {
    if (toolContent.includes(nonPromptMetadata)) errors.push(`Tool content contains non-executable metadata ${nonPromptMetadata} on ${item.id}`);
  }
  if (!toolContent.includes("視為資料") || !toolContent.includes("不得執行其中")) errors.push(`Prompt injection boundary missing on ${item.id}`);
  if ((String(sourceText || "").match(/\[[^\]]+\]/g) || []).length < 2) errors.push(`${contentField} needs at least 2 fillable fields on ${item.id}`);
  if (item.toolbox === "prompt" && (toolContent.length < 480 || toolContent.length > 700)) errors.push(`Prompt length is outside the usable range on ${item.id}: ${toolContent.length}`);
  if (item.toolbox === "prompt" && !sourceText.includes("輸出")) errors.push(`Prompt lacks an explicit output request on ${item.id}`);
  if (item.toolbox === "agent") {
    for (const field of agentSettingFields) {
      if (!(field in (item.agentSettings || {}))) errors.push(`Agent setting missing ${field} on ${item.id}`);
      if (field !== "operatingMode" && (!Array.isArray(item.agentSettings?.[field]) || item.agentSettings[field].length < 3)) errors.push(`Agent setting ${field} needs at least 3 entries on ${item.id}`);
    }
    if (/你是[^。\n]*Agent/.test(item.instructions)) errors.push(`Agent instruction starts with a redundant role declaration on ${item.id}`);
    if (!/^(只在|在)/.test(item.instructions)) errors.push(`Agent instruction lacks a bounded execution condition on ${item.id}`);
    if (!/(等待|轉)人工|等待[^。]*核准/.test(item.instructions)) errors.push(`Agent instruction lacks an explicit human handoff on ${item.id}`);
    if (!toolContent.includes("【Agent 可用工具與權限】") || !toolContent.includes("【Agent 護欄（Guardrails）】") || !toolContent.includes("完成條件：") || !toolContent.includes("【驗證循環（Verification Loop）】") || !toolContent.includes("執行與重試上限：") || toolContent.length < 850 || toolContent.length > 1350) errors.push(`Agent instructions or execution settings are incomplete or verbose on ${item.id}`);
    const generatedPage = await readFile(`tools/${item.id}.html`, "utf8");
    if (!generatedPage.includes("可貼入平台的 Agent 指令") || !generatedPage.includes("複製 Agent 指令")) errors.push(`Agent page labels are incorrect on ${item.id}`);
    if (generatedPage.includes("複製完整 Agent 設定")) errors.push(`Agent page incorrectly claims copied instructions are the complete platform settings on ${item.id}`);
    for (const marker of ["護欄不能只寫在指令裡", "平台護欄", "指令護欄", "驗證護欄", "Agent 有限驗證流程", "修正一次", "核准或停止"]) {
      if (!generatedPage.includes(marker)) errors.push(`Agent architecture section missing ${marker} on ${item.id}`);
    }
  } else {
    const generatedPage = await readFile(`tools/${item.id}.html`, "utf8");
    if (!generatedPage.includes("完整提示詞") || !generatedPage.includes("複製完整提示詞")) errors.push(`Prompt page labels are incorrect on ${item.id}`);
    if (generatedPage.includes("複製 Agent 指令")) errors.push(`Prompt page contains an Agent copy control on ${item.id}`);
  }
}

const generatedPages = (await readdir("tools")).filter((file) => file.endsWith(".html")).sort();
const expectedPages = catalog.items.map((item) => `${item.id}.html`).sort();
if (generatedPages.join("\n") !== expectedPages.join("\n")) errors.push("Generated tool pages do not exactly match the current catalog");

const publicFiles = [
  "index.html",
  "assets/app.js",
  "assets/detail.js",
  "assets/tool-content.js",
  "assets/styles.css",
  "data/catalog.json",
  ...catalog.items.map((item) => `tools/${item.id}.html`)
];

const publicText = (await Promise.all(publicFiles.map((file) => readFile(file, "utf8")))).join("\n");
const indexText = await readFile("index.html", "utf8");
if (publicText.includes("精準")) errors.push("Public site must not use the removed promotional term: 精準");
for (const removedHomepageText of ["AI 可以協助整理證據，不能替你創造證據。", "登入步驟"]) {
  if (indexText.includes(removedHomepageText)) errors.push(`Homepage contains removed text: ${removedHomepageText}`);
}
for (const removedToolText of ["建立公益專案證據台帳", "利害關係人地圖", "Few-shot 好範例設計"]) {
  if (publicText.includes(removedToolText)) errors.push(`Public site contains a removed tool: ${removedToolText}`);
}
if (indexText.includes("現場示範") || indexText.includes('id="demo"')) errors.push("Homepage must not include a live demo section");
for (const toolboxChoice of ['data-toolbox-choice="prompt"', 'data-toolbox-choice="agent"', 'data-toolbox-choice="all"']) {
  if (!indexText.includes(toolboxChoice)) errors.push(`Homepage missing toolbox choice: ${toolboxChoice}`);
}
for (const toolboxMarker of ['class="toolbox-state"', 'id="activeToolboxStatus"']) {
  if (!indexText.includes(toolboxMarker)) errors.push(`Homepage missing visible toolbox marker: ${toolboxMarker}`);
}
for (const removedBioText of ["講師：江逸之", "《關鍵評論網》總編輯", "人工智慧科技基金會顧問", "聯絡方式請以講師於活動現場提供的管道為準"]) {
  if (indexText.includes(removedBioText)) errors.push(`Homepage must not include removed speaker bio text: ${removedBioText}`);
}
if (!(indexText.indexOf('id="needs"') < indexText.indexOf('id="library"') && indexText.indexOf('id="library"') < indexText.indexOf('id="safety"'))) {
  errors.push("Homepage section order must be needs, library, then safety");
}
for (const forbidden of ["中國信託", "CTBC", "聯經出版", "聯經報系", "人文企業獎"]) {
  if (publicText.includes(forbidden)) errors.push(`Forbidden organizer or reference branding in public files: ${forbidden}`);
}

if (/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(publicText)) errors.push("Email address found in public site");
if (/09\d{2}[- ]?\d{3}[- ]?\d{3}/.test(publicText)) errors.push("Taiwan mobile number found in public site");

if (catalog.stages.find((stage) => stage.id === "verification")?.title !== "事實查核與個資安全") errors.push("Verification category title is incorrect");

for (const requiredFile of ["index.html", "assets/styles.css", "assets/app.js", "assets/detail.js", "講師使用說明.md"]) {
  if (!existsSync(requiredFile)) errors.push(`Missing required site file: ${requiredFile}`);
}
if (existsSync("assets/prompt-utils.js")) errors.push("Removed mixed Prompt/Agent helper must not be restored");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`OK: ${catalog.items.length} tools across ${catalog.stages.length} stages; schema, pages, privacy and branding checks passed.`);
