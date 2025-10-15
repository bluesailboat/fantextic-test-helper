# 凡凡模擬考小幫手 (Fantextic AI Practice Test)

這是一個利用 Google Gemini API 驅動的線上模擬測驗練習工具，旨在幫助使用者準備台灣特定的專業能力認證考試。

This is an online practice test tool powered by the Google Gemini API, designed to help users prepare for specific professional certifications in Taiwan.

## 🎯 專案目的 (Project Goal)

本專案的目標是為以下認證提供一個現代化、智慧化的學習輔助工具：
- 資策會「生成式AI能力認證」
- 經濟部iPAS「AI應用規劃師(初級)」
- 經濟部iPAS「淨零碳規劃管理師(初級)」

透過AI即時生成高品質的模擬試題，並在測驗後提供個人化的學習建議，希望能有效提升考生的學習效率與應試能力。

The goal of this project is to provide a modern and intelligent learning aid for the following certifications:
- III "Generative AI Certification"
- MOE iPAS "AI Application Planner (Junior)"
- MOE iPAS "Net-zero Carbon Planning and Management(Junior)"

By leveraging AI to generate high-quality mock exams in real-time and providing personalized feedback, this tool aims to enhance the user's learning efficiency and test-taking skills.

## ✨ 主要功能 (Key Features)

- **🤖 AI 生成題目 (AI-Generated Questions)**: 使用 Google Gemini API，根據官方公告的評鑑範圍動態生成擬真度高、具鑑別度的單選題。
- **📚 多種考試模式 (Multiple Exam Modes)**: 涵蓋五種不同的認證科目，使用者可依需求選擇。
- **🔧 客製化測驗 (Customizable Tests)**: 使用者可以自由選擇每次練習的題目數量。
- **📊 即時回饋與分析 (Instant Feedback & Analysis)**: 測驗結束後，立即提供成績、錯題詳解，以及由AI生成的個人化學習建議。
- **📈 進度追蹤 (Performance Tracking)**: 所有測驗紀錄都會儲存在本機瀏覽器中，方便使用者隨時查看歷史成績，追蹤學習進度。
- **📄 匯出報表 (Data Export)**: 可將完整的測驗歷史紀錄匯出為 CSV 檔案，進行更深入的離線分析。
- **📱 響應式設計 (Responsive Design)**: 介面針對桌面及行動裝置進行了優化，提供一致的使用體驗。

## 🛠️ 技術棧 (Tech Stack)

- **前端 (Frontend)**: React, TypeScript, Tailwind CSS
- **人工智慧 (AI)**: Google Gemini API (`@google/genai`)
- **圖示 (Icons)**: `lucide-react`

## ⚙️ 運作原理 (How It Works)

1.  **選擇測驗**: 使用者在主畫面選擇一個認證科目及題目數量。
2.  **建構指令 (Prompt Engineering)**: 前端 `geminiService.ts` 服務會根據使用者選擇的考試，動態建構一個高度客製化的 Prompt。這個 Prompt 包含：
    *   **角色扮演**：指示 AI 扮演該領域的官方出題委員。
    *   **知識庫導入 (RAG)**：對於所有主要認證科目，都會將一份預先定義好的**專屬知識庫**內容直接注入 Prompt 中。這會強制 AI 必須**僅**根據此份精確的資料來出題，確保題目的專業度、深度與準確性。
    *   **精準難度**：根據不同認證的實際通過率（例如 iPAS 淨零碳約30%，資策會約70-80%），明確指令題目的難度分佈（基礎、應用、分析題的比例）。
    *   **時事結合**：要求 AI 將題目與最新行業動態或政策法規結合。
3.  **呼叫 API**: 服務將建構好的 Prompt 傳送給 Google Gemini API (`gemini-2.5-flash` 模型)，並要求以嚴格的 JSON 格式回傳題目。
4.  **呈現測驗**: 應用程式解析 API 回傳的 JSON 資料，將題目一道道呈現給使用者作答。
5.  **批改與分析**: 使用者提交答案後，應用程式會計算分數，並將作答表現（答對/答錯題數、主題分析等）再次組合成一個新的 Prompt。
6.  **生成建議**: 第二次呼叫 Gemini API，根據使用者的表現生成個人化的學習建議。
7.  **顯示結果**: 將最終的成績、錯題詳解與學習建議顯示給使用者。
8.  **儲存紀錄**: 該次測驗的完整紀錄（包含題目、答案、分數等）被儲存至瀏覽器的 `localStorage`。

