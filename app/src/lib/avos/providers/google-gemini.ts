/**
 * Google Gemini 2.0 voice AI provider implementation
 * Uses Vertex AI for intent analysis and response generation
 * Uses Google Cloud Speech-to-Text v2 for transcription with streaming support
 * Uses Google Cloud Text-to-Speech for speech synthesis
 *
 * Environment Variables:
 * - AVOS_GOOGLE_CCAI_PROJECT_ID: Google Cloud project ID
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON file
 */

import { VertexAI } from '@google-cloud/vertexai';
import * as speech from '@google-cloud/speech';
import * as textToSpeech from '@google-cloud/text-to-speech';
import {
  TranscriptionResult,
  LanguageDetectionResult,
  DialogContext,
  IntentResult,
  OrderIntent,
  AVOSMenuIndexEntry,
  SupportedLanguage,
  AIEngine,
} from '../types';
import { BaseVoiceAIProvider } from './base';

/**
 * Language code mapping for Google Cloud APIs
 */
const GOOGLE_LANGUAGE_CODES: Record<SupportedLanguage, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  yue: 'yue-Hant-HK', // Cantonese Hong Kong
  es: 'es-ES',
};

/**
 * Voice codes for Google Text-to-Speech
 */
const GOOGLE_VOICE_CODES: Record<SupportedLanguage, string> = {
  en: 'en-US-Neural2-A',
  zh: 'zh-CN-Neural2-A',
  yue: 'yue-HK-Neural2-A',
  es: 'es-ES-Neural2-A',
};

export class GoogleGeminiProvider extends BaseVoiceAIProvider {
  name = 'Google Gemini 2.0';
  engine: AIEngine = 'google_gemini_2';

  private vertexAI: VertexAI;
  private speechClient: speech.SpeechClient;
  private ttsClient: textToSpeech.TextToSpeechClient;
  private projectId: string;

