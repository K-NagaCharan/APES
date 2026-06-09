import React, { useState, useEffect, useRef } from 'react';
import ChatWindow from '../components/chat/ChatWindow';
import ChatInput from '../components/chat/ChatInput';
import { sendMessage } from '../services/chat';

/**
 * Generate a unique ID defensively
 */
const generateId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const WELCOME_MESSAGE = {
  id: 'welcome-message',
  role: 'assistant',
  content: "Hi! I'm APES AI.\n\nI can help you search your photos, organize memories, and deliver albums.\n\nHow can I help today?",
  timestamp: new Date().toISOString()
};

/**
 * Chat Page Component
 * Exposes conversational chat loop between authenticated user and the AI Agent.
 */
const Chat = () => {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('chat');
      return saved ? JSON.parse(saved) : [WELCOME_MESSAGE];
    } catch (e) {
      return [WELCOME_MESSAGE];
    }
  });

  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Sync state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('chat', JSON.stringify(messages));
  }, [messages]);

  // Return focus to input box when loading completes
  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  const handleSendMessage = async (text) => {
    // 1. Optimistic UI update for user message
    const userMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // 2. Fetch reply from chat service
      const response = await sendMessage(text);
      
      const assistantMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString()
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // 3. Fallback error bubble on failure
      const errorMessage = {
        id: generateId(),
        role: 'assistant',
        content: "Sorry, I couldn't process your request. Please try again.",
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your chat history?')) {
      setMessages([WELCOME_MESSAGE]);
    }
  };

  return (
    <div className="flex-grow flex flex-col h-[calc(100vh-73px)] max-h-[calc(100vh-73px)] overflow-hidden">
      <div className="flex-grow flex flex-col max-w-[900px] w-full mx-auto px-4 md:px-6 min-h-0">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-[#e8e4dc] py-3 select-none flex-shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-[#0f0e0c] font-sans flex items-center">
              APES AI Agent
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full ml-2 animate-pulse" />
            </h1>
            <p className="text-[10px] text-[#6b6760] font-mono">Sprint 2 Agent Interface</p>
          </div>
          <button
            onClick={handleClearHistory}
            disabled={messages.length <= 1}
            className="px-3 py-1.5 border border-[#e8e4dc] hover:border-red-200 text-[#6b6760] hover:text-red-600 disabled:opacity-50 text-[10px] font-mono uppercase tracking-wider rounded-lg transition active:scale-95 cursor-pointer disabled:cursor-not-allowed bg-white"
          >
            Clear Chat
          </button>
        </div>

        {/* Message window */}
        <ChatWindow messages={messages} loading={loading} />

        {/* Sticky footer input */}
        <div className="py-4 border-t border-[#e8e4dc] bg-[#faf9f6] flex-shrink-0">
          <ChatInput onSend={handleSendMessage} loading={loading} inputRef={inputRef} />
        </div>
      </div>
    </div>
  );
};

export default Chat;
