
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, ChatMode } from '../types';
import { sendChatMessage } from '../services/geminiService';
import { BotIcon, CodeIcon, LocateIcon, SearchIcon, SendIcon, UserIcon, ZapIcon } from './Icons';
import { marked } from 'marked';

export const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>(ChatMode.Chat);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = useCallback(async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { text, sources } = await sendChatMessage(input, chatMode);
      const modelMessage: ChatMessage = { role: 'model', text, sources };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        role: 'model',
        text: 'Entschuldigung, ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, chatMode]);

  const ModeButton = ({ mode, icon, label }: { mode: ChatMode, icon: React.ReactNode, label: string }) => (
    <button
      onClick={() => setChatMode(mode)}
      className={`flex-1 p-2 rounded-md text-sm flex items-center justify-center transition-all duration-200 ${
        chatMode === mode ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600'
      }`}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline ml-2">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-xl shadow-2xl">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Chat & Suche</h2>
        <p className="text-sm text-gray-400">Ihr vielseitiger KI-Assistent für jede textbasierte Aufgabe.</p>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'model' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center"><BotIcon className="h-5 w-5"/></div>}
              <div className={`p-3 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                <div className="prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: marked(msg.text) as string }}/>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <h4 className="text-xs font-semibold text-gray-400 mb-1">Quellen:</h4>
                    <ul className="space-y-1">
                      {msg.sources.map((source, i) => (
                        <li key={i}>
                          <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline break-all">
                            {source.title || source.uri}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
               {msg.role === 'user' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center"><UserIcon className="h-5 w-5"/></div>}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center"><BotIcon className="h-5 w-5"/></div>
              <div className="p-3 rounded-lg bg-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-75"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-150"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2 mb-3">
            <ModeButton mode={ChatMode.Chat} icon={<BotIcon className="h-4 w-4"/>} label="Chat"/>
            <ModeButton mode={ChatMode.LowLatency} icon={<ZapIcon className="h-4 w-4"/>} label="Schnell"/>
            <ModeButton mode={ChatMode.Complex} icon={<CodeIcon className="h-4 w-4"/>} label="Komplex"/>
            <ModeButton mode={ChatMode.Search} icon={<SearchIcon className="h-4 w-4"/>} label="Suche"/>
            <ModeButton mode={ChatMode.Maps} icon={<LocateIcon className="h-4 w-4"/>} label="Maps"/>
        </div>
        <div className="flex items-center bg-gray-700 rounded-lg">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Fragen Sie irgendetwas im ${chatMode}-Modus...`}
            className="w-full p-3 bg-transparent rounded-lg focus:outline-none resize-none"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || input.trim() === ''}
            className="p-3 text-white disabled:text-gray-500 disabled:cursor-not-allowed hover:text-blue-400 transition-colors"
          >
            <SendIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};