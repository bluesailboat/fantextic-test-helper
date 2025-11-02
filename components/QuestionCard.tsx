
import React from 'react';
import { Question, QuestionOption } from '../types.ts';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  answer: string; 
  onAnswerChange: (questionId: string, selectedOptionKey: string) => void;
  onNext: () => void;
  onPrevious?: () => void;
  isLastQuestion: boolean;
  currentQuestionIndex: number;
  elapsedTimeInSeconds: number;
  generatingModel: string | null;
}

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionNumber,
  totalQuestions,
  answer,
  onAnswerChange,
  onNext,
  onPrevious,
  isLastQuestion,
  currentQuestionIndex,
  elapsedTimeInSeconds,
  generatingModel,
}) => {
  const handleOptionChange = (optionKey: string) => {
    onAnswerChange(question.id, optionKey);
  };

  return (
    <div className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-2xl max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
        <h2 className="text-xl font-semibold text-sky-400 mb-2 sm:mb-0">題目 {questionNumber} / {totalQuestions}</h2>
        <div className="flex items-center space-x-4">
          <div className="text-lg text-slate-300">
            作答時間：<span className="font-semibold text-sky-400">{formatTime(elapsedTimeInSeconds)}</span>
          </div>
          <div className="w-32 sm:w-40 bg-slate-700 rounded-full h-2.5">
            <div 
              className="bg-gradient-to-r from-sky-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {generatingModel && (
         <div className="text-right text-xs text-slate-500 mb-4 pr-1">
          由 {generatingModel} 生成
        </div>
      )}

      <div className="mb-6 p-5 bg-slate-700 rounded-lg min-h-[7rem] flex items-center">
        <p className="text-2xl md:text-3xl text-slate-200 whitespace-pre-wrap font-semibold">{question.questionText}</p>
      </div>

      <div className="space-y-4 mb-8">
        {question.options.map((option: QuestionOption) => (
          <label
            key={option.key}
            className={`flex items-center p-4 rounded-lg cursor-pointer transition-all duration-200 ease-in-out border-2
              ${answer === option.key
                ? 'bg-indigo-500 border-indigo-400 text-white shadow-md'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
              }`}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option.key}
              checked={answer === option.key}
              onChange={() => handleOptionChange(option.key)}
              className="form-radio h-6 w-6 text-indigo-600 bg-slate-600 border-slate-500 focus:ring-indigo-500 checked:bg-indigo-600 mr-4 shrink-0"
              aria-labelledby={`option-text-${question.id}-${option.key}`}
            />
            <span id={`option-text-${question.id}-${option.key}`} className="text-lg md:text-xl font-medium">{option.key}. {option.text}</span>
          </label>
        ))}
      </div>
      
      <div className="mt-8 flex flex-col space-y-4 sm:flex-row sm:justify-between sm:space-y-0 sm:space-x-4">
        {currentQuestionIndex > 0 && onPrevious && (
          <button
            onClick={onPrevious}
            className="w-full sm:w-auto bg-slate-600 hover:bg-slate-500 text-slate-200 font-semibold py-3 px-8 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-75 text-xl"
          >
            上一題
          </button>
        )}
        {!(currentQuestionIndex > 0 && onPrevious) && <div className="hidden sm:block sm:w-auto"></div> }

        <button
          onClick={onNext}
          disabled={!answer} 
          className={`w-full sm:w-auto bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed text-xl ${
            !(currentQuestionIndex > 0 && onPrevious) ? 'sm:ml-auto' : '' 
          }`}
        >
          {isLastQuestion ? '提交答案並取得回饋' : '下一題'}
        </button>
      </div>
    </div>
  );
};