/**
 * FoodyePay AVOS (AI Voice Ordering System)
 * Comprehensive TypeScript type definitions for voice call management,
 * order processing, and AI configuration.
 *
 * Supports: English, Mandarin Chinese, Cantonese, Spanish
 * AI Engines: Google Gemini 2.0, Amazon Nova Sonic
 */

// ============================================================================
// LANGUAGE AND ENGINE TYPES
// ============================================================================

/**
 * Supported languages for AVOS system
 * - en: English
 * - zh: Mandarin Chinese
 * - yue: Cantonese
 * - es: Spanish
 */
export type SupportedLanguage = 'en' | 'zh' | 'yue' | 'es';

/**
 * Available AI engines for voice processing
 * - google_gemini_2: Google Gemini 2.0 (primary)
 * - amazon_nova_sonic: Amazon Nova Sonic (fallback)
 */
export type AIEngine = 'google_gemini_2' | 'amazon_nova_sonic';

// ============================================================================
// DIALOG STATE MACHINE
// ============================================================================

/**
 * Dialog states from AVOS patent FSM
 * Represents the conversation flow states for voice ordering
 */
export type DialogState =
  | 'GREETING'           // Initial greeting and language detection
  | 'LANGUAGE_SELECT'    // User selects preferred language
  | 'TAKING_ORDER'       // Customer orders items
  | 'ITEM_CUSTOMIZATION' // Customer specifies modifications
  | 'UPSELLING'          // AI suggests additional items
  | 'ORDER_REVIEW'       // Summarize order for confirmation
  | 'CUSTOMER_INFO'      // Collect phone/delivery address
  | 'PAYMENT'            // Payment processing
  | 'CONFIRMATION'       // Final confirmation and receipt
  | 'CLOSING'            // Call closing and thank you
  | 'TRANSFER_TO_HUMAN'  // Transfer to human agent
  | 'ERROR_RECOVERY';    // Error handling and recovery

// ============================================================================
// CALL AND ORDER STATUS TYPES
// ============================================================================

/**
 * Call lifecycle status
 */
export type CallStatus =
  | 'initiated'    // Call started but not yet connected
  | 'connected'    // Call connected to system
  | 'in_progress'  // Conversation in progress
  | 'completed'    // Call ended normally
  | 'failed'       // Call failed or disconnected
  | 'transferred'; // Transferred to human agent

/**
 * Payment status for AVOS orders
 */
export type AVOSPaymentStatus =
  | 'pending'    // Payment link/SMS sent
  | 'sent'       // Payment notification sent to customer
  | 'completed'  // Payment received and confirmed
  | 'expired'    // Payment link expired
  | 'failed';    // Payment failed

// ============================================================================
// TRANSCRIPT AND CONVERSATION
// ============================================================================

/**
 * Single transcript entry from conversation
 */
export interface TranscriptEntry {
  role: 'ai' | 'customer';
  text: string;
  language: SupportedLanguage;
  timestamp: string; // ISO 8601 format
  confidence?: number; // 0-1, speech recognition confidence
}

// ============================================================================
// AVOS CALL RECORD
// ============================================================================

/**
 * Complete AVOS call record with metadata and transcript
 */
export interface AVOSCall {
  id: string; // UUID
  restaurantId: string; // UUID
  callerPhone: string; // E.164 format
  restaurantPhone: string; // E.164 format
  language: SupportedLanguage;
  durationSeconds: number; // Total call duration
  callStatus: CallStatus;
  callRecordingUrl?: string; // Storage URL if recording enabled
  transcript: TranscriptEntry[]; // Full conversation history
  aiEngine: AIEngine; // Which engine processed this call
  dialogState: DialogState; // Final state when call ended
  orderId?: string; // UUID, linked order if created
  startedAt: string; // ISO 8601
  endedAt?: string; // ISO 8601
  createdAt: string; // ISO 8601
}

// ============================================================================
// ORDER ITEMS AND DETAILS
// ============================================================================

/**
 * Item ordered during voice call
 */
export interface AVOSOrderItem {
  menuItemId: string; // UUID
  name: string; // Display name
  quantity: number;
  priceUsd: number; // Per-unit price
  modifications: string[]; // e.g., ["no MSG", "extra spicy", "light soy sauce"]
}

