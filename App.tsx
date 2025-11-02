import React, { useState, useCallback, useEffect, ComponentType } from 'react';
import { BrainCircuit, Lightbulb, Sprout, ClipboardList, BookOpen, LucideProps, History } from 'lucide-react';
import { Question, TestState, AnswerRecord, FeedbackResponse, TestRecord, TopicAnalysis } from './types.ts';
import { GEMINI_MODEL_NAME, EXAM_FORMATS, DEFAULT_EXAM_ID, DEFAULT_NUM_QUESTIONS } from './constants.ts';
import { QuestionCard } from './components/QuestionCard.tsx';
import { LoadingOverlay } from './components/LoadingOverlay.tsx';
import { ErrorModal } from './components/ErrorModal.tsx';
import { generateQuestions, getFeedback } from './services/geminiService.ts';

const HISTORY_STORAGE_KEY = 'fantexticTestHistory';

const questionGenerationMessages = [
  "AI 正在為您出題...",
  "題目數量較多時，會需要更長的時間...",
  "請稍待片刻，試題即將呈現...",
];

const gradingMessages = [
    "處理中，請稍候...",
    "AI正在計算成績...",
    "生成學習建議中...",
];

const iconMap: { [key: string]: ComponentType<LucideProps> } = {
  iii_cert: BrainCircuit,
  ipas_s1: BookOpen,
  ipas_s2: Lightbulb,
  ipas_nz_s1: Sprout,
  ipas_nz_s2: ClipboardList,
};


