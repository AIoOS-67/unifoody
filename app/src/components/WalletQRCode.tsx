import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface WalletQRCodeProps {
  walletAddress: string;
  size?: number;
}

export const WalletQRCode: React.FC<WalletQRCodeProps> = ({ 
  walletAddress, 
  size = 200 
}) => {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');

  useEffect(() => {
    const generateQR = async () => {
      try {
        const dataURL = await QRCode.toDataURL(walletAddress, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeDataURL(dataURL);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    if (walletAddress) {
      generateQR();
    }
  }, [walletAddress, size]);

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="bg-white p-4 rounded-lg">
        {qrCodeDataURL && (
          <img 
            src={qrCodeDataURL} 
            alt="Wallet QR Code" 
            className="block"
          />
        )}
      </div>
      <p className="text-xs text-gray-400 font-mono break-all text-center max-w-[200px]">
        {walletAddress}
      </p>
    </div>
  );
};
