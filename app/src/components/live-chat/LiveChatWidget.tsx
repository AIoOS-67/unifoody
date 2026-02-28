'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioChat } from './AudioChat';
import { VisualMenu } from './VisualMenu';
import { CartSidebar } from './CartSidebar';
import { ImageUpload } from './ImageUpload';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  type?: 'text' | 'menu_cards' | 'cart_update' | 'payment_link';
  data?: any;
}

interface LiveChatWidgetProps {
  restaurantId: string;
  restaurantName: string;
  agentUrl?: string;
}

export function LiveChatWidget({ restaurantId, restaurantName, agentUrl }: LiveChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [showMenu, setShowMenu] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reconnectAttempt = useRef(0);
  const MAX_RECONNECT = 5;

  // For REST calls, use the Next.js proxy to handle Cloud Run auth
  const proxyUrl = '/api/agent';
  // For WebSocket, connect directly
  const wsBaseUrl = agentUrl || process.env.NEXT_PUBLIC_AGENT_URL || 'https://foodyepay-agent-443906211776.us-east1.run.app';

  // Generate session ID
  useEffect(() => {
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message
  useEffect(() => {
    if (restaurantName) {
      setMessages([{
        id: 'welcome',
        role: 'agent',
        content: `Hello! Welcome to ${restaurantName}. How can I help you order today? 🍜\n\n您好！欢迎来到${restaurantName}。今天想吃什么？`,
        timestamp: new Date(),
      }]);
    }
  }, [restaurantName]);

  // Connect WebSocket for text chat
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = wsBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws/live-chat`);

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempt.current = 0; // Reset on successful connection
      console.log('[LiveChat] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleAgentMessage(msg);
      } catch (e) {
        console.error('[LiveChat] Failed to parse message:', e);
      }
      setIsLoading(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Exponential backoff reconnect: 1s, 2s, 4s, 8s, 16s (max 5 attempts)
      if (reconnectAttempt.current < MAX_RECONNECT) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
        reconnectAttempt.current++;
        console.log(`[LiveChat] Reconnecting in ${delay}ms (attempt ${reconnectAttempt.current}/${MAX_RECONNECT})`);
        setTimeout(connectWs, delay);
      } else {
        console.log('[LiveChat] Max reconnect attempts reached');
      }
    };

    ws.onerror = (err) => {
      console.error('[LiveChat] WebSocket error:', err);
    };

    wsRef.current = ws;
  }, [wsBaseUrl]);

  // Handle incoming agent messages (from WebSocket)
  const handleAgentMessage = useCallback((msg: any) => {
    if (msg.type === 'transcript') {
      // Voice transcript — add to messages
      const newMsg: Message = {
        id: `${msg.role}_${Date.now()}`,
        role: msg.role || 'agent',
        content: msg.content || '',
        timestamp: new Date(),
        type: 'text',
      };
      setMessages(prev => [...prev, newMsg]);
      return;
    }

    const newMsg: Message = {
      id: `agent_${Date.now()}`,
      role: 'agent',
      content: msg.content || '',
      timestamp: new Date(),
      type: msg.type || 'text',
      data: msg.data,
    };

    setMessages(prev => [...prev, newMsg]);

    // Handle special message types
    if (msg.type === 'cart_update' && msg.data) {
      setCartItems(msg.data.items || []);
    }
  }, []);

  // Send text message via REST (more reliable than WS for text)
  const sendTextMessage = async (text: string) => {
    if (!text.trim()) return;

    // Add user message to UI
    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const resp = await fetch(`${proxyUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          restaurant_id: restaurantId,
          session_id: sessionId,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const agentMsg: Message = {
          id: `agent_${Date.now()}`,
          role: 'agent',
          content: data.response || 'Sorry, I could not process that.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMsg]);
        if (data.session_id) setSessionId(data.session_id);
      } else {
        throw new Error(`HTTP ${resp.status}`);
      }
    } catch (err) {
      console.error('[LiveChat] Send error:', err);
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        role: 'agent',
        content: 'Sorry, I\'m having trouble connecting. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Send image via WebSocket for Gemini Vision processing
  const sendImageViaWs = useCallback((imageData: string, mimeType: string) => {
    // If WS connected, use it for image processing
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'image',
        data: imageData,
        mime_type: mimeType,
        restaurant_id: restaurantId,
        session_id: sessionId,
      }));

      // Add a visual indicator
      setMessages(prev => [...prev, {
        id: `user_img_${Date.now()}`,
        role: 'user',
        content: '📷 [Photo uploaded for dish identification]',
        timestamp: new Date(),
      }]);
      setIsLoading(true);
      return;
    }

    // Fallback: connect WS first, then send
    const wsUrl = wsBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws/live-chat`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'image',
        data: imageData,
        mime_type: mimeType,
        restaurant_id: restaurantId,
        session_id: sessionId,
      }));
      wsRef.current = ws;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleAgentMessage(msg);
      } catch (e) {
        console.error('[LiveChat] Parse error:', e);
      }
      setIsLoading(false);
    };

    setMessages(prev => [...prev, {
      id: `user_img_${Date.now()}`,
      role: 'user',
      content: '📷 [Photo uploaded for dish identification]',
      timestamp: new Date(),
    }]);
    setIsLoading(true);
  }, [wsBaseUrl, restaurantId, sessionId, handleAgentMessage]);

  // Handle voice transcript from AudioChat
  const handleVoiceTranscript = useCallback((text: string, role?: 'user' | 'agent') => {
    if (role === 'agent') {
      // Agent response from voice — already shown via audio
      return;
    }
    // User transcript — send as text to chat for fallback
    // (In full Gemini Live mode, the agent responds via audio directly)
    sendTextMessage(text);
  }, [restaurantId, sessionId]);

  const handleSend = () => {
    sendTextMessage(inputText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageResult = (description: string) => {
    // For REST fallback responses
    const agentMsg: Message = {
      id: `agent_${Date.now()}`,
      role: 'agent',
      content: description,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, agentMsg]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-lg font-bold">
            AI
          </div>
          <div>
            <h3 className="font-semibold text-white">{restaurantName}</h3>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${
                mode === 'voice' ? 'bg-orange-400 animate-pulse' : isConnected ? 'bg-green-400' : 'bg-yellow-400'
              }`} />
              <span className="text-gray-400">
                {mode === 'voice' ? 'Voice Mode' : isConnected ? 'Connected' : 'Text Mode'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <button
            onClick={() => setMode(mode === 'text' ? 'voice' : 'text')}
            className={`p-2 rounded-lg transition-colors ${
              mode === 'voice' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title={mode === 'text' ? 'Switch to voice' : 'Switch to text'}
          >
            {mode === 'voice' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            )}
          </button>

          {/* Menu Toggle */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`p-2 rounded-lg transition-colors ${
              showMenu ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title="Browse Menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Cart Toggle */}
          <button
            onClick={() => setShowCart(!showCart)}
            className={`p-2 rounded-lg transition-colors relative ${
              showCart ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title="View Cart"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            {cartItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                {cartItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-orange-600 text-white rounded-br-md'
                      : 'bg-gray-800 text-gray-100 rounded-bl-md'
                  }`}
                >
                  {msg.type === 'payment_link' && msg.data?.url ? (
                    <div>
                      <p className="mb-2">{msg.content}</p>
                      <a
                        href={msg.data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Pay Now
                      </a>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  )}
                  <p className="text-xs mt-1 opacity-50">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Mode */}
          {mode === 'voice' && (
            <AudioChat
              restaurantId={restaurantId}
              sessionId={sessionId}
              agentUrl={wsBaseUrl}
              onTranscript={handleVoiceTranscript}
              onAudioResponse={(text) => {
                // Show agent's audio response in the chat log
                setMessages(prev => [...prev, {
                  id: `agent_voice_${Date.now()}`,
                  role: 'agent',
                  content: text,
                  timestamp: new Date(),
                }]);
              }}
            />
          )}

          {/* Text Input */}
          {mode === 'text' && (
            <div className="p-3 border-t border-gray-800 bg-gray-900">
              <div className="flex items-center gap-2">
                <ImageUpload
                  restaurantId={restaurantId}
                  sessionId={sessionId}
                  onResult={handleImageResult}
                  onImageSend={sendImageViaWs}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your order... (EN/中文/粵語/ES)"
                  className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm border border-gray-700 focus:border-orange-500 focus:outline-none placeholder-gray-500"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || isLoading}
                  className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  Send
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1.5 text-center">
                Powered by FoodyePay AI Agent + Gemini
              </p>
            </div>
          )}
        </div>

        {/* Visual Menu Sidebar */}
        {showMenu && (
          <VisualMenu
            restaurantId={restaurantId}
            agentUrl={wsBaseUrl}
            sessionId={sessionId}
            onAddItem={(item) => sendTextMessage(`I want to order ${item.name}`)}
            onClose={() => setShowMenu(false)}
          />
        )}

        {/* Cart Sidebar */}
        {showCart && (
          <CartSidebar
            restaurantId={restaurantId}
            items={cartItems}
            onCheckout={() => sendTextMessage('I\'m ready to pay')}
            onClose={() => setShowCart(false)}
          />
        )}
      </div>
    </div>
  );
}