const App: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord>({});
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>(TestState.WELCOME);
  const [score, setScore] = useState<{ correct: number; incorrect: number } | null>(null);
  
  const [selectedExamFormatId, setSelectedExamFormatId] = useState<string>(DEFAULT_EXAM_ID);
  const [selectedNumQuestions, setSelectedNumQuestions] = useState<number>(
    EXAM_FORMATS.find(f => f.id === DEFAULT_EXAM_ID)?.defaultNumQuestions || DEFAULT_NUM_QUESTIONS
  );

  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  const [elapsedTimeInSeconds, setElapsedTimeInSeconds] = useState<number>(0);
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  const [latestTopicAnalysis, setLatestTopicAnalysis] = useState<TopicAnalysis | null>(null);
  const [generatingModel, setGeneratingModel] = useState<string | null>(null);
  const [generatedQuestionsCount, setGeneratedQuestionsCount] = useState<number>(0);

  const selectedExamFormat = EXAM_FORMATS.find(f => f.id === selectedExamFormatId) || EXAM_FORMATS[0];

  useEffect(() => {
    const currentFormat = EXAM_FORMATS.find(f => f.id === selectedExamFormatId) || EXAM_FORMATS[0];
    if (!currentFormat.questionCountOptions.includes(selectedNumQuestions)) {
      setSelectedNumQuestions(currentFormat.defaultNumQuestions);
    }
  }, [selectedExamFormatId, selectedNumQuestions]);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        setTestHistory(JSON.parse(savedHistory) as TestRecord[]);
      }
    } catch (e) {
      console.error("Could not load test history from localStorage", e);
    }
  }, []);

  useEffect(() => {
    let timerInterval: number | undefined;

    if (testState === TestState.ANSWERING_QUESTIONS && testStartTime !== null) {
      timerInterval = window.setInterval(() => {
        setElapsedTimeInSeconds(Math.floor((Date.now() - testStartTime) / 1000));
      }, 1000);
    }

    return () => {
      if (timerInterval) {
        window.clearInterval(timerInterval);
      }
    };
  }, [testState, testStartTime]);

  const handleStartTest = async () => {
    setError(null);
    setIsLoading(true);
    setTestState(TestState.GENERATING_QUESTIONS);
    setElapsedTimeInSeconds(0); 
    setTestStartTime(null);
    setGeneratingModel(GEMINI_MODEL_NAME); 
    setGeneratedQuestionsCount(0);
    try {
      const currentFormat = EXAM_FORMATS.find(f => f.id === selectedExamFormatId) || EXAM_FORMATS[0];
      const fetchedQuestions = await generateQuestions(
        selectedNumQuestions,
        currentFormat.topics,
        currentFormat.displayName.replace(/\n/g, ' '),
        GEMINI_MODEL_NAME,
        (count) => setGeneratedQuestionsCount(count)
      );
      if (fetchedQuestions && fetchedQuestions.length > 0) {
        setQuestions(fetchedQuestions.slice(0, selectedNumQuestions)); 
        setAnswers({});
        setCurrentQuestionIndex(0);
        setFeedback(null);
        setScore(null);
        setLatestTopicAnalysis(null);
        setTestStartTime(Date.now()); 
        setTestState(TestState.ANSWERING_QUESTIONS);
      } else {
        setError("無法生成題目。AI未返回有效的題目，請檢查您的網路連線、API Key設定或稍後再試。生成的題目可能不符合預期格式。");
        setTestState(TestState.WELCOME);
      }
    } catch (err) {
      console.error(err);
      const error = err as Error;
      let userMessage: string;
      const errorMessage = error.message || String(err);
    
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        userMessage = "Google AI API Key 設定無效。請確認您的部署環境中是否已正確設定 API Key 環境變數。";
      } else if (errorMessage.includes("429") || errorMessage.includes("resource has been exhausted")) {
        userMessage = "API 請求頻率過高，請稍後再試。";
      } else {
        userMessage = `生成題目時發生錯誤: ${errorMessage}`;
      }
      
      setError(userMessage);
      setTestState(TestState.WELCOME);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = useCallback((questionId: string, selectedOptionKey: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: selectedOptionKey }));
  }, []);

  const handleNextQuestion = () => {
    if (!answers[questions[currentQuestionIndex].id]) {
        setError("請選擇一個答案後再進行下一題。");
        return;
    }
    setError(null);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleSubmitForFeedback();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setError(null); 
    }
  };
  
  const generateLocalErrorAnalysis = (): string => {
    const incorrectQuestions = questions.filter(q => answers[q.id] !== q.correctAnswerKey);
    if (incorrectQuestions.length === 0) {
        return "<p>本次測驗無錯誤題目，恭喜！</p>";
    }
    return incorrectQuestions.map((q) => {
        const userAnswerKey = answers[q.id];
        const userAnswerOption = q.options.find(opt => opt.key === userAnswerKey);
        const correctAnswerOption = q.options.find(opt => opt.key === q.correctAnswerKey);
        const originalQuestionIndex = questions.findIndex(origQ => origQ.id === q.id);

        return `
            <div>
              <h4>題目 ${originalQuestionIndex + 1}: ${q.questionText}</h4>
              <div class="my-3 p-3 bg-red-950/50 border border-red-700/60 rounded-lg">
                <p class="text-sm font-semibold text-red-300 mb-1">你的答案 (錯誤)</p>
                <p class="text-base text-slate-200">${userAnswerOption ? `${userAnswerOption.key}. ${userAnswerOption.text}` : '(未作答)'}</p>
              </div>
              <div class="mb-3 p-3 bg-green-950/50 border border-green-700/60 rounded-lg">
                <p class="text-sm font-semibold text-green-300 mb-1">正確答案</p>
                <p class="text-base text-slate-200">${correctAnswerOption ? `${correctAnswerOption.key}. ${correctAnswerOption.text}` : 'N/A'}</p>
              </div>
              <div class="mt-3">
                <p class="font-semibold text-rose-300">詳解說明：</p>
                <div class="mt-1 text-slate-300">${q.explanation || '此題未提供詳解。'}</div>
              </div>
            </div>
        `;
    }).join('<hr class="my-6 border-slate-600/80" />');
  };

  const handleSubmitForFeedback = async () => {
    if (!answers[questions[currentQuestionIndex].id] && questions.length > 0) {
        setError("請回答最後一題後再提交。");
        return;
    }
    setError(null);
    setIsLoading(true);
    setTestState(TestState.GRADING);
    const finalElapsedTime = elapsedTimeInSeconds; 
    setTestStartTime(null); 
    try {
      let correctCount = 0;
      questions.forEach(q => {
        if (answers[q.id] === q.correctAnswerKey) {
          correctCount++;
        }
      });
      const incorrectCount = questions.length - correctCount;
      const newScore = { correct: correctCount, incorrect: incorrectCount };
      setScore(newScore);
      
      const currentFormat = EXAM_FORMATS.find(f => f.id === selectedExamFormatId) || EXAM_FORMATS[0];

      const analysis: TopicAnalysis = {};
      questions.forEach(q => {
          if (!q.topic) return; 
          if (!analysis[q.topic]) {
            analysis[q.topic] = { correct: 0, incorrect: 0, total: 0 };
          }
          const isCorrect = answers[q.id] === q.correctAnswerKey;
          if (isCorrect) {
            analysis[q.topic].correct++;
          } else {
            analysis[q.topic].incorrect++;
          }
          analysis[q.topic].total++;
      });
      setLatestTopicAnalysis(analysis);

      const newRecord: TestRecord = {
        id: Date.now().toString(),
        examId: selectedExamFormatId,
        examName: currentFormat.displayName.replace(/\n/g, ' '),
        timestamp: Date.now(),
        score: newScore,
        elapsedTimeInSeconds: finalElapsedTime,
        questions: questions,
        answers: answers,
        topicAnalysis: analysis,
      };

      const updatedHistory = [...testHistory, newRecord];
      setTestHistory(updatedHistory);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      
      // Generate error analysis locally
      const errorAnalysisHtml = generateLocalErrorAnalysis();

      const feedbackObject = await getFeedback(
        correctCount, 
        incorrectCount, 
        finalElapsedTime,
        currentFormat.displayName.replace(/\n/g, ' '),
        GEMINI_MODEL_NAME,
        analysis
      );
      
      if (feedbackObject) {
        setFeedback({
          errorAnalysis: errorAnalysisHtml,
          learningSuggestions: feedbackObject.learningSuggestions,
        });
        setTestState(TestState.VIEWING_FEEDBACK);
      } else {
        setError(`取得學習建議時發生錯誤: AI 未能生成有效的回饋內容。`);
        // Still show the user the locally generated error analysis
        setFeedback({ errorAnalysis: errorAnalysisHtml, learningSuggestions: "<p>抱歉，目前無法生成個人化的學習建議。</p>" });
        setTestState(TestState.VIEWING_FEEDBACK);
      }
    } catch (err) {
      console.error(err);
      const error = err as Error;
      let userMessage: string;
      const errorMessage = error.message || String(err);
    
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        userMessage = "Google AI API Key 設定無效。請確認您的部署環境中是否已正確設定 API Key 環境變數。";
      } else if (errorMessage.includes("429") || errorMessage.includes("resource has been exhausted")) {
        userMessage = "API 請求頻率過高，請稍後再試。";
      } else {
        userMessage = `取得回饋時發生錯誤: ${errorMessage}`;
      }

      setError(userMessage);
      setTestState(TestState.ANSWERING_QUESTIONS); 
    } finally {
      setIsLoading(false);
    }
  };

  const goToWelcomeScreen = () => {
    setError(null);
    setTestState(TestState.WELCOME);
  };

  const handleRestartTest = () => {
    setQuestions([]);
    setAnswers({});
    setFeedback(null);
    setCurrentQuestionIndex(0);
    setError(null);
    setScore(null);
    setTestState(TestState.WELCOME);
    setElapsedTimeInSeconds(0);
    setTestStartTime(null);
    setLatestTopicAnalysis(null);
    setGeneratingModel(null);
  };
  
  const handleExportCsv = () => {
    if (testHistory.length === 0) {
      setError("沒有歷史紀錄可匯出。");
      return;
    }

    const headers = [
      "測驗ID", "測驗日期", "測驗時間", "考試名稱", "總耗時(秒)", "總分(答對/總題數)",
      "題目編號", "題目內容", "題目主題", "選項A", "選項B", "選項C", "選項D",
      "正確答案(Key)", "使用者答案(Key)", "是否答對", "詳解"
    ];

    let csvContent = headers.join(",") + "\n";

    testHistory.forEach(record => {
      record.questions.forEach((q, index) => {
        const userAnswerKey = record.answers[q.id] || "N/A";
        const isCorrect = userAnswerKey === q.correctAnswerKey;
        
        // FIX: Explicitly type the accumulator in the `reduce` function call to avoid compilation errors.
        const optionsMap = q.options.reduce((acc: Record<string, string>, opt) => {
          acc[opt.key] = opt.text;
          return acc;
        }, {});

        const sanitize = (text: string | number | undefined) => `"${String(text || '').replace(/"/g, '""')}"`;

        const row = [
          record.id,
          new Date(record.timestamp).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }),
          new Date(record.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          sanitize(record.examName),
          record.elapsedTimeInSeconds,
          `'${record.score.correct}/${record.questions.length}`,
          index + 1,
          sanitize(q.questionText),
          sanitize(q.topic),
          sanitize(optionsMap['A']),
          sanitize(optionsMap['B']),
          sanitize(optionsMap['C']),
          sanitize(optionsMap['D']),
          q.correctAnswerKey,
          userAnswerKey,
          isCorrect ? "是" : "否",
          sanitize(q.explanation)
        ];
        csvContent += row.join(",") + "\n";
      });
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const date = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `fantextic_test_history_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderWelcomeScreen = () => {
    const currentFormatDetails = EXAM_FORMATS.find(f => f.id === selectedExamFormatId) || EXAM_FORMATS[0];
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mb-8">
          {EXAM_FORMATS.map(format => {
            const Icon = iconMap[format.id] || BookOpen;
            const isSelected = selectedExamFormatId === format.id;
            return (
              <div key={format.id} className="relative group">
                <button
                  onClick={() => { setSelectedExamFormatId(format.id); }}
                  className={`relative h-14 w-14 sm:h-24 sm:w-24 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 focus:outline-none 
                    ${isSelected 
                      ? `${format.color} ring-4 ring-offset-2 ring-offset-slate-900 ring-white/80 shadow-lg` 
                      : 'bg-slate-700 hover:bg-slate-600'
                    }`
                  }
                  aria-label={format.displayName.replace(/\n/g, ' ')}
                >
                  <Icon className={`h-7 w-7 sm:h-10 sm:w-10 transition-colors ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                </button>
                <div className="absolute bottom-full mb-2 w-max max-w-xs left-1/2 -translate-x-1/2 px-3 py-2 text-sm font-medium text-white bg-slate-900 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-pre-line text-center z-10">
                  {format.displayName}
                </div>
              </div>
            );
          })}
        </div>

        <div className={`bg-slate-800 p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-3xl mx-auto text-center border-2 ${currentFormatDetails.titleColor.replace('text-', 'border-')}`}>
          <h2 className={`text-2xl sm:text-3xl font-bold mb-3 ${currentFormatDetails.titleColor} whitespace-pre-line`}>
            {currentFormatDetails.displayName} 
          </h2>
          <p className="text-slate-300 mt-4 mb-6 text-base leading-relaxed">
            {currentFormatDetails.description}
          </p>
          <div className="mb-6 max-w-xs mx-auto">
            <label htmlFor="numQuestions" className="block text-slate-300 text-sm font-medium mb-1">選擇題目數量：</label>
            <select
              id="numQuestions"
              value={selectedNumQuestions}
              onChange={(e) => setSelectedNumQuestions(Number(e.target.value))}
              className="w-full bg-slate-700 border border-slate-600 text-slate-200 py-2.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {currentFormatDetails.questionCountOptions.map(count => (
                <option key={count} value={count}>{count} 題</option>
              ))}
            </select>
          </div>
          <div className="max-w-xs mx-auto flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleStartTest}
              className={`w-full ${currentFormatDetails.color} text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-75 text-xl`}
            >
              開始測驗
            </button>
            <button
              onClick={() => setTestState(TestState.HISTORY)}
              className={`w-full sm:w-auto bg-slate-600 hover:bg-slate-500 text-slate-200 font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-75 flex items-center justify-center gap-2`}
            >
              <History className="w-5 h-5" />
              <span>紀錄</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryScreen = () => (
    <div className="bg-slate-800 p-4 sm:p-6 md:p-8 rounded-xl shadow-2xl max-w-4xl mx-auto text-slate-200">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-sky-400">測驗歷史紀錄</h2>
      {testHistory.length > 0 ? (
        <>
          <button
            onClick={handleExportCsv}
            className="w-full sm:w-auto mx-auto block mb-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-150 ease-in-out text-base sm:text-lg"
          >
            下載完整 CSV 報表
          </button>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 border-t border-slate-700 pt-4">
            {testHistory.slice().reverse().map(record => (
              <div key={record.id} className="bg-slate-900/50 p-3 sm:p-4 rounded-lg border border-slate-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="mb-2 sm:mb-0">
                    <p className="font-semibold text-base sm:text-lg text-slate-300">{record.examName}</p>
                    <p className="text-xs sm:text-sm text-slate-400">{new Date(record.timestamp).toLocaleString('zh-TW')}</p>
                  </div>
                  <div className="text-right w-full sm:w-auto">
                     <p className="text-lg font-bold">
                       <span className="text-green-400">{record.score.correct}</span> / 
                       <span className="text-slate-400">{record.questions.length}</span> 題
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">
                      耗時: {Math.floor(record.elapsedTimeInSeconds / 60)}分 {record.elapsedTimeInSeconds % 60}秒
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-center text-slate-400 py-8">目前沒有任何測驗紀錄。</p>
      )}
      <button
        onClick={goToWelcomeScreen}
        className="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
      >
        返回主選單
      </button>
    </div>
  );

  const renderContent = () => {
    const currentFormatDetails = EXAM_FORMATS.find(f => f.id === selectedExamFormatId) || EXAM_FORMATS[0];
    switch (testState) {
      case TestState.WELCOME:
        return renderWelcomeScreen();
      case TestState.HISTORY:
        return renderHistoryScreen();
      case TestState.ANSWERING_QUESTIONS:
        if (questions.length === 0 || !questions[currentQuestionIndex]) {
          return <p className="text-center text-red-500">沒有題目可供回答。請重新開始。</p>;
        }
        const currentQuestion = questions[currentQuestionIndex];
        return (
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            answer={answers[currentQuestion.id] || ''}
            onAnswerChange={handleAnswerChange}
            onNext={handleNextQuestion}
            onPrevious={handlePreviousQuestion}
            isLastQuestion={currentQuestionIndex === questions.length - 1}
            currentQuestionIndex={currentQuestionIndex}
            elapsedTimeInSeconds={elapsedTimeInSeconds}
            generatingModel={generatingModel}
          />
        );
      case TestState.VIEWING_FEEDBACK:
        return (
          <div className="bg-slate-800 p-4 sm:p-6 md:p-8 rounded-xl shadow-2xl max-w-4xl mx-auto text-slate-200">
            <h2 className={`text-2xl sm:text-3xl font-bold mb-2 text-center ${currentFormatDetails.titleColor}`}>測驗回饋</h2>
            <p className={`text-sm text-center text-slate-400 mb-6 whitespace-pre-line`}>針對：{currentFormatDetails.displayName}</p>
            
            {score && (
              <div className="grid grid-cols-2 gap-4 mb-8 text-center">
                <div className="bg-green-800/60 p-4 rounded-lg shadow-lg border border-green-700">
                  <p className="text-4xl md:text-5xl font-extrabold text-green-300">{score.correct}</p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-300">答對題數</p>
                </div>
                <div className="bg-red-800/60 p-4 rounded-lg shadow-lg border border-red-700">
                  <p className="text-4xl md:text-5xl font-extrabold text-red-300">{score.incorrect}</p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-300">答錯題數</p>
                </div>
              </div>
            )}
             <div className="mb-8 text-center text-slate-300">
              總作答時間：
              <span className={`font-semibold ${currentFormatDetails.titleColor}`}>
                {Math.floor(elapsedTimeInSeconds / 60)} 分 {elapsedTimeInSeconds % 60} 秒
              </span>
            </div>

            {feedback ? (
              <div className="space-y-6">
                {feedback.errorAnalysis && feedback.errorAnalysis.trim() && !feedback.errorAnalysis.includes("無錯誤題目") && (
                  <div className="bg-rose-950/40 p-4 sm:p-5 rounded-xl border border-rose-800/60">
                    <div className="flex items-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <h3 className="text-xl font-bold text-rose-400 ml-3">錯誤題目詳解</h3>
                    </div>
                    <div
                      className="prose prose-sm sm:prose-base prose-invert max-w-none text-slate-300 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-rose-300 [&_h4]:mt-4 [&_h4]:mb-2 [&_h4:first-of-type]:mt-0 [&_p]:leading-relaxed [&_strong]:text-white [&_p>strong]:text-base"
                      dangerouslySetInnerHTML={{ __html: feedback.errorAnalysis }}
                    />
                  </div>
                )}
                {feedback.learningSuggestions && (
                  <div className="bg-cyan-950/40 p-4 sm:p-5 rounded-xl border border-cyan-800/60">
                    <div className="flex items-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                         <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                      </svg>
                      <h3 className="text-xl font-bold text-cyan-400 ml-3">學習準備建議</h3>
                    </div>
                    <div
                      className="prose prose-sm sm:prose-base prose-invert max-w-none text-slate-300 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-cyan-300 [&_h4]:mt-4 [&_h4]:mb-2 [&_h4:first-of-type]:mt-0 [&_p]:leading-relaxed [&_strong]:text-white [&_strong]:font-semibold [&_p>strong]:text-base"
                      dangerouslySetInnerHTML={{ __html: feedback.learningSuggestions }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-slate-400">目前沒有回饋。</p>
            )}
            <div className="mt-8">
              <button
                onClick={handleRestartTest}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
              >
                返回主選單
              </button>
            </div>
          </div>
        );
      default:
        return null; 
    }
  };
  
  useEffect(() => {
    if (error && testState === TestState.ANSWERING_QUESTIONS && questions.length > 0 && answers[questions[currentQuestionIndex]?.id]) {
        setError(null);
    }
  }, [answers, currentQuestionIndex, questions, error, testState]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 p-4 sm:p-8 flex flex-col items-center justify-center">
      {isLoading && (
        <LoadingOverlay 
          messages={
            testState === TestState.GRADING 
              ? gradingMessages 
              : questionGenerationMessages
          }
          progress={testState === TestState.GENERATING_QUESTIONS ? generatedQuestionsCount : undefined}
          total={testState === TestState.GENERATING_QUESTIONS ? selectedNumQuestions : undefined}
        />
      )}
      {error && <ErrorModal message={error} onClose={() => setError(null)} />}
      
      <header className="mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500">
          凡凡模擬考小幫手
        </h1>
        <p className="mt-2 text-slate-400 text-base sm:text-lg">Fantextic AI Mock Test Helper</p>
      </header>

      <main className="w-full max-w-4xl">
        {renderContent()}
      </main>

      <footer className="mt-8 sm:mt-12 text-center text-slate-500 text-xs sm:text-sm">
        <p>由 Bluesailboat Chen 製作，使用 Google Gemini 生成考題，更新時間：2025.10</p>
        <p className="mt-1 sm:mt-2">如果遇到異常或錯誤，請稍等幾分鐘後再重試。</p>
      </footer>
    </div>
  );
};

export default App;
