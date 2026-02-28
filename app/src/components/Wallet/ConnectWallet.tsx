'use client';

import { useFoodyeWallet } from './WalletProvider';
import { ConnectWallet as OnchainConnectWallet, Wallet, WalletDropdown, WalletDropdownLink, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity, EthBalance } from '@coinbase/onchainkit/identity';

type Props = {
  disabled?: boolean;
};

export default function ConnectWallet({ disabled }: Props) {
  const { walletAddress, isConnected, isConnecting } = useFoodyeWallet();

  if (isConnected && walletAddress) {
    return (
      <div className="w-full">
        <Wallet>
          <div className="bg-zinc-900 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Identity
                  address={walletAddress as `0x${string}`}
                  schemaId="0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9"
                >
                  <Avatar className="w-8 h-8" />
                  <Name className="text-white font-medium" />
                </Identity>
              </div>

              <WalletDropdown>
                <div className="bg-zinc-800 rounded-lg p-2 border border-zinc-700">
                  <WalletDropdownLink
                    icon="wallet"
                    href="https://wallet.coinbase.com"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open Wallet
                  </WalletDropdownLink>
                  <WalletDropdownDisconnect className="text-red-400 hover:text-red-300" />
                </div>
              </WalletDropdown>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 mb-1">Address</p>
                <Address
                  address={walletAddress as `0x${string}`}
                  className="font-mono text-xs text-green-400"
                />
              </div>
              <div>
                <p className="text-gray-400 mb-1">Balance</p>
                <EthBalance
                  address={walletAddress as `0x${string}`}
                  className="text-blue-400 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-center">
              <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                Coinbase Smart Wallet
              </span>
            </div>
          </div>
        </Wallet>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Wallet>
        <OnchainConnectWallet
          disconnectedLabel="Create Coinbase Smart Wallet"
          className={`
            w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200
            ${disabled || isConnecting
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
            }
          `}
        >
          {isConnecting ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Connecting...</span>
            </div>
          ) : (
            'Create Coinbase Smart Wallet'
          )}
        </OnchainConnectWallet>
      </Wallet>

      <div className="text-center">
        <p className="text-sm text-gray-400">
          Create a free Coinbase Smart Wallet to get started
        </p>
      </div>
    </div>
  );
}