## 🚀 如何使用 (How to Use)

本專案是一個純前端應用程式，可以直接在瀏覽器中運行。

### **設定 API 金鑰**

1.  本專案需要一個 Google Gemini API 金鑰才能運作。
2.  您需要將您的金鑰設定為環境變數 `API_KEY`。前端程式碼將透過 `process.env.API_KEY` 來讀取它。
3.  **重要**: 請勿將您的 API 金鑰直接寫在程式碼中或提交到版本控制系統。

### **本地運行**
在本地環境中，您可以使用一個簡單的 HTTP 伺服器來運行 `index.html`。
1.  打開 `index.html` 檔案。
2.  從主選單選擇您想練習的考試。
3.  選擇題目數量後，點擊「開始測驗」。
4.  回答所有問題，提交後即可查看您的成績和 AI 提供的學習回饋。

### **部署 (Deployment)**

本專案目前是一個簡易的純前端應用，可以直接在支援 ES Module 的現代瀏覽器中運行 `index.html`。若要進行更正式的部署，建議遵循以下步驟：

1.  **環境設定**: 無論使用何種方式部署，最重要的一步是在伺服器或託管環境中設定 `API_KEY` 環境變數。**絕對不要**將金鑰直接寫入前端程式碼。
2.  **靜態網站託管**: 由於沒有後端伺服器，您可以將所有檔案（`index.html`, `*.tsx`, etc.）部署到任何靜態網站託管服務上，例如：
    *   **Vercel / Netlify**: 這些平台提供無縫的 Git 整合，可以自動部署您的應用，並提供簡單的介面來設定環境變數。
    *   **GitHub Pages**: 可以將檔案直接部署到 GitHub Pages。
    *   **傳統網頁伺服器**: 您也可以將檔案放置在 Nginx 或 Apache 等網頁伺服器上。
3.  **進階部署 (建議)**: 為了達到最佳效能與相容性，建議導入建置工具 (如 Vite 或 Next.js)。這可以將 TypeScript/JSX 程式碼編譯、打包並壓縮成最佳化的靜態 HTML, CSS 和 JavaScript 檔案，再進行部署。

## 🔭 擴充性與未來方向 (Scalability & Future Directions)

目前的版本將所有測驗紀錄儲存在使用者的瀏覽器 `localStorage` 中。這提供了簡單、無需後端的離線功能，但也有其限制（資料僅存於單一裝置、無法跨瀏覽器同步、可能因清理快取而遺失）。

### **整合後端與資料庫 (Integrating a Backend and Database)**

為了實現更強大的功能，例如使用者帳戶、跨裝置同步進度以及更進階的後台數據分析，可以進行以下擴充：

1.  **建立後端服務**: 使用 Node.js (Express), Python (Flask/Django) 或其他後端框架建立一個 API 服務。
2.  **設計 API 端點**: 建立用於處理使用者認證、儲存測驗紀錄、讀取歷史紀錄的 RESTful API 或 GraphQL 端點。
3.  **選擇資料庫**: 根據需求選擇一個資料庫來儲存使用者資料與測驗紀錄，例如：
    *   **關聯式資料庫 (SQL)**: 如 PostgreSQL 或 MySQL，適合結構化數據和複雜查詢。
    *   **非關聯式資料庫 (NoSQL)**: 如 MongoDB 或 Firestore，適合彈性結構的 JSON 數據，開發速度快。
4.  **修改前端邏輯**:
    *   在 `App.tsx` 中，修改 `useEffect` 鉤子，將從 `localStorage` 讀取歷史紀錄的邏輯，改為呼叫後端 API 來獲取。
    *   在 `handleSubmitForFeedback` 函式中，將儲存紀錄到 `localStorage` 的部分，改為透過 API 將 `newRecord` 物件傳送到後端儲存。
5.  **實現使用者認證**: 引入登入/註冊機制（如 JWT, OAuth），讓後端能夠區分不同使用者的資料。

透過這樣的架構，不僅能安全地集中管理數據，還能為未來的團隊協作、儀表板分析等進階功能奠定基礎。

## 👨‍💻 作者 (Author)

- **Bluesailboat Chen**

---

這是一個個人專案，旨在探索生成式AI在教育領域的應用潛力。歡迎提供任何回饋與建議！
This is a personal project aimed at exploring the potential of generative AI in educational applications. Feedback and suggestions are welcome!
