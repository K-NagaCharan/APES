import React from 'react';

/**
 * TypingIndicator Component
 * Shows animated bouncing dots representing assistant thought cycle.
 */
const TypingIndicator = () => {
  return (
    <div className="flex w-full justify-start my-2">
      <div className="flex items-center space-x-1.5 bg-[#f2f0eb] border border-[#e8e4dc] px-4 py-3 rounded-2xl rounded-bl-none">
        <span className="text-xs text-[#6b6760] font-mono mr-1 select-none">Thinking</span>
        <div className="w-1.5 h-1.5 bg-[#6b6760] rounded-full animate-bounce [animation-delay:0ms]" />
        <div className="w-1.5 h-1.5 bg-[#6b6760] rounded-full animate-bounce [animation-delay:150ms]" />
        <div className="w-1.5 h-1.5 bg-[#6b6760] rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
};

export default TypingIndicator;
