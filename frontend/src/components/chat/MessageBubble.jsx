import React from 'react';
import ToolResultGrid from './ToolResultGrid';

/**
 * MessageBubble Component
 * Renders a chat message bubble aligned right for user and left for assistant.
 * Supports standard text messages and structured image galleries with timestamps.
 *
 * @param {object} props
 * @param {object} props.message - ChatMessage object containing id, role, type, content, timestamp, metadata.
 */
const MessageBubble = ({ message }) => {
  const { role, type, content, timestamp } = message;
  const isUser = role === 'user';

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
  };

  const timeStr = formatTime(timestamp);

  // Gallery message renderer
  if (type === 'gallery') {
    return (
      <div className="flex flex-col w-full items-start my-3 select-text">
        <div className="w-full max-w-[85%] md:max-w-[90%]">
          <ToolResultGrid photos={content} />
        </div>
        {timeStr && (
          <span className="text-[10px] text-[#6b6760] font-mono mt-1 ml-2 select-none">
            {timeStr}
          </span>
        )}
      </div>
    );
  }

  // Standard Text message renderer
  return (
    <div className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'} my-2`}>
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs select-text ${
          isUser
            ? 'bg-[#c8501a] text-white rounded-br-none'
            : 'bg-[#f2f0eb] text-[#0f0e0c] rounded-bl-none border border-[#e8e4dc]'
        }`}
      >
        {content}
      </div>
      {timeStr && (
        <span
          className={`text-[10px] text-[#6b6760] font-mono mt-1 select-none ${
            isUser ? 'mr-2' : 'ml-2'
          }`}
        >
          {timeStr}
        </span>
      )}
    </div>
  );
};

export default MessageBubble;
