/**
 * Factory function for creating voice AI providers
 * Instantiates the appropriate provider (Google Gemini or Amazon Nova) based on configuration
 */

import { AIEngine, VoiceAIProvider, AVOSMenuIndexEntry } from './types';
import { GoogleGeminiProvider } from './providers/google-gemini';
import { AmazonNovaProvider } from './providers/amazon-nova';

/**
 * Create and return the appropriate voice AI provider instance
 * @param engine - The AI engine type to instantiate
 * @param restaurantName - Restaurant name for context in prompts
 * @param menuItems - Menu items for the restaurant
 * @returns Initialized VoiceAIProvider instance
 * @throws Error if engine type is not supported or required environment variables are missing
 */
export function createVoiceProvider(
  engine: AIEngine,
  restaurantName: string,
  menuItems: AVOSMenuIndexEntry[]
): VoiceAIProvider {
  console.log(
    `[AVOS] Creating voice provider for engine: ${engine} (restaurant: ${restaurantName})`
  );

  switch (engine) {
    case 'google_gemini_2':
      return new GoogleGeminiProvider(restaurantName, menuItems);

    case 'amazon_nova_sonic':
      return new AmazonNovaProvider(restaurantName, menuItems);

    default:
      const _exhaustiveCheck: never = engine;
      throw new Error(`Unsupported AI engine: ${_exhaustiveCheck}`);
  }
}

/**
 * Validate that the required environment variables for a given engine are set
 * @param engine - The AI engine to validate
 * @throws Error if required environment variables are missing
 */
export function validateEngineEnvironment(engine: AIEngine): void {
  console.log(`[AVOS] Validating environment for engine: ${engine}`);

  switch (engine) {
    case 'google_gemini_2':
      if (!process.env.AVOS_GOOGLE_CCAI_PROJECT_ID) {
        throw new Error(
          '[AVOS] Missing required environment variable: AVOS_GOOGLE_CCAI_PROJECT_ID'
        );
      }
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn(
          '[AVOS] GOOGLE_APPLICATION_CREDENTIALS not set. Make sure Google Cloud credentials are configured.'
        );
      }
      break;

    case 'amazon_nova_sonic':
      if (!process.env.AVOS_AMAZON_REGION) {
        console.warn(
          '[AVOS] AVOS_AMAZON_REGION not set, using default: us-west-2'
        );
      }
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        throw new Error(
          '[AVOS] Missing required AWS credentials: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY'
        );
      }
      break;

    default:
      const _exhaustiveCheck: never = engine;
      throw new Error(`Unknown AI engine: ${_exhaustiveCheck}`);
  }
}

/**
 * Get the display name for an AI engine
 * @param engine - The AI engine type
 * @returns Human-readable name for the engine
 */
export function getEngineName(engine: AIEngine): string {
  switch (engine) {
    case 'google_gemini_2':
      return 'Google Gemini 2.0';
    case 'amazon_nova_sonic':
      return 'Amazon Nova Sonic';
    default:
      const _exhaustiveCheck: never = engine;
      return _exhaustiveCheck;
  }
}
