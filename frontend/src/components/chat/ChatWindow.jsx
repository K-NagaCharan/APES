import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

/**
 * ChatWindow Component
 * Container managing the message history viewport.
 * Uses a smooth scroll anchor to scroll down on updates.
 *
 * @param {object} props
 * @param {Array} props.messages - List of ChatMessage objects.
 * @param {boolean} props.loading - Active request status indicator.
 */
const ChatWindow = ({ messages, loading }) => {
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  return (
    <div className="flex-grow overflow-y-auto px-4 py-6 space-y-4 min-h-0 select-text">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {loading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatWindow;
