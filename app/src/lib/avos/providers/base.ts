/**
 * Abstract base class for voice AI providers
 * Defines the interface that all AI engines (Google Gemini, Amazon Nova) must implement
 * Provides helper methods for restaurant-specific prompting and response formatting
 */

import {
  VoiceAIProvider,
  TranscriptionResult,
  LanguageDetectionResult,
  DialogContext,
  IntentResult,
  AVOSMenuIndexEntry,
  SupportedLanguage,
  AIEngine,
} from '../types';

/**
 * Language-specific system prompts for restaurant ordering context
 */
const SYSTEM_PROMPT_TEMPLATES: Record<SupportedLanguage, string> = {
  en: `You are a friendly and efficient AI voice assistant for {restaurantName}, a restaurant ordering system.
Your role is to help customers order food via phone call.

Restaurant Information:
- Name: {restaurantName}
- Available Items: {menuContext}

Guidelines:
- Be conversational and natural, mimicking a friendly restaurant staff member
- Listen to what the customer wants and ask clarifying questions
- Suggest modifications (no salt, extra spicy, light sauce, etc.) when appropriate
- When customer wants to add items, confirm quantity and any special requests
- Keep responses concise (1-2 sentences max) for voice delivery
- Always be polite and enthusiastic about food recommendations
- If customer asks about unavailable items, suggest similar alternatives from the menu
- Maintain context of the order being built up in the conversation
- Use the customer's preferred language throughout`,

  zh: `您是{restaurantName}餐厅语音订餐系统的友好高效的AI助手。
您的职责是帮助顾客通过电话订餐。

餐厅信息：
- 名称：{restaurantName}
- 可用商品：{menuContext}

指导原则：
- 保持对话式和自然的语气，模仿友好的餐厅员工
- 倾听顾客想要的东西并提出澄清问题
- 当适当时建议修改（不要盐、特别辣、清淡酱汁等）
- 当顾客想添加项目时，确认数量和任何特殊要求
- 为语音传递保持简洁（最多1-2句话）
- 始终对食品推荐礼貌和热情
- 如果顾客询问缺货商品，建议菜单中类似的替代品
- 保持订单建立过程中的上下文
- 全程使用顾客的首选语言`,

  yue: `您是{restaurantName}餐廳語音訂餐系統嘅友善同高效嘅AI助手。
您嘅職責係幫助顧客透過電話訂餐。

餐廳信息：
- 名稱：{restaurantName}
- 可用商品：{menuContext}

指導原則：
- 保持對話式同自然嘅語氣，模仿友善嘅餐廳員工
- 傾聽顧客想要嘅嘢並提出澄清問題
- 當適當時建議修改（唔要鹽、特別辣、清淡醬汁等）
- 當顧客想添加項目時，確認數量同任何特殊要求
- 為語音傳遞保持簡潔（最多1-2句話）
- 始終對食品推薦禮貌同熱情
- 如果顧客詢問缺貨商品，建議菜單中類似嘅替代品
- 保持訂單建立過程中嘅上下文
- 全程使用顧客嘅首選語言`,

  es: `Eres un asistente de IA amable y eficiente para el sistema de pedidos por voz de {restaurantName}.
Tu función es ayudar a los clientes a realizar pedidos de comida por teléfono.

Información del Restaurante:
- Nombre: {restaurantName}
- Artículos Disponibles: {menuContext}

Directrices:
- Sé conversacional y natural, imitando a un miembro amable del personal del restaurante
- Escucha lo que el cliente quiere y haz preguntas aclaratorias
- Sugiere modificaciones (sin sal, muy picante, salsa ligera, etc.) cuando sea apropiado
- Cuando el cliente quiera agregar artículos, confirma la cantidad y cualquier solicitud especial
- Mantén respuestas concisas (máximo 1-2 oraciones) para entrega de voz
- Siempre sé cortés y entusiasta con las recomendaciones de comida
- Si el cliente pregunta sobre artículos no disponibles, sugiere alternativas similares del menú
- Mantén el contexto del pedido que se está construyendo en la conversación
- Usa el idioma preferido del cliente durante toda la conversación`,
};

export abstract class BaseVoiceAIProvider implements VoiceAIProvider {
  abstract name: string;
  abstract engine: AIEngine;

  protected restaurantName: string;
  protected menuItems: AVOSMenuIndexEntry[];

  constructor(restaurantName: string, menuItems: AVOSMenuIndexEntry[]) {
    console.log(`[AVOS] Initializing ${this.constructor.name} provider`);
    this.restaurantName = restaurantName;
    this.menuItems = menuItems;
  }

  /**
   * Abstract methods that subclasses must implement
   */
  abstract transcribe(
    audioBuffer: Buffer,
    language: SupportedLanguage
  ): Promise<TranscriptionResult>;

