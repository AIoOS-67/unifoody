'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface MotionDetectorProps {
  enabled: boolean;
  sensitivity?: number; // 0-100, default 25
  onMotionDetected: () => void;
}

/**
 * MotionDetector — Camera-based motion detection for kiosk mode.
 *
 * Uses getUserMedia for front camera, compares consecutive video frames
 * via canvas pixel differencing. Triggers onMotionDetected when a customer
 * approaches the kiosk.
 *
 * Graceful degradation: if camera access is denied, silently disables.
 */
export function MotionDetector({
  enabled,
  sensitivity = 25,
  onMotionDetected,
}: MotionDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consecutiveMotionRef = useRef(0);
  const [cameraAvailable, setCameraAvailable] = useState(true);

  // Frame differencing logic
  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (prevFrameRef.current) {
      const prev = prevFrameRef.current.data;
      const curr = currentFrame.data;
      let changedPixels = 0;
      const totalPixels = canvas.width * canvas.height;

      // Compare luminance of each pixel
      for (let i = 0; i < prev.length; i += 4) {
        const prevLum = prev[i] * 0.299 + prev[i + 1] * 0.587 + prev[i + 2] * 0.114;
        const currLum = curr[i] * 0.299 + curr[i + 1] * 0.587 + curr[i + 2] * 0.114;

        if (Math.abs(prevLum - currLum) > 30) {
          changedPixels++;
        }
      }

      const changePercent = (changedPixels / totalPixels) * 100;

      if (changePercent > sensitivity) {
        consecutiveMotionRef.current++;
        // Require 2 consecutive motion frames to avoid false positives
        if (consecutiveMotionRef.current >= 2) {
          consecutiveMotionRef.current = 0;
          onMotionDetected();
        }
      } else {
        consecutiveMotionRef.current = 0;
      }
    }

    prevFrameRef.current = currentFrame;
  }, [sensitivity, onMotionDetected]);

  // Start/stop camera based on enabled prop
  useEffect(() => {
    if (!enabled) {
      // Cleanup
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      prevFrameRef.current = null;
      consecutiveMotionRef.current = 0;
      return;
    }

    // Start camera
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 320 },
            height: { ideal: 240 },
          },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Analyze every 500ms
        intervalRef.current = setInterval(analyzeFrame, 500);
        setCameraAvailable(true);
      } catch (err) {
        console.warn('[MotionDetector] Camera not available:', err);
        setCameraAvailable(false);
      }
    };

    startCamera();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [enabled, analyzeFrame]);

  // Hidden video + canvas for processing only
  return (
    <>
      <video
        ref={videoRef}
        playsInline
        muted
        className="hidden"
        width={320}
        height={240}
      />
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        className="hidden"
      />
      {/* Small camera status indicator */}
      {enabled && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs text-gray-500 z-10">
          <div
            className={`w-2 h-2 rounded-full ${
              cameraAvailable ? 'bg-green-500' : 'bg-gray-600'
            }`}
          />
          {cameraAvailable ? 'Motion detection active' : 'Touch to start'}
        </div>
      )}
    </>
  );
}
