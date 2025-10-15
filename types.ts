export interface QuestionOption {
  key: string; // e.g., "A", "B", "C", "D"
  text: string;
}

export interface Question {
  id: string;
  questionText: string;
  options: QuestionOption[];
  correctAnswerKey: string; // The key of the correct option
  topic: string; // The specific topic this question relates to.
  explanation: string; // Detailed explanation for the correct answer.
}

export interface FeedbackResponse {
  errorAnalysis: string;
  learningSuggestions: string;
}

export type AnswerRecord = Record<string, string>; // questionId: selectedOptionKey

export enum TestState {
  WELCOME = 'WELCOME', // Initial state before starting the test
  GENERATING_QUESTIONS = 'GENERATING_QUESTIONS',
  ANSWERING_QUESTIONS = 'ANSWERING_QUESTIONS',
  GRADING = 'GRADING',
  VIEWING_FEEDBACK = 'VIEWING_FEEDBACK',
  HISTORY = 'HISTORY', // New state for viewing history
}

export interface TopicAnalysis {
  [topic: string]: {
    correct: number;
    incorrect: number;
    total: number;
  };
}

export interface TestRecord {
  id: string; // e.g., timestamp
  examId: string;
  examName: string;
  timestamp: number;
  score: { correct: number; incorrect: number };
  elapsedTimeInSeconds: number;
  questions: Question[];
  answers: AnswerRecord;
  topicAnalysis: TopicAnalysis;
}
