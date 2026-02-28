/**
 * Call Manager for AVOS
 * Manages the complete lifecycle of AVOS calls in Supabase
 * Handles call initialization, status updates, transcript logging, and finalization
 */

import { supabaseAdmin } from '../supabase';
import {
  AVOSCall,
  CallStatus,
  DialogState,
  TranscriptEntry,
  AIEngine,
  mapCallFromDb,
} from './types';

export class CallManager {
  /**
   * Initialize a new call record in the database
   * @returns The created call record
   */
  static async initializeCall(
    restaurantId: string,
    callerPhone: string,
    restaurantPhone: string,
    aiEngine: AIEngine
  ): Promise<AVOSCall> {
    console.log(
      `[AVOS] Initializing call: caller=${callerPhone}, restaurant=${restaurantId}, engine=${aiEngine}`
    );

    try {
      const { data, error } = await supabaseAdmin
        .from('avos_calls')
        .insert({
          restaurant_id: restaurantId,
          caller_phone: callerPhone,
          restaurant_phone: restaurantPhone,
          language: 'en', // Default, will be updated during greeting
          duration_seconds: 0,
          call_status: 'initiated',
          ai_engine: aiEngine,
          dialog_state: 'GREETING',
          transcript: [],
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[AVOS] Failed to initialize call:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from call initialization');
      }

      console.log(`[AVOS] Call initialized: ${data.id}`);
      return mapCallFromDb(data);
    } catch (error) {
      console.error('[AVOS] Call initialization error:', error);
      throw error;
    }
  }

  /**
   * Update call status
   */
  static async updateCallStatus(
    callId: string,
    status: CallStatus,
    dialogState?: DialogState
  ): Promise<void> {
    console.log(`[AVOS] Updating call status: ${callId} -> ${status}`);

    try {
      const updateData: any = {
        call_status: status,
      };

      if (dialogState) {
        updateData.dialog_state = dialogState;
      }

      const { error } = await supabaseAdmin
        .from('avos_calls')
        .update(updateData)
        .eq('id', callId);

      if (error) {
        console.error('[AVOS] Failed to update call status:', error);
        throw error;
      }

      console.log(`[AVOS] Call status updated successfully`);
    } catch (error) {
      console.error('[AVOS] Call status update error:', error);
      throw error;
    }
  }

  /**
   * Append transcript entry to call
   * Appends to the transcript JSONB array
   */
  static async appendTranscript(
    callId: string,
    entry: TranscriptEntry
  ): Promise<void> {
    try {
      // First, fetch the current transcript
      const { data: callData, error: fetchError } = await supabaseAdmin
        .from('avos_calls')
        .select('transcript')
        .eq('id', callId)
        .single();

      if (fetchError) {
        console.error('[AVOS] Failed to fetch current transcript:', fetchError);
        throw fetchError;
      }

      // Append new entry
      const updatedTranscript = [...(callData?.transcript || []), entry];

      const { error: updateError } = await supabaseAdmin
        .from('avos_calls')
        .update({ transcript: updatedTranscript })
        .eq('id', callId);

      if (updateError) {
        console.error('[AVOS] Failed to append transcript:', updateError);
        throw updateError;
      }

      console.log(`[AVOS] Transcript entry appended (role: ${entry.role})`);
    } catch (error) {
      console.error('[AVOS] Append transcript error:', error);
      throw error;
    }
  }

  /**
   * Finalize call when it ends
   */
  static async finalizeCall(
    callId: string,
    endReason: string,
    dialogState?: DialogState,
    orderId?: string
  ): Promise<void> {
    console.log(`[AVOS] Finalizing call: ${callId} (reason: ${endReason})`);

    try {
      const now = new Date();

      // Fetch call to calculate duration
      const { data: callData, error: fetchError } = await supabaseAdmin
        .from('avos_calls')
        .select('started_at')
        .eq('id', callId)
        .single();

      if (fetchError) {
        console.error('[AVOS] Failed to fetch call for finalization:', fetchError);
        throw fetchError;
      }

      const startTime = new Date(callData.started_at);
      const durationSeconds = Math.round((now.getTime() - startTime.getTime()) / 1000);

      const updateData: any = {
        call_status: 'completed',
        ended_at: now.toISOString(),
        duration_seconds: durationSeconds,
      };

      if (dialogState) {
        updateData.dialog_state = dialogState;
      }

      if (orderId) {
        updateData.order_id = orderId;
      }

      const { error: updateError } = await supabaseAdmin
        .from('avos_calls')
        .update(updateData)
        .eq('id', callId);

      if (updateError) {
        console.error('[AVOS] Failed to finalize call:', updateError);
        throw updateError;
      }

      console.log(`[AVOS] Call finalized (duration: ${durationSeconds}s)`);
    } catch (error) {
      console.error('[AVOS] Call finalization error:', error);
      throw error;
    }
  }

  /**
   * Get call by ID
   */
  static async getCallById(callId: string): Promise<AVOSCall | null> {
    console.log(`[AVOS] Fetching call: ${callId}`);

    try {
      const { data, error } = await supabaseAdmin
        .from('avos_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          console.log(`[AVOS] Call not found: ${callId}`);
          return null;
        }
        console.error('[AVOS] Failed to fetch call:', error);
        throw error;
      }

      return mapCallFromDb(data);
    } catch (error) {
      console.error('[AVOS] Get call error:', error);
      throw error;
    }
  }

