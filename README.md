# 公益影響力 AI 工作箱

給企業 CSR／ESG、基金會與 NPO 人員使用的繁體中文靜態工具網站。網站不需要登入、不蒐集個資，也不會把使用者內容傳送到第三方。

## 內容

- 5 類公益工作需求地圖
- 25 個高頻 AI 工作流程
- 搜尋、篩選、收藏、最近瀏覽與一鍵複製
- 完全虛構的「山城閱讀陪伴計畫」示範資料
- 每個工具都有個資提醒與人工查核清單

## 本地使用

```bash
npm run build
npm run serve
```

開啟 `http://localhost:8088/`。

## 發布邊界

正式網站：<https://bj981213.github.io/impact-ai-toolkit/>

原始碼：<https://github.com/bj981213/impact-ai-toolkit>

本資料夾使用獨立 repository，推送到 `main` 後會由 GitHub Actions 自動更新 GitHub Pages。不得推送到外層中國信託網站既有的 GitHub origin。

## 內容原則

- AI 只協助整理、提問與草擬，不代替專業判斷。
- 不得要求 AI 虛構受益者故事、財務代理值、因果關係或 SROI 金額。
- 真實資料使用前應完成去識別化，並遵循組織內部資安規範。
