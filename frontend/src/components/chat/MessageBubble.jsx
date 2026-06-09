import React from 'react';

/**
 * MessageBubble Component
 * Renders a chat message bubble aligned right for user and left for assistant.
 *
 * @param {object} props
 * @param {object} props.message - ChatMessage object containing id, role, content, timestamp.
 */
const MessageBubble = ({ message }) => {
  const { role, content } = message;
  const isUser = role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs select-text ${
          isUser
            ? 'bg-[#c8501a] text-white rounded-br-none'
            : 'bg-[#f2f0eb] text-[#0f0e0c] rounded-bl-none border border-[#e8e4dc]'
        }`}
      >
        {content}
      </div>
    </div>
  );
};

export default MessageBubble;