  /**
   * Get call history for a restaurant
   * Supports pagination and filtering
   */
  static async getCallHistory(
    restaurantId: string,
    filters?: {
      limit?: number;
      offset?: number;
      status?: CallStatus;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ calls: AVOSCall[]; total: number }> {
    console.log(`[AVOS] Fetching call history for restaurant: ${restaurantId}`);

    try {
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      let query = supabaseAdmin
        .from('avos_calls')
        .select('*', { count: 'exact' })
        .eq('restaurant_id', restaurantId);

      // Apply filters
      if (filters?.status) {
        query = query.eq('call_status', filters.status);
      }

      if (filters?.dateFrom) {
        query = query.gte('started_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('started_at', filters.dateTo);
      }

      // Apply pagination
      query = query.order('started_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('[AVOS] Failed to fetch call history:', error);
        throw error;
      }

      const calls = (data || []).map(mapCallFromDb);
      console.log(
        `[AVOS] Call history fetched (${calls.length} of ${count} total)`
      );

      return {
        calls,
        total: count || 0,
      };
    } catch (error) {
      console.error('[AVOS] Get call history error:', error);
      throw error;
    }
  }

  /**
   * Update call language (detected during greeting)
   */
  static async updateCallLanguage(callId: string, language: string): Promise<void> {
    console.log(`[AVOS] Updating call language: ${callId} -> ${language}`);

    try {
      const { error } = await supabaseAdmin
        .from('avos_calls')
        .update({ language })
        .eq('id', callId);

      if (error) {
        console.error('[AVOS] Failed to update call language:', error);
        throw error;
      }
    } catch (error) {
      console.error('[AVOS] Update call language error:', error);
      throw error;
    }
  }

  /**
   * Update final dialog state when call ends
   */
  static async updateFinalDialogState(callId: string, dialogState: DialogState): Promise<void> {
    console.log(`[AVOS] Updating final dialog state: ${callId} -> ${dialogState}`);

    try {
      const { error } = await supabaseAdmin
        .from('avos_calls')
        .update({ dialog_state: dialogState })
        .eq('id', callId);

      if (error) {
        console.error('[AVOS] Failed to update dialog state:', error);
        throw error;
      }
    } catch (error) {
      console.error('[AVOS] Update dialog state error:', error);
      throw error;
    }
  }

  /**
   * Link order to call
   */
  static async linkOrderToCall(callId: string, orderId: string): Promise<void> {
    console.log(`[AVOS] Linking order to call: ${callId} -> ${orderId}`);

    try {
      const { error } = await supabaseAdmin
        .from('avos_calls')
        .update({ order_id: orderId })
        .eq('id', callId);

      if (error) {
        console.error('[AVOS] Failed to link order:', error);
        throw error;
      }
    } catch (error) {
      console.error('[AVOS] Link order error:', error);
      throw error;
    }
  }

  /**
   * Get call statistics for a restaurant
   */
  static async getCallStats(
    restaurantId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    transferredCalls: number;
    totalDuration: number;
    avgDuration: number;
  }> {
    console.log(`[AVOS] Fetching call statistics for restaurant: ${restaurantId}`);

    try {
      let query = supabaseAdmin
        .from('avos_calls')
        .select('call_status, duration_seconds')
        .eq('restaurant_id', restaurantId);

      if (dateFrom) {
        query = query.gte('started_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('started_at', dateTo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AVOS] Failed to fetch call statistics:', error);
        throw error;
      }

      const calls = data || [];
      const totalCalls = calls.length;
      const completedCalls = calls.filter((c) => c.call_status === 'completed').length;
      const failedCalls = calls.filter((c) => c.call_status === 'failed').length;
      const transferredCalls = calls.filter((c) => c.call_status === 'transferred').length;
      const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
      const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

      return {
        totalCalls,
        completedCalls,
        failedCalls,
        transferredCalls,
        totalDuration,
        avgDuration,
      };
    } catch (error) {
      console.error('[AVOS] Get call statistics error:', error);
      throw error;
    }
  }
}
