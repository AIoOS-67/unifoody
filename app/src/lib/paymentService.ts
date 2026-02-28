// lib/paymentService.ts
// 真实的FOODY Coin支付服务

import { parseUnits, formatUnits } from 'viem';
import { writeContract, readContract, waitForTransactionReceipt } from '@wagmi/core';
import { unichain } from '@/lib/chains';
import { saveTransactionRecord, TransactionRecord } from './transactionService';
import { logger } from './logger';
import { saveConfirmPayRecord, ConfirmPayRecord } from './confirmPayService';

// Timeout helper for blockchain calls
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

const RPC_READ_TIMEOUT = 15_000;   // 15s for read calls
const TX_RECEIPT_TIMEOUT = 90_000; // 90s for transaction confirmations

// Base网络上的FOODY合约地址
export const FOODY_CONTRACT_ADDRESS = '0x1022b1b028a2237c440dbac51dc6fc220d88c08f' as `0x${string}`;

// Base网络上的USDC合约地址 (仅用于价格显示)
export const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;

// ERC20 ABI (只包含需要的函数)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const;

export interface PaymentRequest {
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  foodyAmount: number;  // 🔥 改为FOODY数量
  usdcEquivalent: number; // 仅用于显示等值
  orderId: string;
  restaurantId: string;  // 🆕 添加餐厅ID
  restaurantName: string;
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: `0x${string}`;
  error?: string;
  gasUsed?: bigint;
}

/**
 * 检查用户的FOODY余额
 */
export async function checkFoodyBalance(walletAddress: `0x${string}`, config: any): Promise<number> {
  try {
    const balance = await withTimeout(
      readContract(config, {
        address: FOODY_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress],
        chainId: unichain.id,
      }),
      RPC_READ_TIMEOUT,
      'checkFoodyBalance'
    );

    return parseFloat(formatUnits(balance as bigint, 18));
  } catch (error) {
    logger.error('Error checking FOODY balance:', error);
    return 0;
  }
}

/**
 * 检查用户的USDC余额 (仅用于显示)
 */
export async function checkUsdcBalance(walletAddress: `0x${string}`, config: any): Promise<number> {
  try {
    const balance = await withTimeout(
      readContract(config, {
        address: USDC_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress],
        chainId: unichain.id,
      }),
      RPC_READ_TIMEOUT,
      'checkUsdcBalance'
    );

    return parseFloat(formatUnits(balance as bigint, 6));
  } catch (error) {
    logger.error('Error checking USDC balance:', error);
    return 0;
  }
}

/**
 * 执行FOODY支付 🔥 核心支付逻辑
 */
export async function executeFoodyPayment(
  paymentRequest: PaymentRequest,
  config: any // wagmi config
): Promise<PaymentResult> {
  try {
    const { fromAddress, toAddress, foodyAmount, usdcEquivalent, orderId, restaurantId, restaurantName } = paymentRequest;

    // 1. 检查FOODY余额
    const balance = await checkFoodyBalance(fromAddress, config);
    if (balance < foodyAmount) {
      return {
        success: false,
        error: `Insufficient FOODY balance. Required: ${foodyAmount.toLocaleString()} FOODY, Available: ${balance.toLocaleString()} FOODY`
      };
    }

    // 2. 转换金额到wei (FOODY有18位小数)
    const amountInWei = parseUnits(foodyAmount.toString(), 18);

    logger.debug('Executing FOODY payment:', {
      from: fromAddress,
      to: toAddress,
      foodyAmount: foodyAmount.toLocaleString(),
      usdcEquivalent: `$${usdcEquivalent.toFixed(2)}`,
      orderId,
      restaurantId,
    });

    // 3. 执行FOODY转账 🚀
    const hash = await writeContract(config, {
      address: FOODY_CONTRACT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress, amountInWei],
      chainId: unichain.id,
    });

    logger.debug('FOODY transaction submitted:', hash);

    // 4. 等待交易确认 (with timeout protection)
    const receipt = await withTimeout(
      waitForTransactionReceipt(config, {
        hash,
        chainId: unichain.id,
      }),
      TX_RECEIPT_TIMEOUT,
      'waitForTransactionReceipt'
    );

    logger.debug(' FOODY transaction confirmed:', receipt);

    // 5. 🆕 保存交易记录到数据库 - 双重保存
    const transactionRecord: TransactionRecord = {
      diner_wallet: fromAddress,
      restaurant_id: restaurantId,
      restaurant_wallet: toAddress,
      restaurant_name: restaurantName,
      order_id: orderId,
      foody_amount: foodyAmount,
      usdc_equivalent: usdcEquivalent,
      tx_hash: hash,
      gas_used: receipt.gasUsed.toString(),
      payment_method: 'FOODY',
      status: 'completed'
    };

    // 创建食客支付确认记录
    const confirmPayRecord: ConfirmPayRecord = {
      diner_wallet: fromAddress,
      restaurant_id: restaurantId,
      restaurant_name: restaurantName,
      order_id: orderId,
      total_amount: usdcEquivalent,
      foody_amount: foodyAmount,
      tx_hash: hash,
      gas_used: receipt.gasUsed.toString(),
      usdc_equivalent: usdcEquivalent,
      payment_method: 'FOODY'
    };

    logger.debug('Saving records to both tables...');
    
    // 同时保存到两个表
    const [saveResult, confirmResult] = await Promise.all([
      saveTransactionRecord(transactionRecord),
      saveConfirmPayRecord(confirmPayRecord)
    ]);

    if (saveResult) {
      logger.debug('Transaction record saved to orders table');
    } else {
      logger.warn(' Failed to save to orders table');
    }

    if (confirmResult) {
      logger.debug('Payment confirmation saved to confirm_and_pay table');
    } else {
      logger.warn(' Failed to save to confirm_and_pay table');
    }

    return {
      success: true,
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
    };

  } catch (error: any) {
    logger.error(' FOODY payment failed:', error);
    
    // 处理常见错误
    let errorMessage = 'FOODY payment failed. Please try again.';
    
    if (error.message?.includes('User rejected')) {
      errorMessage = 'Payment cancelled by user.';
    } else if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Insufficient FOODY or gas for transaction.';
    } else if (error.message?.includes('gas')) {
      errorMessage = 'Transaction failed due to gas issues.';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * 格式化交易哈希用于显示
 */
export function formatTransactionHash(hash: string): string {
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/**
 * 获取Base网络上的交易查看链接
 */
export function getTransactionUrl(hash: string): string {
  return `https://uniscan.xyz/tx/${hash}`;
}
