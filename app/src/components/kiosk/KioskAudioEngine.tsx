'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface CartItem {
  menu_item_id: string;
  item_name: string;
  price_usd: number;
  quantity: number;
  modifications?: string[];
}

export interface MenuCardMatch {
  name: string;
  price_usd: number;
  category?: string;
  description?: string;
}

export interface MenuCardData {
  query: string;
  matches: MenuCardMatch[];
}

export interface ReceiptCardData {
  items: string[];
  item_count: number;
  subtotal_usd: number;
  tax_usd?: number;
  total_usd?: number;
  state?: string;
}

export interface CheckoutReadyData {
  checkout: boolean;
  items: Array<{
    item_name: string;
    price_usd: number;
    quantity: number;
    modifications?: string[];
  }>;
  item_count: number;
  subtotal_usd: number;
  tax_usd: number;
  total_usd: number;
  state: string;
}

interface KioskAudioEngineProps {
  restaurantId: string;
  sessionId: string;
  agentUrl: string;
  isActive: boolean;
  onTranscript: (text: string, role: 'user' | 'agent') => void;
  onCartUpdate: (items: CartItem[]) => void;
  onActivityDetected: () => void;
  onCheckoutRequested: () => void;
  onCheckoutReady?: (data: CheckoutReadyData) => void;
  onOrderTotal?: (data: { subtotal: number; tax: number; total: number }) => void;
  onMenuCard?: (data: MenuCardData) => void;
  onReceiptCard?: (data: ReceiptCardData) => void;
}

/**
 * KioskAudioEngine — Auto-start/stop voice engine for walk-in kiosk.
 *
 * Adapted from AudioChat.tsx but designed for unattended kiosk operation:
 *   - Auto-starts when isActive=true (no button press needed)
 *   - Auto-stops when isActive=false
 *   - Sends kiosk_mode=true to trigger backend greeting
 *   - Monitors audio for activity detection (inactivity timeout)
 *   - Detects checkout phrases in transcripts
 *   - Larger audio visualization for kiosk display
 */
