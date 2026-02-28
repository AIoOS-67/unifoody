// /src/lib/getPublicClient.ts
import { createPublicClient, http } from 'viem'
import { unichain, unichainSepolia } from './chains'

const isTestnet = process.env.NEXT_PUBLIC_CHAIN_MODE === 'testnet'

export function getPublicClient() {
  return createPublicClient({
    chain: isTestnet ? unichainSepolia : unichain,
    transport: http(
      isTestnet
        ? (process.env.NEXT_PUBLIC_UNICHAIN_RPC_URL || 'https://sepolia.unichain.org')
        : (process.env.NEXT_PUBLIC_UNICHAIN_RPC_URL || 'https://mainnet.unichain.org')
    ),
  })
}

export default getPublicClient
