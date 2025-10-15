
import React from 'react';

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

const ErrorIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-red-500 mx-auto mb-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);

export const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl max-w-sm w-full border border-slate-700">
        <ErrorIcon />
        <h3 className="text-xl font-semibold text-center text-red-400 mb-3">發生錯誤</h3>
        <p className="text-slate-300 text-center mb-6">{message}</p>
        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
        >
          關閉
        </button>
      </div>
    </div>
  );
};