export function KioskAudioEngine({
  restaurantId,
  sessionId,
  agentUrl,
  isActive,
  onTranscript,
  onCartUpdate,
  onActivityDetected,
  onCheckoutRequested,
  onCheckoutReady,
  onOrderTotal,
  onMenuCard,
  onReceiptCard,
}: KioskAudioEngineProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const activeRef = useRef(false);
  const silentFramesRef = useRef(0);
  // Mute mic while Agent is speaking to prevent echo/feedback noise
  const isMutedRef = useRef(false);
  // Track scheduled playback end time for gapless audio
  const nextPlayTimeRef = useRef(0);
  // Unmute delay timer — wait a bit after playback ends before unmuting
  const unmuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Checkout phrase detection
  const checkoutPhrases = [
    'ready to pay', 'checkout', "that's all", "that is all",
    'i am done', "i'm done", 'done ordering', 'no more',
    'place the order', 'place my order', 'finish',
  ];

  // --- Gapless audio playback pipeline ---
  // Instead of chaining via onended (which causes tiny gaps = 破音/crackling),
  // we schedule each chunk at a precise time using AudioContext.currentTime.
  // This ensures seamless back-to-back playback with zero gaps.

  const scheduleChunk = useCallback((chunk: Float32Array, sampleRate: number) => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate });
    }

    const ctx = playbackCtxRef.current;

    // Resume if suspended (mobile autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const buffer = ctx.createBuffer(1, chunk.length, sampleRate);
    buffer.copyToChannel(chunk, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // Schedule at the next available time (gapless)
    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    const duration = chunk.length / sampleRate;
    nextPlayTimeRef.current = startTime + duration;

    source.onended = () => {
      // Check if this was the last chunk (no more scheduled after this)
      if (ctx.currentTime >= nextPlayTimeRef.current - 0.01) {
        isPlayingRef.current = false;
        setIsSpeaking(false);
        setStatusText('Listening...');
        // Delay unmute by 300ms to prevent room reverb from being picked up
        if (unmuteTimerRef.current) clearTimeout(unmuteTimerRef.current);
        unmuteTimerRef.current = setTimeout(() => {
          isMutedRef.current = false;
        }, 300);
      }
    };

    source.start(startTime);
  }, []);

  const playAudioChunk = useCallback(
    (base64Data: string, mimeType: string) => {
      try {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768.0;
        }

        isPlayingRef.current = true;
        setIsSpeaking(true);

        // Cancel any pending unmute since new audio arrived
        if (unmuteTimerRef.current) {
          clearTimeout(unmuteTimerRef.current);
          unmuteTimerRef.current = null;
        }

        // Schedule immediately — gapless playback
        scheduleChunk(float32, sampleRate);
      } catch (err) {
        console.error('[KioskAudio] Playback error:', err);
      }
    },
    [scheduleChunk]
  );

  // --- Server message handler ---

  const handleServerMessage = useCallback(
    (msg: any) => {
      switch (msg.type) {
        case 'audio_ready':
          setStatusText('Listening...');
          setIsConnected(true);
          break;

        case 'audio':
          if (msg.data) {
            setStatusText('Foody speaking...');
            // Mute mic while Agent is speaking to prevent echo/feedback
            isMutedRef.current = true;
            playAudioChunk(msg.data, msg.mime_type || 'audio/pcm;rate=24000');
            onActivityDetected();
          }
          break;

        case 'audio_end':
          // Don't unmute here — wait for actual playback to finish
          // isMutedRef is cleared in playNextChunk when queue is empty
          break;

        case 'transcript':
          if (msg.content) {
            onTranscript(msg.content, msg.role || 'agent');
            onActivityDetected();

            // Check for checkout phrases in agent/user speech
            const lower = msg.content.toLowerCase();
            if (
              checkoutPhrases.some((phrase) => lower.includes(phrase))
            ) {
              onCheckoutRequested();
            }
          }
          break;

        case 'cart_update':
          if (msg.data) {
            const items = msg.data.items || [];
            // Parse items — they come as display strings from live_tools
            const parsedItems: CartItem[] = [];
            if (Array.isArray(items)) {
              for (const item of items) {
                if (typeof item === 'string') {
                  // Parse format: "Kung Pao Chicken x2 (extra spicy) - $25.90"
                  const match = item.match(
                    /^(.+?)\s+x(\d+)(?:\s+\((.+?)\))?\s+-\s+\$(.+)$/
                  );
                  if (match) {
                    parsedItems.push({
                      menu_item_id: match[1].toLowerCase().replace(/\s+/g, '_'),
                      item_name: match[1],
                      quantity: parseInt(match[2]),
                      modifications: match[3] ? match[3].split(', ') : [],
                      price_usd: parseFloat(match[4]) / parseInt(match[2]),
                    });
                  }
                } else if (typeof item === 'object' && item.item_name) {
                  parsedItems.push(item as CartItem);
                }
              }
            }
            onCartUpdate(parsedItems);
            onActivityDetected();

            // Check for order total info
            if (msg.data.total_usd && onOrderTotal) {
              onOrderTotal({
                subtotal: msg.data.subtotal_usd || 0,
                tax: msg.data.tax_usd || 0,
                total: msg.data.total_usd,
              });
            }
          }
          break;

        case 'menu_card':
          if (msg.data && onMenuCard) {
            onMenuCard(msg.data as MenuCardData);
            onActivityDetected();
          }
          break;

        case 'receipt_card':
          if (msg.data && onReceiptCard) {
            onReceiptCard(msg.data as ReceiptCardData);
            onActivityDetected();
          }
          break;

        case 'checkout_ready':
          if (msg.data && msg.data.checkout) {
            if (onCheckoutReady) {
              onCheckoutReady(msg.data as CheckoutReadyData);
            } else {
              // Fallback to keyword-based checkout
              onCheckoutRequested();
            }
            onActivityDetected();
          }
          break;

        case 'text':
          if (msg.content) {
            onTranscript(msg.content, 'agent');
            onActivityDetected();
          }
          break;

        case 'error':
          console.error('[KioskAudio] Server error:', msg.content);
          setStatusText('Connection issue...');
          break;
      }
    },
    [
      playAudioChunk,
      onTranscript,
      onCartUpdate,
      onActivityDetected,
      onCheckoutRequested,
      onCheckoutReady,
      onOrderTotal,
      onMenuCard,
      onReceiptCard,
    ]
  );

  // --- Start/Stop audio based on isActive ---

  const startAudio = useCallback(async () => {
    setStatusText('Connecting...');

    try {
      // 0. Pre-initialize playback AudioContext during user gesture
      // Mobile browsers (iOS/Android) require AudioContext to be created/resumed
      // inside a user interaction event handler. This tap-to-order is that gesture.
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      if (playbackCtxRef.current.state === 'suspended') {
        await playbackCtxRef.current.resume();
      }
      console.log('[KioskAudio] Playback AudioContext ready:', playbackCtxRef.current.state);

      // 1. Connect WebSocket
      const wsUrl = agentUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(`${wsUrl}/ws/live-chat`);
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error('WebSocket timeout'));
        }, 10000);

        socket.onopen = () => {
          clearTimeout(timeout);
          resolve(socket);
        };
        socket.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
        };
        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleServerMessage(msg);
          } catch (e) {
            console.error('[KioskAudio] Parse error:', e);
          }
        };
        socket.onclose = () => {
          clearTimeout(timeout);
          console.log('[KioskAudio] WebSocket closed');
          if (activeRef.current) {
            setIsConnected(false);
            setStatusText('Reconnecting...');
          }
        };
      });
      wsRef.current = ws;

      // 2. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });
      mediaStreamRef.current = stream;

      // 3. AudioContext for capture
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 4. ScriptProcessor for PCM16
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!activeRef.current) return;

        // Skip sending audio when Agent is speaking to prevent echo/feedback
        if (isMutedRef.current) return;

        const input = e.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(input.length);
        let hasSound = false;
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          if (Math.abs(input[i]) > 0.01) hasSound = true;
        }

        // Activity detection
        if (hasSound) {
          silentFramesRef.current = 0;
          onActivityDetected();
        } else {
          silentFramesRef.current++;
        }

        // Encode as base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio_chunk', data: base64 }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // 5. Audio level animation
      const updateLevel = () => {
        if (analyserRef.current) {
          const data = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
          setAudioLevel(avg / 255);
        }
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // 6. Tell server to start — with kiosk_mode flag
      ws.send(
        JSON.stringify({
          type: 'audio_start',
          restaurant_id: restaurantId,
          session_id: sessionId,
          sample_rate: 16000,
          kiosk_mode: true,
        })
      );

      setStatusText('Connecting to Foody...');
    } catch (err: any) {
      console.error('[KioskAudio] Start error:', err);
      if (err.name === 'NotAllowedError') {
        setStatusText('Microphone access needed');
      } else {
        setStatusText('Connection failed');
      }
    }
  }, [agentUrl, restaurantId, sessionId, handleServerMessage, onActivityDetected]);

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'audio_stop' }));
      } catch {}
      wsRef.current.close();
    }
    wsRef.current = null;

    if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
    if (unmuteTimerRef.current) {
      clearTimeout(unmuteTimerRef.current);
      unmuteTimerRef.current = null;
    }
    isMutedRef.current = false;

    setIsConnected(false);
    setIsSpeaking(false);
    setStatusText('');
  }, []);

  // Auto-start/stop based on isActive prop
  useEffect(() => {
    activeRef.current = isActive;

    if (isActive) {
      startAudio();
    } else {
      stopAudio();
    }

    return () => {
      activeRef.current = false;
      stopAudio();
    };
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isActive) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-1">
      {/* Compact mic indicator */}
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
          isSpeaking
            ? 'bg-orange-600 shadow-md shadow-orange-600/40'
            : isConnected
            ? 'bg-green-600 shadow-md shadow-green-600/30 animate-pulse'
            : 'bg-gray-700'
        }`}
      >
        {isSpeaking ? (
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </div>

      {/* Mini audio visualizer */}
      <div className="flex items-end gap-0.5 h-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="w-0.5 sm:w-1 rounded-full transition-all duration-75"
            style={{
              height: isConnected
                ? `${Math.max(2, audioLevel * 24 * (1 + Math.sin(Date.now() / 100 + i) * 0.3))}px`
                : '2px',
              backgroundColor: isSpeaking ? '#f97316' : audioLevel > 0.2 ? '#22c55e' : '#374151',
            }}
          />
        ))}
      </div>

      {/* Status text */}
      {statusText && (
        <span className="text-[10px] sm:text-xs text-gray-400">{statusText}</span>
      )}

      {/* Language pills */}
      <div className="hidden sm:flex items-center gap-1 text-[9px] text-gray-600">
        <span className="px-1 py-0.5 bg-gray-800 rounded">EN</span>
        <span className="px-1 py-0.5 bg-gray-800 rounded">中文</span>
        <span className="px-1 py-0.5 bg-gray-800 rounded">ES</span>
      </div>
    </div>
  );
}
