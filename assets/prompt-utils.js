export function composeDetailedPrompt(item, toolboxTitle = "") {
  const inputs = numbered(item.inputs, "：[請填寫；沒有資料請寫「無」，不要留白]");
  const outputs = numbered(item.outputFormat);
  const checks = numbered(item.reviewChecklist);
  const mode = toolboxTitle || (item.toolbox === "agent" ? "AI Agent 工具箱" : "Prompt 工具箱");
  const agentBlock = item.toolbox === "agent" && item.agentSettings
    ? `\n\n${composeAgentSettings(item.agentSettings)}`
    : "";

  return `${String(item.prompt || "").trim()}

---
【精準執行規格】
任務名稱：${item.title}
工作模式：${mode}
目標：${item.summary}

【輸入資料完整度檢查】
請先逐項檢查下列資料：
${inputs}

執行規則：
1. 只使用我在本次對話提供的內容，以及我明確指定可使用的來源；不得自行補造人物、數字、日期、引述、組織、政策、研究結果或因果關係。
2. 若缺少會實質改變結論的必要資料，先列出最多 5 個澄清問題並停止產出正式結果；若只是次要缺漏，可繼續，但必須標示「待確認」。
3. 把內容區分為「已知事實」「合理推論」「建議行動」；推論必須寫出依據，不得把推論改寫成已證實事實。
4. 涉及數字時，同時保留數值、單位、期間、分母、計算方式與來源；無法核對時標示「未核實」，不得估算補齊。
5. 涉及引述或案例時，只能使用可回查的原文與位置；不得生成虛構引言、受益者故事或代表性敘述。
6. 採繁體中文與台灣用語；句子清楚、具體、可執行，避免空泛形容詞與過度承諾。
7. 不揭露個資或機密。資料安全限制：${item.sensitiveDataWarning}
8. 不輸出思考過程；只提供結論、依據、限制、待確認事項與下一步。

【固定輸出契約】
請依下列順序回覆，不得省略區段：
A. 資料完整度：列出已收到、缺少與不適用的資料。
B. 任務結果：依指定格式完成主要工作。
C. 依據對照：每項重要結論對應到提供的資料或來源位置。
D. 假設與限制：分開列出假設、資料限制與不可下的結論。
E. 待人工確認：列出需要負責人核對或批准的項目。
F. 下一步：提供 3 項以內、可直接執行的後續行動。

主要結果至少包含：
${outputs}

【完成前自我查核】
交付前逐項檢查；若未通過，請修正後再輸出：
${checks}

最後附上「查核結果」表格：檢查項目／通過、待確認或不適用／問題位置／建議修正。${agentBlock}`;
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

Agent 必須遵守：若輸入驗證失敗、來源不明、權限不確定、結果信心不足或觸及禁止動作，立即停止在「等待人工處理」狀態，不得自行繞過限制、擴張權限或重試外部動作。`;
}

function numbered(items = [], suffix = "") {
  return items.map((value, index) => `${index + 1}. ${value}${suffix}`).join("\n");
}

function bullets(items = []) {
  return items.map((value) => `- ${value}`).join("\n");
}
