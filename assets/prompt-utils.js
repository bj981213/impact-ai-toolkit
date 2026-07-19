export function composeDetailedPrompt(item, toolboxTitle = "") {
  const inputs = numbered(item.inputs, "：[填寫；不適用請寫「不適用」]");
  const outputs = bullets(item.outputFormat);
  const checks = numbered(item.reviewChecklist);
  const mode = toolboxTitle || (item.toolbox === "agent" ? "AI Agent 工具箱" : "Prompt 工具箱");
  const agentBlock = item.toolbox === "agent" && item.agentSettings
    ? `\n\n${composeAgentSettings(item.agentSettings)}`
    : "";

  return `${String(item.prompt || "").trim()}

---
【執行規格】
任務名稱：${item.title}
工具箱：${mode}
目標：${item.summary}

【必要輸入】
${inputs}

【開始條件】
先檢查必要輸入。若缺少會改變結論的資料，只輸出「缺少欄位／影響／如何補齊」表格後停止。資料齊全才執行任務。次要缺漏標示「待確認」，不可自行補值。

【執行規則】
1. 只使用本次提供的資料及指定來源。不得虛構人物、組織、數字、日期、引述、研究、政策或因果關係。
2. 明確區分「事實」「推論」「建議」。推論須附依據，不得寫成事實。
3. 數字須保留數值、單位、期間、分母、算法與來源；缺一即標示「未核實」。
4. 引述須保留原文與位置。不得生成虛構引言或受益者故事。
5. 使用繁體中文與台灣用語。刪除空泛形容詞、重複句與沒有依據的承諾。
6. 資料限制：${item.sensitiveDataWarning}

【輸出格式】
依序輸出：
1. 輸入檢查：已收到／缺少／不適用。
2. 任務結果：使用下列格式。
${outputs}
3. 依據對照：結論／資料或來源位置／狀態（已確認、待確認、未核實）。
4. 限制與人工確認：列出不可下的結論及負責人需核對的項目。
5. 下一步：最多 3 項，須寫明負責角色與完成條件。

【交付前檢查】
${checks}

未通過的項目先修正；無法修正則在輸出中標出問題位置與所缺資料。${agentBlock}`;
}

export function composeAgentSettings(settings) {
  return `【AI Agent 運作設定】
運作模式：${settings.operatingMode}

觸發條件：
${bullets(settings.triggers)}

允許讀取的資料來源：
${bullets(settings.inputSources)}

狀態流程：
${settings.states.map((state, index) => `${index + 1}. ${state}`).join("\n")}

允許執行：
${bullets(settings.allowedActions)}

禁止自動執行：
${bullets(settings.forbiddenActions)}

必須人工批准：
${bullets(settings.humanApprovals)}

例外與失敗處理：
${bullets(settings.exceptionHandling)}

最低紀錄要求：
${bullets(settings.logging)}

成效指標：
${bullets(settings.successMetrics)}

停止規則：輸入驗證失敗、來源不明、權限不確定或觸及禁止動作時，轉為「等待人工處理」。不得繞過限制、擴張權限或重試外部動作。`;
}

function numbered(items = [], suffix = "") {
  return items.map((value, index) => `${index + 1}. ${value}${suffix}`).join("\n");
}

function bullets(items = []) {
  return items.map((value) => `- ${value}`).join("\n");
}