  constructor(restaurantName: string, menuItems: AVOSMenuIndexEntry[]) {
    super(restaurantName, menuItems);

    this.projectId = process.env.AVOS_GOOGLE_CCAI_PROJECT_ID || '';
    if (!this.projectId) {
      throw new Error(
        '[AVOS] AVOS_GOOGLE_CCAI_PROJECT_ID environment variable is required'
      );
    }

    console.log(`[AVOS] Initializing Google Gemini provider for project ${this.projectId}`);

    // Initialize Vertex AI for LLM
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: 'us-central1',
    });

    // Initialize Speech-to-Text client
    this.speechClient = new speech.SpeechClient();

    // Initialize Text-to-Speech client
    this.ttsClient = new textToSpeech.TextToSpeechClient();
  }

  /**
   * Transcribe audio to text using Google Cloud Speech-to-Text v2
   * Supports streaming for longer audio files
   */
  async transcribe(
    audioBuffer: Buffer,
    language: SupportedLanguage
  ): Promise<TranscriptionResult> {
    console.log(
      `[AVOS] Transcribing audio for language: ${language} (${audioBuffer.length} bytes)`
    );

    try {
      const languageCode = GOOGLE_LANGUAGE_CODES[language];

      const request = {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode,
          model: 'latest_long',
        },
        audio: {
          content: audioBuffer.toString('base64'),
        },
      };

      const response = (await this.speechClient.recognize(request as any))[0] as any;

      if (!response.results || response.results.length === 0) {
        console.log('[AVOS] No speech detected in audio');
        return {
          text: '',
          language,
          confidence: 0,
          alternatives: [],
        };
      }

      const result = response.results[0];
      const firstAlternative = result.alternatives?.[0];

      if (!firstAlternative) {
        return {
          text: '',
          language,
          confidence: 0,
          alternatives: [],
        };
      }

      const transcriptionText = firstAlternative.transcript || '';
      const confidence = firstAlternative.confidence || 0;

      // Collect alternatives if available
      const alternatives = (result.alternatives || [])
        .slice(1)
        .map((alt: any) => ({
          text: alt.transcript || '',
          confidence: alt.confidence || 0,
        }));

      console.log(
        `[AVOS] Transcription successful: "${transcriptionText}" (confidence: ${confidence})`
      );

      return {
        text: transcriptionText,
        language,
        confidence,
        alternatives,
      };
    } catch (error) {
      console.error('[AVOS] Transcription error:', error);
      throw new Error(
        `Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Synthesize text to speech audio using Google Cloud Text-to-Speech
   */
  async synthesize(
    text: string,
    language: SupportedLanguage
  ): Promise<Buffer> {
    console.log(`[AVOS] Synthesizing text: "${text.substring(0, 50)}..." (${language})`);

    try {
      const voiceCode = GOOGLE_VOICE_CODES[language];

      const request = {
        input: { text },
        voice: {
          languageCode: GOOGLE_LANGUAGE_CODES[language],
          name: voiceCode,
        },
        audioConfig: {
          audioEncoding:
            textToSpeech.protos.google.cloud.texttospeech.v1.AudioEncoding.LINEAR16,
          sampleRateHertz: 16000,
        },
      };

      const [response] = await this.ttsClient.synthesizeSpeech(request);
      const audioBuffer = response.audioContent;

      if (!audioBuffer) {
        throw new Error('No audio content returned from TTS service');
      }

      console.log(`[AVOS] Synthesis successful (${audioBuffer.length} bytes)`);
      return audioBuffer as Buffer;
    } catch (error) {
      console.error('[AVOS] Synthesis error:', error);
      throw new Error(
        `Failed to synthesize speech: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Detect language from audio buffer using Google Cloud Speech-to-Text
   */
  async detectLanguage(audioBuffer: Buffer): Promise<LanguageDetectionResult> {
    console.log(`[AVOS] Detecting language from audio (${audioBuffer.length} bytes)`);

    try {
      // Use Speech-to-Text auto-detection by trying the most likely languages
      const supportedCodes = Object.values(GOOGLE_LANGUAGE_CODES);

      const request = {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'auto', // Auto-detect
        },
        audio: {
          content: audioBuffer.toString('base64'),
        },
      };

      const response = (await this.speechClient.recognize(request as any))[0] as any;

      if (!response.results || response.results.length === 0) {
        console.log('[AVOS] Could not detect language, defaulting to English');
        return {
          language: 'en',
          confidence: 0.5,
        };
      }

      // Extract language from result metadata
      const resultLanguageCode =
        response.results[0].languageCode || 'en-US';
      const detectedLanguage = this.mapGoogleLanguageToSupported(
        resultLanguageCode
      );

      const confidence = response.results[0].alternatives?.[0]?.confidence || 0.7;

      console.log(
        `[AVOS] Language detected: ${detectedLanguage} (confidence: ${confidence})`
      );

      return {
        language: detectedLanguage,
        confidence,
      };
    } catch (error) {
      console.error('[AVOS] Language detection error:', error);
      // Default to English on error
      return {
        language: 'en',
        confidence: 0.5,
      };
    }
  }

  /**
   * Analyze intent using Gemini with structured JSON output
   * Uses few-shot prompting for accurate intent classification
   */
  async analyzeIntent(
    text: string,
    context: DialogContext
  ): Promise<IntentResult> {
    console.log(`[AVOS] Analyzing intent for: "${text}"`);

    try {
      const model = this.vertexAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const systemPrompt = this.buildIntentAnalysisPrompt(context);

      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemPrompt}\n\nUser input: "${text}"\n\nRespond with JSON only.`,
              },
            ],
          },
        ],
      });

      const responseText =
        response.response.candidates?.[0]?.content.parts[0]?.text || '{}';

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;

      let result: any;
      try {
        result = JSON.parse(jsonStr);
      } catch {
        console.warn('[AVOS] Failed to parse intent analysis JSON, using default');
        result = {
          intent: 'UNKNOWN',
          confidence: 0.3,
          entities: {},
        };
      }

      const intentResult: IntentResult = {
        intent: (result.intent || 'UNKNOWN') as OrderIntent,
        confidence: result.confidence || 0.5,
        entities: result.entities || {},
        rawText: text,
      };

      console.log(
        `[AVOS] Intent detected: ${intentResult.intent} (confidence: ${intentResult.confidence})`
      );

      return intentResult;
    } catch (error) {
      console.error('[AVOS] Intent analysis error:', error);
      return {
        intent: 'UNKNOWN',
        confidence: 0,
        entities: {},
        rawText: text,
      };
    }
  }

  /**
   * Generate natural language response using Gemini
   * Incorporates restaurant context, menu items, and conversation state
   */
  async generateResponse(
    context: DialogContext,
    intent: IntentResult
  ): Promise<string> {
    console.log(`[AVOS] Generating response for intent: ${intent.intent}`);

    try {
      const model = this.vertexAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const systemPrompt = this.buildSystemPrompt(
        context.language,
        this.restaurantName
      );

      const conversationHistory = context.conversationHistory
        .map((e) => `${e.role === 'ai' ? 'AI' : 'Customer'}: ${e.text}`)
        .join('\n');

      const orderSummary = this.formatOrderSummary(context);

      const userMessage = `
Current Dialog State: ${context.currentState}
Current Order:
${orderSummary}

Customer Intent: ${intent.intent}
Entities: ${JSON.stringify(intent.entities)}

Recent Conversation:
${conversationHistory}

Generate a natural, concise voice response (1-2 sentences max) for the next turn.
Respond in the customer's language (${context.language}).
Support code-switching naturally if the customer uses multiple languages.
`;

      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemPrompt}\n\n${userMessage}`,
              },
            ],
          },
        ],
      });

      const responseText =
        response.response.candidates?.[0]?.content.parts[0]?.text ||
        this.getDefaultResponse(context.language);

      console.log(`[AVOS] Response generated: "${responseText.substring(0, 50)}..."`);

      return responseText;
    } catch (error) {
      console.error('[AVOS] Response generation error:', error);
      return this.getDefaultResponse(context.language);
    }
  }

  /**
   * Build a prompt for intent analysis with few-shot examples
   */
  private buildIntentAnalysisPrompt(context: DialogContext): string {
    return `You are an NLU system for a restaurant voice ordering system.
Classify the customer utterance into one of these intents:
- ORDER_ITEM: Customer wants to order something
- REMOVE_ITEM: Customer wants to remove an item
- MODIFY_ITEM: Customer wants to modify an item (sauce, spice level, etc.)
- ASK_QUESTION: Customer asks about menu or restaurant
- CONFIRM: Customer agrees or says yes
- DENY: Customer disagrees or says no
- REPEAT: Customer asks to repeat or speak louder
- CANCEL_ORDER: Customer wants to cancel the entire order
- CHECK_TOTAL: Customer asks for price or total
- SWITCH_LANGUAGE: Customer wants to switch language
- SPEAK_TO_HUMAN: Customer wants to talk to a person
- READY_TO_PAY: Customer is ready to pay
- UNKNOWN: Cannot classify

Respond in this exact JSON format:
{
  "intent": "INTENT_NAME",
  "confidence": 0.95,
  "entities": {
    "menuItems": [{"name": "item name", "quantity": 1, "modifications": []}],
    "language": "en",
    "confirmation": true
  }
}

Current context:
- Dialog state: ${context.currentState}
- Language: ${context.language}
- Items in order: ${context.orderItems.length}`;
  }

  /**
   * Map Google Cloud language code to supported language
   */
  private mapGoogleLanguageToSupported(
    googleCode: string
  ): SupportedLanguage {
    if (googleCode.startsWith('zh')) return 'zh';
    if (googleCode.startsWith('yue')) return 'yue';
    if (googleCode.startsWith('es')) return 'es';
    return 'en';
  }

  /**
   * Default response when generation fails
   */
  private getDefaultResponse(language: SupportedLanguage): string {
    const responses: Record<SupportedLanguage, string> = {
      en: 'I did not understand that. Could you please repeat?',
      zh: '我没有理解。您能请重复吗？',
      yue: '我冇理解。您能請重複嗎？',
      es: 'No entendí eso. ¿Podrías repetir?',
    };
    return responses[language];
  }
}