/**
 * Complete AVOS order record with payment details
 */
export interface AVOSOrder {
  id: string; // UUID
  callId: string; // UUID, reference to avos_calls
  restaurantId: string; // UUID
  customerPhone: string; // E.164 format
  items: AVOSOrderItem[]; // Line items
  subtotalUsd: number; // Sum of item prices
  taxUsd: number; // Calculated tax
  totalUsd: number; // subtotal + tax
  foodyAmount: number; // Amount in Foody token (8 decimals)
  exchangeRate: number; // USD to Foody conversion rate at order time
  paymentMethod: 'foody_wallet' | 'sms_link'; // Payment channel
  paymentLink?: string; // SMS or wallet link sent to customer
  paymentToken?: string; // Unique payment identifier (min 32 chars)
  paymentStatus: AVOSPaymentStatus;
  txHash?: string; // Blockchain transaction hash if completed
  orderId?: string; // UUID, link to main orders table
  confirmedAt?: string; // ISO 8601, when customer confirmed payment
  createdAt: string; // ISO 8601
}

// ============================================================================
// RESTAURANT CONFIGURATION
// ============================================================================

/**
 * AVOS configuration and feature settings per restaurant
 */
export interface AVOSConfig {
  id: string; // UUID
  restaurantId: string; // UUID, one-to-one relationship
  avosEnabled: boolean; // Master feature toggle
  phoneNumber?: string; // E.164 format, phone number for incoming calls
  primaryLanguage: SupportedLanguage; // Default language
  supportedLanguages: SupportedLanguage[]; // Enabled languages
  aiEngine: AIEngine; // Primary AI engine to use
  greetingMessage: Record<SupportedLanguage, string>; // Localized greetings
  maxCallDurationSeconds: number; // Hard limit on call length
  enableRecording: boolean; // Record call audio
  enableUpselling: boolean; // Suggest additional items
  autoPaymentEnabled: boolean; // Auto-send payment link without confirmation
  smsPaymentEnabled: boolean; // Allow SMS payment links
  transferToHumanPhone?: string; // E.164 format, fallback phone for human agent
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ============================================================================
// MENU INDEXING AND MATCHING
// ============================================================================

/**
 * Menu item entry in search index
 * Optimized for fast matching and fuzzy search
 */
export interface AVOSMenuIndexEntry {
  id: string; // UUID
  restaurantId: string; // UUID
  menuItemId: string; // UUID, reference to main menu_items table
  itemName: string; // Primary name (English or default)
  itemNameZh?: string; // Simplified/Traditional Chinese
  itemNameYue?: string; // Cantonese
  itemNameEs?: string; // Spanish
  aliases: string[]; // Alternative names and nicknames
  phoneticEn?: string; // English phonetic (if applicable)
  phoneticZh?: string; // Pinyin (Mandarin romanization)
  phoneticYue?: string; // Jyutping (Cantonese romanization)
  category: string; // Menu category
  priceUsd: number; // Current price
  isAvailable: boolean; // Availability flag
}

/**
 * Menu search result with confidence score
 */
export interface MenuMatch {
  menuItemId: string; // UUID
  itemName: string; // Matched item name
  matchedQuery: string; // Original search query
  confidence: number; // 0-1 confidence score
  matchType: 'exact' | 'alias' | 'fuzzy' | 'phonetic';
  priceUsd: number;
  category: string;
  isAvailable: boolean;
}

// ============================================================================
// DIALOG CONTEXT
// ============================================================================

/**
 * Dialog context maintained across conversation turns
 * State machine information and conversation history
 */
export interface DialogContext {
  callId: string; // UUID
  restaurantId: string; // UUID
  currentState: DialogState;
  language: SupportedLanguage;
  orderItems: AVOSOrderItem[]; // Items being accumulated
  customerPhone: string; // E.164 format
  subtotalUsd: number; // Running total
  conversationHistory: TranscriptEntry[]; // All turns so far
  errorCount: number; // Consecutive errors
  maxErrors: number; // Threshold before human transfer (default: 3)
  upsellOffered: boolean; // Whether upsell has been presented
  orderConfirmed: boolean; // Customer confirmed order
  paymentInitiated: boolean; // Payment flow started
  metadata: Record<string, any>; // Extension point for custom data
}

// ============================================================================
// VOICE AI PROVIDER INTERFACE
// ============================================================================

/**
 * Transcription result from speech-to-text
 */
export interface TranscriptionResult {
  text: string;
  language: SupportedLanguage;
  confidence: number; // 0-1
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
}

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number; // 0-1
}

