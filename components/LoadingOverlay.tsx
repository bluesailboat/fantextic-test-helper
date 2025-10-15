
import React, { useState, useEffect } from 'react';

interface LoadingOverlayProps {
  messages: string[];
  progress?: number;
  total?: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ messages, progress, total }) => {
  const [message, setMessage] = useState(messages && messages.length > 0 ? messages[0] : "處理中，請稍候...");

  useEffect(() => {
    if (!messages || messages.length <= 1) {
      setMessage(messages && messages.length === 1 ? messages[0] : "處理中，請稍候...");
      return;
    }

    const intervalId = setInterval(() => {
      setMessage(prevMessage => {
        const currentIndex = messages.indexOf(prevMessage);
        const nextIndex = (currentIndex + 1) % messages.length;
        return messages[nextIndex];
      });
    }, 3000); // Change text every 3 seconds

    return () => clearInterval(intervalId);
  }, [messages]);

  const showProgress = progress !== undefined && total !== undefined && total > 0;

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col justify-center items-center z-50 backdrop-blur-sm">
      <div className="w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-xl text-slate-200 font-semibold text-center px-4">{message}</p>
      {showProgress && (
        <div className="mt-4 w-64">
            <div className="bg-slate-700 rounded-full h-2.5">
                <div 
                    className="bg-gradient-to-r from-sky-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${(progress / total) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-label="Question generation progress"
                ></div>
            </div>
            <p className="mt-2 text-lg text-slate-300 text-center">
                {progress} / {total} 題
            </p>
        </div>
      )}
    </div>
  );
};
