'use client';

import { useState, useRef, useEffect } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function QRScanner({ onScan, onError, isOpen, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const codeReader = new BrowserQRCodeReader();

  useEffect(() => {
    if (isOpen && videoRef.current) {
      startScanning(videoRef.current);
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startScanning = async (videoEl: HTMLVideoElement) => {
    try {
      console.log('Attempting to start scanner...');
      const videoInputDevices = await BrowserQRCodeReader.listVideoInputDevices();
      console.log('Available video devices:', videoInputDevices);

      if (videoInputDevices.length === 0) {
        throw new Error('No video input devices found.');
      }

      // Use the first available device
      const deviceId = videoInputDevices[0].deviceId;
      console.log(`Using deviceId: ${deviceId}`);

      controlsRef.current = await codeReader.decodeFromVideoDevice(
        deviceId,
        videoEl,
        (result, error, controls) => {
          if (result) {
            console.log('QR Code detected:', result.getText());
            controls.stop();
            controlsRef.current = null;
            onScan(result.getText());
            onClose();
          }
          if (error && error.name !== 'NotFoundException') {
            console.error('QR scan error:', error);
            if (onError) {
              onError(error);
            }
          }
        }
      );
      console.log('Scanner started successfully.');
      
      // Explicitly play the video element
      if (videoEl) {
        videoEl.play().catch(e => console.error("Video play failed:", e));
      }

    } catch (err) {
      console.error('Failed to start scanning:', err);
      if (onError) {
        onError(err as Error);
      }
      // Optionally close the modal on error or show a message
      // onClose(); 
    }
  };

  const stopScanning = () => {
    if (controlsRef.current) {
      console.log('Stopping scanner...');
      controlsRef.current.stop();
      controlsRef.current = null;
    }
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Scan Restaurant QR Code
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        
        <div className="relative bg-black">
          <video
            ref={videoRef}
            playsInline // This can help with playback on different devices
            className="w-full h-auto"
            style={{ transform: 'scaleX(-1)' }} // Mirror the video for a more natural "selfie" view
          />
          {/* The visual scanning line */}
          <div className="scanner-line"></div>
          <div className="absolute inset-0 border-4 border-green-500 opacity-50"></div>
        </div>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
          Point your camera at the restaurant&apos;s payment QR code
        </p>
        <div className="text-center mt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