/**
 * Abstract voice AI provider interface
 * Implementations support Google Gemini 2.0, Amazon Nova Sonic, etc.
 */
export interface VoiceAIProvider {
  name: string;
  engine: AIEngine;

  /**
   * Convert speech audio to text
   */
  transcribe(
    audioBuffer: Buffer,
    language: SupportedLanguage
  ): Promise<TranscriptionResult>;

  /**
   * Convert text to speech audio
   */
  synthesize(text: string, language: SupportedLanguage): Promise<Buffer>;

  /**
   * Detect language from audio
   */
  detectLanguage(audioBuffer: Buffer): Promise<LanguageDetectionResult>;

  /**
   * Natural Language Understanding: extract intent and entities
   */
  analyzeIntent(text: string, context: DialogContext): Promise<IntentResult>;

  /**
   * Generate AI response text
   */
  generateResponse(
    context: DialogContext,
    intent: IntentResult
  ): Promise<string>;
}

// ============================================================================
// NLU (NATURAL LANGUAGE UNDERSTANDING)
// ============================================================================

/**
 * Intent classification for user utterances
 */
export type OrderIntent =
  | 'ORDER_ITEM'          // Customer ordering something
  | 'REMOVE_ITEM'         // Remove item from order
  | 'MODIFY_ITEM'         // Modify item (size, sauce, etc.)
  | 'ASK_QUESTION'        // Question about menu or restaurant
  | 'CONFIRM'             // Affirmative confirmation
  | 'DENY'                // Negative response
  | 'REPEAT'              // Ask to repeat
  | 'CANCEL_ORDER'        // Cancel entire order
  | 'CHECK_TOTAL'         // Ask for price/total
  | 'SWITCH_LANGUAGE'     // Change language
  | 'SPEAK_TO_HUMAN'      // Request human agent
  | 'READY_TO_PAY'        // Proceed to payment
  | 'UNKNOWN';            // Could not classify

/**
 * Result of NLU intent analysis
 */
export interface IntentResult {
  intent: OrderIntent;
  confidence: number; // 0-1
  entities: {
    menuItems?: Array<{
      name: string;
      quantity: number;
      modifications?: string[];
    }>;
    language?: SupportedLanguage;
    confirmation?: boolean;
  };
  rawText: string; // Original user input
}

// ============================================================================
// WEBHOOK AND API EVENTS
// ============================================================================

/**
 * Event types from CCAI or voice platform webhooks
 */
export type CCAIEventType =
  | 'call_initiated'      // Incoming call detected
  | 'call_connected'      // Call connected to AI
  | 'transcript_update'   // New transcript segments
  | 'intent_detected'     // NLU intent identified
  | 'call_ended'          // Call disconnected normally
  | 'call_failed'         // Call failed or error
  | 'dtmf_received';      // DTMF digits pressed

/**
 * Webhook event payload from voice platform
 */
export interface CCAIWebhookEvent {
  eventType: CCAIEventType;
  callId: string;
  sessionId: string;
  timestamp: string; // ISO 8601
  data: {
    callerPhone?: string; // E.164
    calledPhone?: string; // E.164
    transcript?: string; // Latest transcript segment
    language?: string; // Detected language code
    intent?: string; // Detected intent
    confidence?: number; // Confidence 0-1
    duration?: number; // Duration in seconds
    endReason?: string; // Reason for call end
    dtmfDigits?: string; // DTMF string pressed
  };
}

// ============================================================================
// PAYMENT AND SMS FLOW
// ============================================================================

/**
 * Payload for SMS payment link (JWT-encoded)
 * Contains order details and restaurant wallet address
 */
export interface PaymentLinkPayload {
  callId: string; // UUID
  orderId: string; // UUID
  restaurantId: string; // UUID
  restaurantName: string;
  restaurantWallet: string; // Ethereum/blockchain address
  items: AVOSOrderItem[];
  subtotalUsd: number;
  taxUsd: number;
  totalUsd: number;
  foodyAmount: number;
  exchangeRate: number;
  customerPhone: string; // E.164
  expiresAt: number; // Unix timestamp (seconds)
}

