'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioChatProps {
  restaurantId: string;
  sessionId: string;
  agentUrl: string;
  onTranscript: (text: string, role?: 'user' | 'agent') => void;
  onAudioResponse?: (text: string) => void;
}

/**
 * AudioChat — Real-time voice ordering via Gemini Live API.
 *
 * Flow:
 *   1. User taps mic -> getUserMedia captures PCM16 audio at 16kHz
 *   2. ScriptProcessor sends PCM16 chunks via WebSocket (type: audio_chunk)
 *   3. Server bridges to Gemini Live API for real-time STT+LLM+TTS
 *   4. Server streams back audio chunks (PCM16 24kHz) + text transcripts
 *   5. Client plays audio via AudioContext + shows transcripts
 */
export function AudioChat({
  restaurantId,
  sessionId,
  agentUrl,
  onTranscript,
  onAudioResponse,
}: AudioChatProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusText, setStatusText] = useState('Tap to speak');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const recordingRef = useRef(false); // Ref to track recording in onaudioprocess

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Connect WebSocket for audio streaming
  const connectAudioWs = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const wsUrl = agentUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      const ws = new WebSocket(`${wsUrl}/ws/live-chat`);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('[AudioChat] WebSocket connected');
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleServerMessage(msg);
        } catch (e) {
          console.error('[AudioChat] Parse error:', e);
        }
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        console.log('[AudioChat] WebSocket disconnected');
        if (recordingRef.current) {
          stopRecording();
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        console.error('[AudioChat] WebSocket error:', err);
        reject(err);
      };

      wsRef.current = ws;
    });
  }, [agentUrl]);

  // Handle messages from the server
  const handleServerMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'audio_ready':
        setStatusText('Listening... speak now!');
        setIsConnecting(false);
        break;

      case 'audio':
        // Received audio chunk from Gemini -> queue for playback
        if (msg.data) {
          setStatusText('AI speaking...');
          playAudioChunk(msg.data, msg.mime_type || 'audio/pcm;rate=24000');
        }
        break;

      case 'audio_end':
        setStatusText('Listening...');
        break;

      case 'transcript':
        // Text transcript from Gemini
        if (msg.content) {
          onTranscript(msg.content, msg.role || 'agent');
          if (msg.role === 'agent' && onAudioResponse) {
            onAudioResponse(msg.content);
          }
        }
        break;

      case 'text':
        // Fallback text response
        if (msg.content) {
          onTranscript(msg.content, 'agent');
        }
        break;

      case 'error':
        console.error('[AudioChat] Server error:', msg.content);
        setStatusText('Connection error');
        break;
    }
  }, [onTranscript, onAudioResponse]);

  // Start recording and streaming audio
  const startRecording = useCallback(async () => {
    setIsConnecting(true);
    setStatusText('Connecting...');

    try {
      // 1. Connect WebSocket
      const ws = await connectAudioWs();

      // 2. Get microphone access
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

      // 3. Set up AudioContext for capture
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // Set up analyser for level visualization
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 4. Use ScriptProcessor for PCM16 capture
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      recordingRef.current = true;

      processor.onaudioprocess = (e) => {
        if (!recordingRef.current) return;

        const input = e.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Encode as base64 and send via WebSocket
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'audio_chunk',
            data: base64,
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // 5. Start audio level animation
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

      // 6. Tell server to start audio session
      ws.send(JSON.stringify({
        type: 'audio_start',
        restaurant_id: restaurantId,
        session_id: sessionId,
        sample_rate: 16000,
      }));

      setIsRecording(true);
      setStatusText('Connecting to AI...');

    } catch (err: any) {
      console.error('[AudioChat] Start error:', err);
      setIsConnecting(false);

      if (err.name === 'NotAllowedError') {
        setStatusText('Microphone access denied');
      } else {
        setStatusText('Connection failed');
      }
    }
  }, [connectAudioWs, restaurantId, sessionId]);

  // Stop recording
  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);

    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    // Tell server to stop audio
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'audio_stop' }));
      } catch {}
      wsRef.current.close();
    }
    wsRef.current = null;

    // Close playback context
    if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;

    setIsRecording(false);
    setIsConnecting(false);
    setStatusText('Tap to speak');
  }, []);

  // Play received audio chunk (PCM16 from Gemini)
  const playAudioChunk = useCallback((base64Data: string, mimeType: string) => {
    try {
      // Decode base64 to bytes
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Parse sample rate from mime type (e.g., "audio/pcm;rate=24000")
      const rateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

      // Convert Int16 to Float32
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      // Queue and play
      playbackQueueRef.current.push(float32);
      if (!isPlayingRef.current) {
        playNextChunk(sampleRate);
      }
    } catch (err) {
      console.error('[AudioChat] Playback error:', err);
    }
  }, []);

  const playNextChunk = useCallback((sampleRate: number) => {
    const chunk = playbackQueueRef.current.shift();
    if (!chunk) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;

    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate });
    }

    const ctx = playbackCtxRef.current;
    const buffer = ctx.createBuffer(1, chunk.length, sampleRate);
    buffer.copyToChannel(chunk, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => playNextChunk(sampleRate);
    source.start();
  }, []);

  const toggleRecording = () => {
    if (isRecording || isConnecting) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="p-4 border-t border-gray-800 bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        {/* Audio Level Visualization */}
        <div className="flex items-center gap-1 h-10">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-all duration-75"
              style={{
                height: isRecording
                  ? `${Math.max(4, audioLevel * 40 * (1 + Math.sin(Date.now() / 100 + i) * 0.3))}px`
                  : '4px',
                backgroundColor: isRecording
                  ? audioLevel > 0.5
                    ? '#f97316'
                    : audioLevel > 0.2
                    ? '#22c55e'
                    : '#6b7280'
                  : '#374151',
              }}
            />
          ))}
        </div>

        {/* Record Button */}
        <button
          onClick={toggleRecording}
          disabled={isConnecting}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isConnecting
              ? 'bg-yellow-600 cursor-wait'
              : isRecording
              ? 'bg-red-600 hover:bg-red-500 animate-pulse shadow-lg shadow-red-600/30'
              : 'bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-600/20'
          }`}
        >
          {isConnecting ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isRecording ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        <p className="text-xs text-gray-500">
          {statusText}
        </p>

        {/* Language hint */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="px-2 py-0.5 bg-gray-800 rounded">EN</span>
          <span className="px-2 py-0.5 bg-gray-800 rounded">中文</span>
          <span className="px-2 py-0.5 bg-gray-800 rounded">粵語</span>
          <span className="px-2 py-0.5 bg-gray-800 rounded">ES</span>
        </div>
      </div>
    </div>
  );
}
