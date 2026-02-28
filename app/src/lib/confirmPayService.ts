import { logger } from './logger';
// lib/confirmPayService.ts
// 专门处理食客支付确认记录的服务

import { supabase } from './supabase';

export interface ConfirmPayRecord {
  diner_wallet: string;
  restaurant_id: string;
  restaurant_name: string;
  order_id: string;
  total_amount: number;
  foody_amount: number;
  tx_hash: string;
  gas_used?: string;
  usdc_equivalent: number;
  payment_method: 'FOODY';
}

/**
 * 保存食客支付确认记录到 confirm_and_pay 表
 */
export async function saveConfirmPayRecord(record: ConfirmPayRecord): Promise<boolean> {
  try {
    logger.debug('saveConfirmPayRecord called with:', JSON.stringify(record, null, 2));

    // 1. 通过钱包地址查找 diner 的 UUID
    logger.debug('Looking up diner UUID for wallet:', record.diner_wallet);
    
    const { data: dinerData, error: dinerError } = await supabase
      .from('diners')
      .select('id')
      .eq('wallet_address', record.diner_wallet)
      .single();

    let dinerId: string;

    if (dinerError || !dinerData) {
      logger.error(' Failed to find diner for wallet:', record.diner_wallet, dinerError);
      
      // Auto-create diner record to avoid payment failure
      logger.debug('Auto-creating diner record for confirm_and_pay...');
      const { data: newDiner, error: createError } = await supabase
        .from('diners')
        .insert({
          wallet_address: record.diner_wallet,
          role: 'diner',
          source: 'auto_payment'
        })
        .select('id')
        .single();

      if (createError || !newDiner) {
        logger.error(' Failed to create auto-diner:', createError);
        return false;
      }

      logger.debug(`Auto-created diner: ${newDiner.id} for wallet: ${record.diner_wallet}`);
      dinerId = newDiner.id;
    } else {
      dinerId = dinerData.id;
      logger.debug(`Found diner UUID: ${dinerId} for wallet: ${record.diner_wallet}`);
    }

    // 2. 插入到 confirm_and_pay 表
    const confirmPayData = {
      diner_id: dinerId,
      restaurant_id: record.restaurant_id,
      restaurant_name: record.restaurant_name,
      order_id: record.order_id,
      total_amount: record.total_amount,
      foody_amount: record.foody_amount,
      tx_hash: record.tx_hash,
      gas_used: record.gas_used,
      usdc_equivalent: record.usdc_equivalent,
      payment_method: record.payment_method,
      status: 'paid', // 只有 paid 状态
      payment_confirmed_at: new Date().toISOString()
    };

    logger.debug('Inserting confirm_and_pay record:', confirmPayData);

    const { data: insertData, error: insertError } = await supabase
      .from('confirm_and_pay')
      .insert(confirmPayData)
      .select();

    if (insertError) {
      logger.error(' Failed to insert confirm_and_pay record:', insertError);
      return false;
    }

    logger.debug(' Successfully saved confirm_and_pay record:', insertData);
    return true;

  } catch (error) {
    logger.error(' Error in saveConfirmPayRecord:', error);
    return false;
  }
}

/**
 * 获取食客的支付确认记录
 */
export async function getDinerPaymentHistory(walletAddress: string, limit: number = 20) {
  try {
    logger.debug('Getting payment history for wallet:', walletAddress);

    // 1. 先获取 diner UUID
    const { data: dinerData, error: dinerError } = await supabase
      .from('diners')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single();

    if (dinerError || !dinerData) {
      logger.error(' Failed to find diner for wallet:', walletAddress, dinerError);
      return [];
    }

    // 2. 查询 confirm_and_pay 表
    const { data, error } = await supabase
      .from('confirm_and_pay')
      .select('*')
      .eq('diner_id', dinerData.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(' Error fetching payment history:', error);
      return [];
    }

    logger.debug(' Payment history fetched:', data);
    return data || [];

  } catch (error) {
    logger.error(' Error in getDinerPaymentHistory:', error);
    return [];
  }
}

/**
 * 根据 diner UUID 获取支付记录
 */
export async function getPaymentsByDiner(dinerUuid: string, limit: number = 20) {
  try {
    logger.debug('Getting payments for diner UUID:', dinerUuid);

    // 查询 confirm_and_pay 表，包含 diner 信息
    const { data, error } = await supabase
      .from('confirm_and_pay')
      .select(`
        *,
        diners:diner_id (
          first_name,
          phone
        )
      `)
      .eq('diner_id', dinerUuid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(' Error fetching payments by diner:', error);
      return [];
    }

    // 格式化数据以匹配 TransactionRecord 接口
    const formattedData = (data || []).map(record => ({
      id: record.id,
      first_name: record.diners?.first_name || 'Unknown',
      phone: record.diners?.phone || 'Unknown',
      foody_amount: record.foody_amount,
      created_at: record.created_at,
      status: record.status
    }));

    logger.debug(' Formatted payments:', formattedData);
    return formattedData;

  } catch (error) {
    logger.error(' Error in getPaymentsByDiner:', error);
    return [];
  }
}

// 导出服务对象
export const confirmPayService = {
  saveConfirmPayRecord,
  getDinerPaymentHistory,
  getPaymentsByDiner
};
