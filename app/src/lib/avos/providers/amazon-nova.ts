/**
 * Amazon Nova Sonic voice AI provider implementation (DISABLED)
 * This provider requires AWS SDK which is not installed.
 * Use Google Gemini provider instead.
 * To re-enable: install @aws-sdk/client-bedrock-runtime and restore the original code.
 */

import {
  TranscriptionResult,
  LanguageDetectionResult,
  DialogContext,
  IntentResult,
  AVOSMenuIndexEntry,
  SupportedLanguage,
  AIEngine,
} from '../types';
import { BaseVoiceAIProvider } from './base';

export class AmazonNovaProvider extends BaseVoiceAIProvider {
  name = 'Amazon Nova Sonic (Disabled)';
  engine: AIEngine = 'amazon_nova_sonic';

  constructor(restaurantName: string, menuItems: AVOSMenuIndexEntry[]) {
    super(restaurantName, menuItems);
    console.warn('[AVOS] Amazon Nova provider is disabled. Use Google Gemini instead.');
  }

  async transcribe(audioBuffer: Buffer, language: SupportedLanguage): Promise<TranscriptionResult> {
    return { text: '', language, confidence: 0, alternatives: [] };
  }

  async synthesize(text: string, language: SupportedLanguage): Promise<Buffer> {
    return Buffer.alloc(0);
  }

  async detectLanguage(audioBuffer: Buffer): Promise<LanguageDetectionResult> {
    return { language: 'en', confidence: 0.5 };
  }

  async analyzeIntent(text: string, context: DialogContext): Promise<IntentResult> {
    return { intent: 'UNKNOWN', confidence: 0, entities: {}, rawText: text };
  }

  async generateResponse(context: DialogContext, intent: IntentResult): Promise<string> {
    return 'Amazon Nova provider is not available. Please use Google Gemini.';
  }
}
