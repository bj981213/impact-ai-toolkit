import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
const demo = JSON.parse(await readFile("data/demo-project.json", "utf8"));
const errors = [];
const requiredFields = [
  "id", "title", "stage", "kind", "audiences", "supportedTools", "summary",
  "inputs", "sensitiveDataWarning", "steps", "prompt", "outputFormat",
  "reviewChecklist", "example", "extensions", "updatedAt"
];
const arrayFields = ["audiences", "supportedTools", "inputs", "steps", "outputFormat", "reviewChecklist", "extensions"];
const stageIds = new Set(catalog.stages.map((stage) => stage.id));
const itemIds = new Set();

if (catalog.items.length !== 25) errors.push(`Expected 25 tools, got ${catalog.items.length}`);
if (catalog.stages.length !== 5) errors.push(`Expected 5 stages, got ${catalog.stages.length}`);

for (const stage of catalog.stages) {
  const count = catalog.items.filter((item) => item.stage === stage.id).length;
  if (count !== 5) errors.push(`Stage ${stage.id} should contain 5 tools, got ${count}`);
  for (const relatedId of stage.relatedIds || []) {
    if (!catalog.items.some((item) => item.id === relatedId)) errors.push(`Unknown related ID ${relatedId} in ${stage.id}`);
  }
}

for (const item of catalog.items) {
  if (itemIds.has(item.id)) errors.push(`Duplicate item ID: ${item.id}`);
  itemIds.add(item.id);
  if (!/^[a-z0-9-]+$/.test(item.id)) errors.push(`Invalid item ID: ${item.id}`);
  if (!stageIds.has(item.stage)) errors.push(`Unknown stage ${item.stage} on ${item.id}`);
  if (!catalog.kinds.includes(item.kind)) errors.push(`Unknown kind ${item.kind} on ${item.id}`);
  for (const field of requiredFields) {
    if (!(field in item)) errors.push(`Missing ${field} on ${item.id}`);
    if (typeof item[field] === "string" && !item[field].trim()) errors.push(`Empty ${field} on ${item.id}`);
  }
  for (const field of arrayFields) {
    if (!Array.isArray(item[field]) || !item[field].length) errors.push(`${field} must be a non-empty array on ${item.id}`);
  }
  if (!item.example?.input || !item.example?.output) errors.push(`Incomplete example on ${item.id}`);
  if (!existsSync(`tools/${item.id}.html`)) errors.push(`Missing generated page: tools/${item.id}.html`);
}

if (!demo.fictional || !demo.notice.includes("完全虛構")) errors.push("Demo data must be explicitly marked as completely fictional");

const publicFiles = [
  "index.html",
  "assets/app.js",
  "assets/detail.js",
  "assets/styles.css",
  "data/catalog.json",
  "data/demo-project.json",
  ...catalog.items.map((item) => `tools/${item.id}.html`)
];

const publicText = (await Promise.all(publicFiles.map((file) => readFile(file, "utf8")))).join("\n");
const indexText = await readFile("index.html", "utf8");
if (indexText.includes("現場示範") || indexText.includes('id="demo"')) errors.push("Homepage must not include a live demo section");
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

const sroi = catalog.items.find((item) => item.id === "sroi-evidence-gap");
if (!sroi || !sroi.prompt.includes("禁止") || !sroi.prompt.includes("財務代理值")) {
  errors.push("SROI tool must explicitly prohibit invented financial proxies");
}

for (const requiredFile of ["index.html", "assets/styles.css", "assets/app.js", "assets/detail.js", "講師使用說明.md"]) {
  if (!existsSync(requiredFile)) errors.push(`Missing required site file: ${requiredFile}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`OK: ${catalog.items.length} tools across ${catalog.stages.length} stages; schema, pages, privacy and branding checks passed.`);
