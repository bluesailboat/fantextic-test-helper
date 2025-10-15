import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Question, AnswerRecord, FeedbackResponse, TopicAnalysis } from '../types.ts';
import { IPAS_NZ_KNOWLEDGE_BASE } from '../knowledgeBase.ts';
import { III_CERT_KNOWLEDGE_BASE } from '../iiiCertKnowledgeBase.ts';
import { IPAS_AI_PLANNER_KNOWLEDGE_BASE } from '../ipasAiPlannerKnowledgeBase.ts';


const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * A utility function to wrap an async API call with an exponential backoff retry mechanism.
 * @param apiCall The async function to call.
 * @param maxRetries The maximum number of retries.
 * @param initialDelay The initial delay in milliseconds.
 * @returns The result of the API call.
 */
const withRetry = async <T,>(
  apiCall: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await apiCall();
    } catch (error) {
      const errorMessage = (error as Error).message || String(error);
      // Check for rate limit error (HTTP 429) or resource exhausted messages
      if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("resource has been exhausted")) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error(`API call failed after ${maxRetries} attempts.`, error);
          throw new Error(`API 請求過於頻繁，請稍後再試。 (API is busy, please try again later.)`);
        }
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.warn(`Rate limit hit. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // For other errors, fail immediately
        throw error;
      }
    }
  }
  // This line should theoretically be unreachable, but it's here for type safety.
  throw new Error("API call failed after maximum retries.");
};


const parseGeminiJsonResponse = <T,>(jsonString: string): T | null => {
  let cleanedJsonString = jsonString.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = cleanedJsonString.match(fenceRegex);
  if (match && match[2]) {
    cleanedJsonString = match[2].trim();
  }

  try {
    return JSON.parse(cleanedJsonString) as T;
  } catch (error) {
    console.error("Failed to parse JSON response:", error, "Raw string:", jsonString);
    try {
        const fixedString = cleanedJsonString.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixedString) as T;
    } catch (finalError) {
        console.error("Failed to parse JSON response even after attempting fixes:", finalError, "Original string for parse:", jsonString);
        return null;
    }
  }
};

export const generateQuestions = async (
  numQuestions: number,
  topics: string[],
  examName: string,
  modelName: string,
  onProgress?: (count: number) => void
): Promise<Question[] | null> => {
  const BATCH_SIZE = 5; // Smaller batches for more responsive progress
  const numBatches = Math.ceil(numQuestions / BATCH_SIZE);
  const topicListText = topics.map(s => `- ${s}`).join('\n');

  const schemaTemplate = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        questionText: { type: Type.STRING, description: "The text of the question." },
        options: {
          type: Type.ARRAY,
          description: "An array of four possible answers.",
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: "The option key: 'A', 'B', 'C', or 'D'." },
              text: { type: Type.STRING, description: "The text for the option." },
            },
            required: ['key', 'text'],
          },
        },
        correctAnswerKey: { type: Type.STRING, description: "The key of the correct answer: 'A', 'B', 'C', or 'D'." },
        topic: { type: Type.STRING, description: "The specific topic this question relates to, chosen exactly from the provided list." },
        explanation: { type: Type.STRING, description: "A detailed explanation of why the correct answer is correct, clarifying key concepts." },
      },
      required: ['questionText', 'options', 'correctAnswerKey', 'topic', 'explanation'],
    },
  };
  
  let knowledgeBaseContext = "";
  if (examName.includes("資策會")) {
      knowledgeBaseContext = `
**核心知識庫：**
您必須嚴格根據以下提供的「資策會生成式AI能力認證」知識庫內容來設計所有題目及其詳解。禁止使用此知識庫以外的資訊。
---
${III_CERT_KNOWLEDGE_BASE}
---
`;
  } else if (examName.includes("iPAS AI應用規劃師初級")) {
    knowledgeBaseContext = `
**核心知識庫：**
您必須嚴格根據以下提供的「iPAS AI應用規劃師初級」知識庫內容來設計所有題目及其詳解。禁止使用此知識庫以外的資訊。
---
${IPAS_AI_PLANNER_KNOWLEDGE_BASE}
---
`;
  } else if (examName.includes("iPAS 淨零碳規劃管理師")) {
      knowledgeBaseContext = `
**核心知識庫：**
您必須嚴格根據以下提供的「iPAS 淨零碳規劃管理師」知識庫內容來設計所有題目及其詳解。禁止使用此知識庫以外的資訊。
---
${IPAS_NZ_KNOWLEDGE_BASE}
---
`;
  }

  const batchPrompts = Array.from({ length: numBatches }, (_, i) => {
    const isLastBatch = i === numBatches - 1;
    const questionsInThisBatch = isLastBatch && (numQuestions % BATCH_SIZE !== 0) 
        ? numQuestions % BATCH_SIZE 
        : BATCH_SIZE;

    if (questionsInThisBatch <= 0) return null;

    let difficultyInstructions = `
- **難度分佈**：請參考官方樣題的水平，維持測驗的鑑別度。題目難度分佈應大致如下：
    - **基礎題 (約 50%)**：評量核心觀念與基本知識。
    - **進階題 (約 30%)**：評量觀念的整合、比較與應用。
    - **專業題 (約 20%)**：評量對特定技術細節、複雜情境分析或法規的深入理解。`;

    if (examName.includes("資策會")) {
        difficultyInstructions = `
- **難度校準**：此認證的目標是推廣生成式AI的基礎知識，平均及格率約為 70%-80%。題目應著重於核心觀念的理解與基本應用，避免過於艱澀或冷僻的細節。
- **難度分佈**：請依循以下比例出題：
    - **基礎觀念題 (約 70%)**：評量對核心術語、主要功能和普遍應用的直接知識。
    - **情境應用題 (約 30%)**：設計簡單的實際應用情境，評估考生是否能選擇合適的工具或方法。`;
    } else if (examName.includes("iPAS AI應用規劃師初級")) {
      if (examName.includes("人工智慧基礎概論")) {
        difficultyInstructions = `
- **難度校準**：根據官方統計，本科目（人工智慧基礎概論）的平均及格率約為 40%-50%，是兩科中較難的一科。您的出題應反映此難度，確保測驗的鑑別度。
- **難度分佈**：請依循以下比例出題：
    - **基礎題 (約 40%)**：評量對核心觀念的直接理解。
    - **進階應用題 (約 40%)**：結合2-3個觀念，或需要從情境中判斷如何應用知識。
    - **專業鑑別題 (約 20%)**：題幹或選項較為複雜，需要深入理解技術細節、比較不同方法的差異，或分析法規/倫理的細微之處。`;
      } else if (examName.includes("生成式AI應用與規劃")) {
        difficultyInstructions = `
- **難度校準**：根據官方統計，本科目（生成式AI應用與規劃）的平均及格率約為 60%-70%，是兩科中較為基礎的一科。您的出題應反映此難度。
- **難度分佈**：請依循以下比例出題：
    - **基礎題 (約 60%)**：評量對核心觀念、工具和應用場景的直接知識。
    - **進階應用題 (約 30%)**：需要簡單的情境分析，或比較不同工具/方法的適用性。
    - **專業鑑別題 (約 10%)**：涉及較細節的規劃評估或風險管理概念。`;
      }
    } else if (examName.includes("iPAS 淨零碳規劃管理師")) {
      difficultyInstructions = `
- **難度校準**：此認證官方公告的平均及格率約為 30%，屬於專業級認證，題目具高度鑑別度。您的出題應反映此高難度，確保能有效區分出具備深入知識的考生。
- **難度分佈**：請依循以下比例出題：
    - **基礎概念題 (約 30%)**：評量對核心名詞、法規、標準的精確定義與內容的記憶。
    - **情境應用與計算題 (約 50%)**：設計企業在推動淨零轉型時會遇到的複雜實際情境，可能包含簡單的計算。評量考生應用標準與知識以分析和解決問題的能力。
    - **整合分析與比較題 (約 20%)**：題目應跨越多個主題，要求考生進行深入比較、分析與判斷，例如比較不同國際標準的細微差異，或評估不同減碳策略的優劣與適用性。`;
    }

    let prompt = `
身為一位資深的AI領域學者與「${examName}」的官方出題委員，您的任務是設計一份包含 ${questionsInThisBatch} 道高品質的模擬測驗題目。

${knowledgeBaseContext}

**測驗目標：**
全面評估考生在以下指定考試範圍的知識與應用能力：
${topicListText}

**題目設計指引：**
- **題型**：全部為單選題，每題提供四個選項（A, B, C, D），其中有且僅有一個是最佳答案。
- **選項設計**：
    - 正確選項的分配應盡可能均勻，避免連續多題答案相同。
    - 干擾選項（distractors）應具備高誘答性，與正確答案在概念上相關或形式上相似，以鑑別考生是否真正理解核心概念，而不僅是記憶片段知識。
    - 避免提供無關或明顯錯誤的選項。
- **時事結合**：請在適當的情況下，將題目與最新的行業動態、政策發展或時事（例如最新的COP決議、新發布的AI模型或法規）相結合，以評估考生的跟進能力。
- **內容與風格**：
    - **知識定義題**：評量考生對核心術語、原理和框架的掌握。
    - **情境應用題**：設計與現實世界相關的場景（例如：企業導入AI的決策、某項AI技術的應用案例、社會倫理議題），評量考生分析問題並應用知識的能力。
    - 題目應緊扣上方指定的考試範圍，並適度結合最新的AI發展趨勢、重要法規（如歐盟AI法案）或行業動態。
${difficultyInstructions}
- **主題關聯**: 每道題目都必須明確關聯到上方「測驗目標」所列出的其中一個主題，並將該主題的完整字串填入 'topic' 欄位。
- **詳解**: 每道題目都必須提供一個 'explanation' 欄位，簡潔但完整地解釋為什麼正確答案是正確的，並釐清相關的核心概念。
`;

    if (numBatches > 1) {
        prompt += `- **批次提醒**: 這是系列請求中的第 ${i + 1} 批 (共 ${numBatches} 批)。請確保生成的題目與其他批次相比具有多樣性，涵蓋不同的子主題。\n`;
    }

    prompt += `\n請直接生成題目內容，輸出將被嚴格限制為指定的 JSON 結構，不要包含任何額外說明。`;

    const schema = {
      ...schemaTemplate,
      description: `List of ${questionsInThisBatch} questions for the ${examName} exam.`,
    };

    return { prompt, schema };
  }).filter((p): p is { prompt: string; schema: any } => p !== null);

  let generatedCount = 0;

  const questionPromises = batchPrompts.map(p =>
    withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: p.prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: p.schema,
        temperature: 0.75,
      }
    // FIX: Explicitly type the `response` parameter to ensure correct type inference within the `.then()` callback.
    })).then((response: GenerateContentResponse) => {
      const responseText = response.text;
      if (!responseText) {
        console.warn(`Gemini API returned an empty response for a batch.`);
        return [];
      }
      const parsedBatch = parseGeminiJsonResponse<Omit<Question, 'id'>[]>(responseText);
      if (!parsedBatch || !Array.isArray(parsedBatch)) {
        console.warn(`Failed to parse questions from a batch. Raw response:`, responseText);
        return [];
      }
      
      generatedCount += parsedBatch.length;
      if (onProgress) {
        onProgress(Math.min(generatedCount, numQuestions));
      }

      return parsedBatch;
    }).catch(error => {
      console.error(`A batch failed during generation:`, error);
      return []; 
    })
  );

  const questionBatches = await Promise.all(questionPromises);
  const allQuestions = questionBatches.flat();

  if (allQuestions.length === 0) {
    console.error(`Failed to generate any questions after all batches for exam: ${examName}.`);
    throw new Error(`AI 未能生成任何題目。請檢查主控台是否有更詳細的錯誤訊息。`);
  }
  
  const validQuestions = allQuestions.filter(q => 
      q.questionText && 
      Array.isArray(q.options) && 
      q.options.length === 4 && 
      q.options.every(opt => opt.key && opt.text && typeof opt.key === 'string' && typeof opt.text === 'string' && ["A", "B", "C", "D"].includes(opt.key)) &&
      q.correctAnswerKey &&
      ["A", "B", "C", "D"].includes(q.correctAnswerKey) &&
      q.topic && typeof q.topic === 'string' &&
      q.explanation && typeof q.explanation === 'string'
  ).slice(0, numQuestions); 

  if (validQuestions.length < numQuestions) {
      console.warn(`Generated ${validQuestions.length} valid questions, but ${numQuestions} were requested. This might be due to API errors or malformed responses in some batches.`);
  } 
  if (validQuestions.length === 0) {
      console.error(`No valid questions could be processed from any AI response for ${examName}.`);
      return null;
  }
  
  return validQuestions.map((q, index) => ({...q, id: `q${index + 1}`}));
};

const formatTimeForFeedback = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  let timeString = "";
  if (minutes > 0) {
    timeString += `${minutes} 分 `;
  }
  timeString += `${seconds} 秒`;
  return timeString;
};

export const getFeedback = async (
  correctCount: number,
  incorrectCount: number,
  elapsedTimeInSeconds: number,
  examName: string,
  modelName: string,
  topicAnalysis: TopicAnalysis | null
): Promise<Pick<FeedbackResponse, 'learningSuggestions'> | null> => {
  
  const formattedElapsedTime = formatTimeForFeedback(elapsedTimeInSeconds);
  const totalQuestions = correctCount + incorrectCount;
  
  const analysisText = topicAnalysis ? 
    '答題主題分析：\n' + Object.entries(topicAnalysis)
      .map(([topic, stats]) => `- 主題「${topic}」: ${stats.correct} / ${stats.total} 答對`)
      .join('\n')
    : '無主題分析資料。';


  const prompt = `
您是一位AI領域的資深學者，也是「${examName}」的考試委員。請根據考生的作答摘要提供學習建議。

**考生表現概要 (${examName})：**
總題數：${totalQuestions}
答對題數：${correctCount}
答錯題數：${incorrectCount}
作答總時間：${formattedElapsedTime}
${analysisText}

請嚴格遵循 JSON 格式輸出，只需提供 'learningSuggestions' 欄位。

**內容指引 for 'learningSuggestions':**
${incorrectCount > 0 ?
`根據考生在「${examName}」的答錯情況（特別是答錯較多的主題）與作答總時間（${formattedElapsedTime}），請提供2-3項具體的學習建議。請針對考生較弱的面向或知識點，為每個建議創建一個獨立區塊，並嚴格遵循以下 HTML 結構：
- **建議標題**: 使用 \`<h4>\` 標籤包裹，簡潔點出建議核心 (例如：\`<h4>強化特定主題的理解</h4>\`)。
- **詳細內容**: 在 \`<h4>\` 之後，使用一個或多個 \`<p>\` 標籤來詳細闡述。在說明中，必須使用 \`<strong>\` 標籤來強調重要的關鍵概念、主題或行動建議。
如果作答時間相對於題數明顯過長，也可以在建議中適當提醒考生注意時間分配。`
: `恭喜您在「${examName}」測驗中全部答對！您的基礎非常紮實。考量到您的作答總時間為 ${formattedElapsedTime}，請提供1-2個針對「${examName}」相關領域的進階學習方向，例如深入研究特定AI技術或關注新興應用趨勢。請為每個建議創建一個獨立區塊，並嚴格遵循以下 HTML 結構：
- **建議標題**: 使用 \`<h4>\` 標籤包裹，簡潔點出建議核心 (例如：\`<h4>深入研究前沿技術</h4>\`)。
- **詳細內容**: 在 \`<h4>\` 之後，使用一個或多個 \`<p>\` 標籤來詳細闡述。在說明中，必須使用 \`<strong>\` 標籤來強調重要的關鍵概念、新興技術或學習資源。`}

請保持專業、嚴謹且具鼓勵性的語氣。最終輸出的 'learningSuggestions' 內容必須是格式正確、可以直接渲染的 HTML 字串，不要出現MARKDOWN格式或任何JSON以外的文字。
`;

  const schema = {
    type: Type.OBJECT,
    properties: {
        learningSuggestions: {
            type: Type.STRING,
            description: "An HTML string providing learning suggestions based on the user's performance. It should use <h4> for suggestion titles, and <p> and <strong> tags for detailed content and emphasis."
        }
    },
    required: ['learningSuggestions']
  };

  try {
    const apiCall = () => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7,
      }
    });

    const response: GenerateContentResponse = await withRetry(apiCall);

    const responseText = response.text;
    if (!responseText) {
        console.error(`Gemini API returned an empty response for feedback generation for exam: ${examName}.`);
        return null;
    }

    const parsedFeedback = parseGeminiJsonResponse<Pick<FeedbackResponse, 'learningSuggestions'>>(responseText);

    if (!parsedFeedback || !parsedFeedback.learningSuggestions) {
        console.error(`Failed to parse feedback from Gemini response or response is missing required fields for exam: ${examName}. Raw response:`, responseText);
        return null;
    }
    
    return parsedFeedback;

  } catch (error) {
    console.error(`Error getting feedback for exam ${examName}:`, error);
    throw error;
  }
};
