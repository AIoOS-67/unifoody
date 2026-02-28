'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import Image from 'next/image';

interface NFCTag {
  tableNumber: string;
  url: string;
  qrDataUrl?: string;
}

interface NFCTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
}

export function NFCTagManager({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
}: NFCTagManagerProps) {
  const { t } = useTranslation('payment');
  const [tags, setTags] = useState<NFCTag[]>([]);
  const [tableCount, setTableCount] = useState<string>('10');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [nfcSupported, setNfcSupported] = useState(false);
  const [writingNFC, setWritingNFC] = useState<string | null>(null);
  const [nfcStatus, setNfcStatus] = useState<string>('');
  const [generated, setGenerated] = useState(false);

  // Check NFC support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setNfcSupported(true);
    }
  }, []);

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://foodyepay.com';
  };

  const buildPaymentUrl = (tableNumber: string) => {
    const base = getBaseUrl();
    let url = `${base}/pay/${restaurantId}?table=${encodeURIComponent(tableNumber)}&source=nfc`;
    if (customAmount && parseFloat(customAmount) > 0) {
      url += `&amount=${customAmount}`;
    }
    return url;
  };

  const generateTags = async () => {
    const count = parseInt(tableCount) || 10;
    const newTags: NFCTag[] = [];

    for (let i = 1; i <= count; i++) {
      const tableNum = `${i}`;
      const url = buildPaymentUrl(tableNum);

      try {
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
        });
        newTags.push({ tableNumber: tableNum, url, qrDataUrl });
      } catch {
        newTags.push({ tableNumber: tableNum, url });
      }
    }

    setTags(newTags);
    setGenerated(true);
  };

  const writeNFCTag = async (tag: NFCTag) => {
    if (!nfcSupported) return;

    setWritingNFC(tag.tableNumber);
    setNfcStatus(t('nfcHold', 'Hold NFC tag near your device...'));

    try {
      // @ts-ignore - Web NFC API types
      const writer = new NDEFReader();
      await writer.write({
        records: [
          {
            recordType: 'url',
            data: tag.url,
          },
        ],
      });
      setNfcStatus(t('nfcSuccess', '✅ NFC tag written successfully!'));
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setNfcStatus(t('nfcPermissionDenied', '❌ NFC permission denied. Please allow NFC access.'));
      } else if (err.name === 'NotSupportedError') {
        setNfcStatus(t('nfcNotSupported', '❌ NFC not supported on this device.'));
      } else {
        setNfcStatus(t('nfcError', '❌ Failed to write NFC tag: {{error}}', { error: err.message }));
      }
    } finally {
      setTimeout(() => {
        setWritingNFC(null);
        setNfcStatus('');
      }, 3000);
    }
  };

  const downloadQR = (tag: NFCTag) => {
    if (!tag.qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `foodyepay-table-${tag.tableNumber}-qr.png`;
    link.href = tag.qrDataUrl;
    link.click();
  };

  const downloadAllQRs = async () => {
    for (const tag of tags) {
      if (tag.qrDataUrl) {
        const link = document.createElement('a');
        link.download = `foodyepay-table-${tag.tableNumber}-qr.png`;
        link.href = tag.qrDataUrl;
        link.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h2 className="text-white font-bold text-lg">
              📶 {t('nfcTagManager', 'NFC Tag Manager')}
            </h2>
            <p className="text-gray-400 text-sm">{restaurantName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-400 text-sm font-medium">
              💡 {t('nfcInfo', 'NFC tags let customers tap their phone on the table to open the payment page instantly.')}
            </p>
            <p className="text-blue-300/60 text-xs mt-1">
              {t('nfcCompat', 'Works with all smartphones. QR codes are generated as backup.')}
            </p>
          </div>

          {/* Configuration */}
          {!generated && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">
                    {t('numberOfTables', 'Number of Tables')}
                  </label>
                  <input
                    type="number"
                    value={tableCount}
                    onChange={(e) => setTableCount(e.target.value)}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">
                    {t('fixedAmount', 'Fixed Amount (optional)')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full pl-7 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={generateTags}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition"
              >
                {t('generateTags', 'Generate NFC Tags & QR Codes')}
              </button>
            </div>
          )}

          {/* Generated Tags */}
          {generated && (
            <>
              {/* Actions Bar */}
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm">
                  {t('tagsGenerated', '{{count}} tags generated', { count: tags.length })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={downloadAllQRs}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg transition"
                  >
                    📥 {t('downloadAll', 'Download All QR')}
                  </button>
                  <button
                    onClick={() => {
                      setGenerated(false);
                      setTags([]);
                    }}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg transition"
                  >
                    🔄 {t('regenerate', 'Regenerate')}
                  </button>
                </div>
              </div>

              {/* NFC Status */}
              {nfcStatus && (
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <p className="text-sm text-white">{nfcStatus}</p>
                </div>
              )}

              {/* Tag Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tags.map((tag) => (
                  <div
                    key={tag.tableNumber}
                    className="bg-zinc-800 rounded-xl border border-zinc-700 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold text-sm">
                        🍽️ {t('table', 'Table')} {tag.tableNumber}
                      </span>
                      <div className="flex gap-1">
                        {nfcSupported && (
                          <button
                            onClick={() => writeNFCTag(tag)}
                            disabled={writingNFC !== null}
                            className={`px-2 py-1 text-xs rounded transition ${
                              writingNFC === tag.tableNumber
                                ? 'bg-blue-500 text-white animate-pulse'
                                : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                            }`}
                          >
                            📶 NFC
                          </button>
                        )}
                        <button
                          onClick={() => downloadQR(tag)}
                          className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition"
                        >
                          📥 QR
                        </button>
                        <button
                          onClick={() => copyUrl(tag.url)}
                          className="px-2 py-1 text-xs bg-zinc-700 text-gray-300 rounded hover:bg-zinc-600 transition"
                        >
                          📋
                        </button>
                      </div>
                    </div>

                    {/* QR Preview */}
                    {tag.qrDataUrl && (
                      <div className="flex justify-center">
                        <Image
                          src={tag.qrDataUrl}
                          alt={`Table ${tag.tableNumber} QR`}
                          width={120}
                          height={120}
                          className="rounded-lg"
                        />
                      </div>
                    )}

                    {/* URL Preview */}
                    <p className="text-gray-500 text-[10px] break-all">{tag.url}</p>
                  </div>
                ))}
              </div>

              {/* NFC Writing Instructions */}
              {nfcSupported && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-green-400 text-sm font-medium">
                    ✅ {t('nfcAvailable', 'Web NFC is available on this device!')}
                  </p>
                  <p className="text-green-300/60 text-xs mt-1">
                    {t('nfcInstructions', 'Click the NFC button on each tag, then hold a blank NFC sticker near your phone to program it.')}
                  </p>
                </div>
              )}

              {!nfcSupported && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm font-medium">
                    📱 {t('nfcNotAvailableTitle', 'NFC Writing Not Available')}
                  </p>
                  <p className="text-yellow-300/60 text-xs mt-1">
                    {t('nfcNotAvailableDesc', 'Web NFC requires Chrome on Android. Use a dedicated NFC writer app (like NFC Tools) to write the URLs above to your NFC tags. QR codes work as a universal alternative.')}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