  abstract synthesize(
    text: string,
    language: SupportedLanguage
  ): Promise<Buffer>;

  abstract detectLanguage(audioBuffer: Buffer): Promise<LanguageDetectionResult>;

  abstract analyzeIntent(
    text: string,
    context: DialogContext
  ): Promise<IntentResult>;

  abstract generateResponse(
    context: DialogContext,
    intent: IntentResult
  ): Promise<string>;

  /**
   * Build a system prompt for the LLM with restaurant context and menu
   * Includes menu items, available modifications, and ordering guidelines
   */
  protected buildSystemPrompt(
    language: SupportedLanguage,
    restaurantName: string
  ): string {
    const template = SYSTEM_PROMPT_TEMPLATES[language] || SYSTEM_PROMPT_TEMPLATES['en'];
    const menuContext = this.buildMenuContext(language);

    return template
      .replace('{restaurantName}', restaurantName)
      .replace('{menuContext}', menuContext);
  }

  /**
   * Build a formatted menu context string for the system prompt
   * Lists key menu items and categories available
   */
  protected buildMenuContext(language: SupportedLanguage): string {
    if (!this.menuItems || this.menuItems.length === 0) {
      return 'No menu items loaded';
    }

    // Group by category
    const byCategory: Record<string, AVOSMenuIndexEntry[]> = {};
    for (const item of this.menuItems) {
      if (!byCategory[item.category]) {
        byCategory[item.category] = [];
      }
      byCategory[item.category].push(item);
    }

    // Format as bullet list
    const lines: string[] = [];
    for (const [category, items] of Object.entries(byCategory)) {
      lines.push(`${category}:`);
      // Show first 5 items per category to keep prompt concise
      for (const item of items.slice(0, 5)) {
        const name = this.getLocalizedItemName(item, language);
        lines.push(`  - ${name} ($${item.priceUsd.toFixed(2)})`);
      }
      if (items.length > 5) {
        lines.push(`  ... and ${items.length - 5} more`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get the localized item name based on language preference
   */
  protected getLocalizedItemName(
    item: AVOSMenuIndexEntry,
    language: SupportedLanguage
  ): string {
    switch (language) {
      case 'zh':
        return item.itemNameZh || item.itemName;
      case 'yue':
        return item.itemNameYue || item.itemName;
      case 'es':
        return item.itemNameEs || item.itemName;
      case 'en':
      default:
        return item.itemName;
    }
  }

  /**
   * Format an order summary for TTS (text-to-speech) in the target language
   * Reads back items with quantities and prices in a natural way
   */
  protected formatOrderSummary(context: DialogContext): string {
    const { orderItems, language, subtotalUsd } = context;

    if (orderItems.length === 0) {
      switch (language) {
        case 'zh':
          return '您的订单为空。';
        case 'yue':
          return '您嘅訂單為空。';
        case 'es':
          return 'Su pedido está vacío.';
        case 'en':
        default:
          return 'Your order is empty.';
      }
    }

    // Build item list
    const itemSummaries = orderItems.map((item) => {
      const quantity = item.quantity > 1 ? ` x${item.quantity}` : '';
      const modsStr =
        item.modifications && item.modifications.length > 0
          ? ` (${item.modifications.join(', ')})`
          : '';
      const price = `$${(item.priceUsd * item.quantity).toFixed(2)}`;
      return `${item.name}${quantity}${modsStr} - ${price}`;
    });

    // Format based on language
    let summary: string;
    switch (language) {
      case 'zh':
        summary =
          '您的订单包括：\n' +
          itemSummaries.join('\n') +
          `\n小计：$${subtotalUsd.toFixed(2)}`;
        break;
      case 'yue':
        summary =
          '您嘅訂單包括：\n' +
          itemSummaries.join('\n') +
          `\n小計：$${subtotalUsd.toFixed(2)}`;
        break;
      case 'es':
        summary =
          'Su pedido incluye:\n' +
          itemSummaries.join('\n') +
          `\nSubtotal: $${subtotalUsd.toFixed(2)}`;
        break;
      case 'en':
      default:
        summary =
          'Your order includes:\n' +
          itemSummaries.join('\n') +
          `\nSubtotal: $${subtotalUsd.toFixed(2)}`;
    }

    return summary;
  }

  /**
   * Language-specific greeting messages
   */
  protected getGreetingMessage(language: SupportedLanguage): string {
    const greetings: Record<SupportedLanguage, string> = {
      en: `Hello! Welcome to ${this.restaurantName}. How can I help you order today?`,
      zh: `您好！欢迎来到${this.restaurantName}。今天有什么可以为您服务的吗？`,
      yue: `您好！歡迎嚟到${this.restaurantName}。今日有咩可以為您服務嘅嗎？`,
      es: `¡Hola! Bienvenido a ${this.restaurantName}. ¿Cómo puedo ayudarte a realizar tu pedido hoy?`,
    };
    return greetings[language];
  }

  /**
   * Language-specific confirmation prompts
   */
  protected getConfirmationPrompt(language: SupportedLanguage): string {
    const prompts: Record<SupportedLanguage, string> = {
      en: 'Is that correct? Would you like to add anything else?',
      zh: '这样对吗？您还想添加其他东西吗？',
      yue: '咁啱唔啱？您仲想添加其他嘢嗎？',
      es: '¿Es eso correcto? ¿Te gustaría agregar algo más?',
    };
    return prompts[language];
  }

  /**
   * Language-specific upsell suggestions
   */
  protected getUpsellPrompt(
    language: SupportedLanguage,
    hasMainDish: boolean,
    hasSoup: boolean,
    hasDrink: boolean
  ): string | null {
    // Suggest drink if order has main but no drink
    if (hasMainDish && !hasDrink) {
      const prompts: Record<SupportedLanguage, string> = {
        en: 'Would you like to add a drink to your order?',
        zh: '您想为订单添加饮料吗？',
        yue: '您想為訂單添加飲料嗎？',
        es: '¿Te gustaría agregar una bebida a tu pedido?',
      };
      return prompts[language];
    }

    // Suggest soup if order has main but no soup
    if (hasMainDish && !hasSoup) {
      const prompts: Record<SupportedLanguage, string> = {
        en: 'Would you like to add a soup to your order?',
        zh: '您想为订单添加汤吗？',
        yue: '您想為訂單添加湯嗎？',
        es: '¿Te gustaría agregar una sopa a tu pedido?',
      };
      return prompts[language];
    }

    return null;
  }

  /**
   * Language-specific error recovery prompts
   */
  protected getErrorRecoveryPrompt(
    language: SupportedLanguage,
    attemptCount: number
  ): string {
    if (attemptCount === 1) {
      // First error: rephrase and ask again
      const rephrases: Record<SupportedLanguage, string> = {
        en: 'Sorry, I did not understand that. Could you please repeat or say it differently?',
        zh: '抱歉，我没有理解。您能否请重复或用不同的方式说出来？',
        yue: '抱歉，我冇理解。您能否請重複或用不同嘅方式講出嚟？',
        es: 'Disculpe, no entendí eso. ¿Podrías repetir o decirlo de manera diferente?',
      };
      return rephrases[language];
    } else if (attemptCount === 2) {
      // Second error: offer menu options
      const offers: Record<SupportedLanguage, string> = {
        en: 'I am having trouble understanding. Would you like me to read the menu items available?',
        zh: '我在理解方面遇到了困难。您想让我读一下可用的菜单项目吗？',
        yue: '我喺理解方面遇到咗困難。您想讓我讀一下可用嘅菜單項目嗎？',
        es: 'Tengo problemas para entender. ¿Te gustaría que lea los artículos de menú disponibles?',
      };
      return offers[language];
    } else {
      // Third error: offer transfer to human
      const transfers: Record<SupportedLanguage, string> = {
        en: 'I apologize for the confusion. Would you like me to connect you with a staff member?',
        zh: '为混淆道歉。您想让我将您与工作人员联系吗？',
        yue: '為混淆道歉。您想讓我將您與員工聯繫嗎？',
        es: 'Disculpe la confusión. ¿Te gustaría que te conecte con un miembro del personal?',
      };
      return transfers[language];
    }
  }

  /**
   * Language-specific payment prompts
   */
  protected getPaymentPrompt(language: SupportedLanguage): string {
    const prompts: Record<SupportedLanguage, string> = {
      en: 'How would you like to pay? I can send you a payment link via SMS or provide a wallet address.',
      zh: '您想如何付款？我可以通过短信发送付款链接或提供钱包地址。',
      yue: '您想點樣付款？我可以透過短信發送付款鏈接或提供錢包地址。',
      es: '¿Cómo te gustaría pagar? Puedo enviarte un enlace de pago por SMS o proporcionar una dirección de billetera.',
    };
    return prompts[language];
  }

  /**
   * Language-specific order confirmation messages
   */
  protected getOrderConfirmationMessage(
    language: SupportedLanguage,
    estimatedMinutes: number
  ): string {
    const messages: Record<SupportedLanguage, string> = {
      en: `Perfect! Your order has been confirmed. Your food will be ready in approximately ${estimatedMinutes} minutes.`,
      zh: `完美！您的订单已确认。您的食物将在大约${estimatedMinutes}分钟内准备好。`,
      yue: `完美！您嘅訂單已確認。您嘅食物將喺大約${estimatedMinutes}分鐘內準備好。`,
      es: `¡Perfecto! Tu pedido ha sido confirmado. Tu comida estará lista en aproximadamente ${estimatedMinutes} minutos.`,
    };
    return messages[language];
  }
}