// ============================================================================
// DATABASE MAPPING HELPERS
// ============================================================================

/**
 * Map database row (snake_case) to AVOSCall (camelCase)
 * Helper for converting Supabase query results
 */
export function mapCallFromDb(row: any): AVOSCall {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    callerPhone: row.caller_phone,
    restaurantPhone: row.restaurant_phone,
    language: row.language,
    durationSeconds: row.duration_seconds,
    callStatus: row.call_status,
    callRecordingUrl: row.call_recording_url,
    transcript: row.transcript || [],
    aiEngine: row.ai_engine,
    dialogState: row.dialog_state,
    orderId: row.order_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

/**
 * Map database row (snake_case) to AVOSOrder (camelCase)
 */
export function mapOrderFromDb(row: any): AVOSOrder {
  return {
    id: row.id,
    callId: row.call_id,
    restaurantId: row.restaurant_id,
    customerPhone: row.customer_phone,
    items: row.items || [],
    subtotalUsd: parseFloat(row.subtotal_usd),
    taxUsd: parseFloat(row.tax_usd),
    totalUsd: parseFloat(row.total_usd),
    foodyAmount: parseFloat(row.foody_amount),
    exchangeRate: parseFloat(row.exchange_rate),
    paymentMethod: row.payment_method,
    paymentLink: row.payment_link,
    paymentToken: row.payment_token,
    paymentStatus: row.payment_status,
    txHash: row.tx_hash,
    orderId: row.order_id,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  };
}

/**
 * Map database row (snake_case) to AVOSConfig (camelCase)
 */
export function mapConfigFromDb(row: any): AVOSConfig {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    avosEnabled: row.avos_enabled,
    phoneNumber: row.phone_number,
    primaryLanguage: row.primary_language,
    supportedLanguages: row.supported_languages || ['en'],
    aiEngine: row.ai_engine,
    greetingMessage: row.greeting_message || {},
    maxCallDurationSeconds: row.max_call_duration_seconds,
    enableRecording: row.enable_recording,
    enableUpselling: row.enable_upselling,
    autoPaymentEnabled: row.auto_payment_enabled,
    smsPaymentEnabled: row.sms_payment_enabled,
    transferToHumanPhone: row.transfer_to_human_phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row (snake_case) to AVOSMenuIndexEntry (camelCase)
 */
export function mapMenuIndexFromDb(row: any): AVOSMenuIndexEntry {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    menuItemId: row.menu_item_id,
    itemName: row.item_name,
    itemNameZh: row.item_name_zh,
    itemNameYue: row.item_name_yue,
    itemNameEs: row.item_name_es,
    aliases: row.aliases || [],
    phoneticEn: row.phonetic_en,
    phoneticZh: row.phonetic_zh,
    phoneticYue: row.phonetic_yue,
    category: row.category,
    priceUsd: parseFloat(row.price_usd),
    isAvailable: row.is_available,
  };
}

// ============================================================================
// VALIDATION AND UTILITY TYPES
// ============================================================================

/**
 * Validator for E.164 phone format
 */
export const isValidE164Phone = (phone: string): boolean => {
  return /^\+?[1-9]\d{1,14}$/.test(phone);
};

/**
 * Validator for UUID format
 */
export const isValidUUID = (id: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
};

/**
 * Type guard for SupportedLanguage
 */
export const isSupportedLanguage = (value: any): value is SupportedLanguage => {
  return ['en', 'zh', 'yue', 'es'].includes(value);
};

/**
 * Type guard for AIEngine
 */
export const isAIEngine = (value: any): value is AIEngine => {
  return ['google_gemini_2', 'amazon_nova_sonic'].includes(value);
};

/**
 * Type guard for DialogState
 */
export const isDialogState = (value: any): value is DialogState => {
  return [
    'GREETING',
    'LANGUAGE_SELECT',
    'TAKING_ORDER',
    'ITEM_CUSTOMIZATION',
    'UPSELLING',
    'ORDER_REVIEW',
    'CUSTOMER_INFO',
    'PAYMENT',
    'CONFIRMATION',
    'CLOSING',
    'TRANSFER_TO_HUMAN',
    'ERROR_RECOVERY',
  ].includes(value);
};
