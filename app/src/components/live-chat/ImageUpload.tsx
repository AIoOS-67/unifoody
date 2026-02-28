'use client';

import { useRef, useState } from 'react';

interface ImageUploadProps {
  restaurantId: string;
  sessionId: string;
  onResult: (description: string) => void;
  onImageSend?: (imageData: string, mimeType: string) => void;
}

/**
 * ImageUpload — Camera/file upload for dish identification via Gemini Vision.
 *
 * Sends the image as base64 to the WebSocket or REST endpoint.
 * The server uses Gemini Vision to identify the dish and match it to the menu.
 */
export function ImageUpload({ restaurantId, sessionId, onResult, onImageSend }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Please select an image under 5MB.');
      return;
    }

    setIsUploading(true);

    try {
      // Convert to base64
      const base64 = await fileToBase64(file);

      // Show preview briefly
      setPreview(base64);
      setTimeout(() => setPreview(null), 3000);

      // If WebSocket handler provided, send image data directly
      if (onImageSend) {
        // Extract just the base64 data (remove data:image/jpeg;base64, prefix)
        const pureBase64 = base64.split(',')[1] || base64;
        onImageSend(pureBase64, file.type);
        return;
      }

      // Fallback: send via REST chat endpoint
      const resp = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[Image uploaded: ${file.name}] Please identify this dish and find it on your menu.`,
          restaurant_id: restaurantId,
          session_id: sessionId,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        onResult(data.response || 'I received your photo! Let me check the menu for that dish.');
      } else {
        onResult('I received your photo but had trouble processing it. Could you describe the dish?');
      }
    } catch (err) {
      console.error('[ImageUpload] Error:', err);
      onResult('Failed to upload photo. Please try again or describe the dish.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="relative">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition-colors"
          title="Take photo or upload image of a dish"
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>

        {/* Image preview thumbnail */}
        {preview && (
          <div className="absolute bottom-full mb-2 left-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-orange-500 shadow-lg">
            <img src={preview} alt="Uploading..." className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
