/**
 * Dialog State Machine for AVOS (AI Voice Ordering System)
 * Implements the complete FSM architecture from the AVOS patent
 * Manages conversation flow from greeting through order confirmation
 *
 * States: GREETING → LANGUAGE_SELECT → TAKING_ORDER → ITEM_CUSTOMIZATION → UPSELLING →
 *         ORDER_REVIEW → CUSTOMER_INFO → PAYMENT → CONFIRMATION → CLOSING →
 *         TRANSFER_TO_HUMAN (on error) or ERROR_RECOVERY (retry)
 */

import {
  DialogState,
  DialogContext,
  AVOSConfig,
  AVOSMenuIndexEntry,
  IntentResult,
  SupportedLanguage,
  TranscriptEntry,
} from './types';
import { BaseVoiceAIProvider } from './providers/base';

interface StateTransitionResult {
  response: string;
  nextState: DialogState;
  context: DialogContext;
}

export class DialogStateMachine {
  private config: AVOSConfig;
  private menuItems: AVOSMenuIndexEntry[];
  private voiceProvider: BaseVoiceAIProvider;

  constructor(
    config: AVOSConfig,
    menuItems: AVOSMenuIndexEntry[],
    voiceProvider: BaseVoiceAIProvider
  ) {
    this.config = config;
    this.menuItems = menuItems;
    this.voiceProvider = voiceProvider;
    console.log(
      `[AVOS] Initializing DialogStateMachine for restaurant: ${config.restaurantId}`
    );
  }

  /**
   * Initialize a new call context
   */
  initializeCall(callId: string, restaurantId: string, callerPhone: string): DialogContext {
    console.log(`[AVOS] Initializing call context: ${callId}`);

    return {
      callId,
      restaurantId,
      currentState: 'GREETING',
      language: this.config.primaryLanguage,
      orderItems: [],
      customerPhone: callerPhone,
      subtotalUsd: 0,
      conversationHistory: [],
      errorCount: 0,
      maxErrors: 3,
      upsellOffered: false,
      orderConfirmed: false,
      paymentInitiated: false,
      metadata: {},
    };
  }

  /**
   * Process user input and transition state
   */
  async processInput(
    context: DialogContext,
    intentResult: IntentResult
  ): Promise<StateTransitionResult> {
    console.log(
      `[AVOS] Processing input in state: ${context.currentState}, intent: ${intentResult.intent}`
    );

    // Append user input to transcript
    context.conversationHistory.push({
      role: 'customer',
      text: intentResult.rawText,
      language: context.language,
      timestamp: new Date().toISOString(),
      confidence: intentResult.confidence,
    });

    try {
      // Route to appropriate state handler
      let result: StateTransitionResult;

      switch (context.currentState) {
        case 'GREETING':
          result = await this.handleGreeting(context, intentResult);
          break;

        case 'LANGUAGE_SELECT':
          result = await this.handleLanguageSelect(context, intentResult);
          break;

        case 'TAKING_ORDER':
          result = await this.handleTakingOrder(context, intentResult);
          break;

        case 'ITEM_CUSTOMIZATION':
          result = await this.handleItemCustomization(context, intentResult);
          break;

        case 'UPSELLING':
          result = await this.handleUpselling(context, intentResult);
          break;

        case 'ORDER_REVIEW':
          result = await this.handleOrderReview(context, intentResult);
          break;

        case 'CUSTOMER_INFO':
          result = await this.handleCustomerInfo(context, intentResult);
          break;

        case 'PAYMENT':
          result = await this.handlePayment(context, intentResult);
          break;

        case 'CONFIRMATION':
          result = await this.handleConfirmation(context, intentResult);
          break;

        case 'CLOSING':
          result = await this.handleClosing(context, intentResult);
          break;

        case 'ERROR_RECOVERY':
          result = await this.handleErrorRecovery(context, intentResult);
          break;

        default:
          // Default to CLOSING if unknown state
          result = await this.handleClosing(context, intentResult);
      }

      // Append AI response to transcript
      result.context.conversationHistory.push({
        role: 'ai',
        text: result.response,
        language: result.context.language,
        timestamp: new Date().toISOString(),
      });

      // Reset error count on successful processing
      result.context.errorCount = 0;

      return result;
    } catch (error) {
      console.error('[AVOS] Error processing input:', error);
      return this.handleUnexpectedError(context);
    }
  }

  /**
   * GREETING state: Welcome customer and detect language
   */
  private async handleGreeting(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling GREETING state');

    const greeting = (this.voiceProvider as any).getGreetingMessage(
      context.language
    );

    return {
      response: greeting,
      nextState: 'LANGUAGE_SELECT',
      context,
    };
  }

  /**
   * LANGUAGE_SELECT state: Confirm or change language preference
   */
  private async handleLanguageSelect(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling LANGUAGE_SELECT state');

    // Check if customer explicitly switched language
    if (intent.intent === 'SWITCH_LANGUAGE' && intent.entities.language) {
      context.language = intent.entities.language as SupportedLanguage;
    }

    // Move to order taking
    const response =
      context.language === 'en'
        ? 'Great! What would you like to order?'
        : context.language === 'zh'
          ? '好的！您想要订购什么？'
          : context.language === 'yue'
            ? '好嘅！您想要訂購咩？'
            : '¡Perfecto! ¿Qué te gustaría pedir?';

    return {
      response,
      nextState: 'TAKING_ORDER',
      context,
    };
  }

  /**
   * TAKING_ORDER state: Collect items from customer
   */
  private async handleTakingOrder(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling TAKING_ORDER state');

    // Handle different intents in this state
    if (intent.intent === 'ORDER_ITEM' && intent.entities.menuItems) {
      // Add items to order
      for (const item of intent.entities.menuItems) {
        const menuItem = this.findMenuItem(item.name);
        if (menuItem) {
          context.orderItems.push({
            menuItemId: menuItem.menuItemId,
            name: menuItem.itemName,
            quantity: item.quantity || 1,
            priceUsd: menuItem.priceUsd,
            modifications: item.modifications || [],
          });
          context.subtotalUsd += menuItem.priceUsd * (item.quantity || 1);
        }
      }

      // Ask if they want to add more or customize
      const response =
        context.language === 'en'
          ? `Added ${intent.entities.menuItems[0]?.name || 'item'} to your order. Would you like anything else?`
          : context.language === 'zh'
            ? `已添加${intent.entities.menuItems[0]?.name || '商品'}到您的订单。您还想要什么吗？`
            : context.language === 'yue'
              ? `已添加${intent.entities.menuItems[0]?.name || '商品'}到您嘅訂單。您仲想要咩嗎？`
              : `Agregado ${intent.entities.menuItems[0]?.name || 'artículo'} a tu pedido. ¿Quieres algo más?`;

      return {
        response,
        nextState: context.orderItems.length > 0 ? 'UPSELLING' : 'TAKING_ORDER',
        context,
      };
    } else if (
      intent.intent === 'READY_TO_PAY' ||
      intent.intent === 'CONFIRM'
    ) {
      // Customer done ordering
      if (context.orderItems.length === 0) {
        const response =
          context.language === 'en'
            ? 'Your order is empty. Please add items first.'
            : context.language === 'zh'
              ? '您的订单为空。请先添加项目。'
              : context.language === 'yue'
                ? '您嘅訂單為空。請先添加項目。'
                : 'Tu pedido está vacío. Por favor, agrega artículos primero.';
        return {
          response,
          nextState: 'TAKING_ORDER',
          context,
        };
      }
      return {
        response: 'Let me review your order.',
        nextState: 'ORDER_REVIEW',
        context,
      };
    } else if (intent.intent === 'UNKNOWN' || intent.confidence < 0.5) {
      context.errorCount++;
      return this.handleErrorRecoveryAttempt(context, intent);
    }

    // Default: ask for more items
    const response =
      context.language === 'en'
        ? 'Would you like to add more items?'
        : context.language === 'zh'
          ? '您想添加更多项目吗？'
          : context.language === 'yue'
            ? '您想添加更多項目嗎？'
            : '¿Te gustaría agregar más artículos?';

    return {
      response,
      nextState: 'TAKING_ORDER',
      context,
    };
  }

  /**
   * ITEM_CUSTOMIZATION state: Handle item modifications
   */
  private async handleItemCustomization(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling ITEM_CUSTOMIZATION state');

    if (intent.intent === 'MODIFY_ITEM' && intent.entities.menuItems) {
      // Update last item with modifications
      if (context.orderItems.length > 0) {
        const lastItem = context.orderItems[context.orderItems.length - 1];
        lastItem.modifications = intent.entities.menuItems[0]?.modifications || [];
      }
    }

    // Move to next state
    const response =
      context.language === 'en'
        ? 'Got it. Anything else?'
        : context.language === 'zh'
          ? '好的。还有其他吗？'
          : context.language === 'yue'
            ? '好嘅。仲有其他嗎？'
            : 'Entendido. ¿Algo más?';

    return {
      response,
      nextState: 'UPSELLING',
      context,
    };
  }

  /**
   * UPSELLING state: Suggest complementary items
   */
  private async handleUpselling(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling UPSELLING state');

    // Check if upselling is enabled and not yet offered
    if (
      this.config.enableUpselling &&
      !context.upsellOffered &&
      context.orderItems.length > 0
    ) {
      context.upsellOffered = true;

      // Analyze what we have in the order
      const hasMainDish = context.orderItems.some((item) =>
        item.name.toLowerCase().includes('dish')
      );
      const hasSoup = context.orderItems.some(
        (item) =>
          item.name.toLowerCase().includes('soup') ||
          item.name.toLowerCase().includes('汤') ||
          item.name.toLowerCase().includes('湯')
      );
      const hasDrink = context.orderItems.some(
        (item) =>
          item.name.toLowerCase().includes('drink') ||
          item.name.toLowerCase().includes('beverage') ||
          item.name.toLowerCase().includes('饮料')
      );

      const upsellPrompt = (this.voiceProvider as any).getUpsellPrompt(
        context.language,
        hasMainDish,
        hasSoup,
        hasDrink
      );

      if (upsellPrompt) {
        return {
          response: upsellPrompt,
          nextState: 'UPSELLING',
          context,
        };
      }
    }

    // No upsell or customer declined - move to review
    const response =
      context.language === 'en'
        ? 'Let me review your order.'
        : context.language === 'zh'
          ? '让我审查您的订单。'
          : context.language === 'yue'
            ? '讓我審查您嘅訂單。'
            : 'Déjame revisar tu pedido.';

    return {
      response,
      nextState: 'ORDER_REVIEW',
      context,
    };
  }

  /**
   * ORDER_REVIEW state: Read back complete order for confirmation
   */
  private async handleOrderReview(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling ORDER_REVIEW state');

    // Format order summary for reading aloud
    const orderSummary = (this.voiceProvider as any).formatOrderSummary(context);

    const confirmPrompt =
      context.language === 'en'
        ? '\nDoes that look correct? Say yes to proceed to payment.'
        : context.language === 'zh'
          ? '\n这样对吗？说"是"继续付款。'
          : context.language === 'yue'
            ? '\n咁啱唔啱？講"係"繼續付款。'
            : '\n¿Se ve correcto? Di "sí" para proceder al pago.';

    const response = orderSummary + confirmPrompt;

    // Check customer confirmation
    if (intent.intent === 'CONFIRM' || intent.intent === 'READY_TO_PAY') {
      context.orderConfirmed = true;
      return {
        response: 'Great! Let me get your contact information.',
        nextState: 'CUSTOMER_INFO',
        context,
      };
    } else if (intent.intent === 'DENY') {
      return {
        response:
          context.language === 'en'
            ? 'What would you like to change?'
            : context.language === 'zh'
              ? '您想改什么？'
              : context.language === 'yue'
                ? '您想改咩？'
                : '¿Qué te gustaría cambiar?',
        nextState: 'TAKING_ORDER',
        context,
      };
    }

    return {
      response,
      nextState: 'ORDER_REVIEW',
      context,
    };
  }

  /**
   * CUSTOMER_INFO state: Collect phone and delivery info
   */
  private async handleCustomerInfo(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling CUSTOMER_INFO state');

    // In a real implementation, extract phone number from intent
    // For now, we'll use the caller phone
    // const phone = intent.entities.phone || context.customerPhone;

    const response =
      context.language === 'en'
        ? 'Thank you! Now let me process your payment.'
        : context.language === 'zh'
          ? '谢谢！现在让我处理您的付款。'
          : context.language === 'yue'
            ? '謝謝！依家讓我處理您嘅付款。'
            : 'Gracias. Ahora déjame procesar tu pago.';

    return {
      response,
      nextState: 'PAYMENT',
      context,
    };
  }

  /**
   * PAYMENT state: Offer payment options
   */
  private async handlePayment(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling PAYMENT state');

    context.paymentInitiated = true;

    const paymentPrompt = (this.voiceProvider as any).getPaymentPrompt(
      context.language
    );

    // Check customer preference
    if (
      intent.intent === 'CONFIRM' ||
      intent.rawText.toLowerCase().includes('sms') ||
      intent.rawText.toLowerCase().includes('link')
    ) {
      return {
        response: paymentPrompt,
        nextState: 'CONFIRMATION',
        context,
      };
    }

    return {
      response: paymentPrompt,
      nextState: 'CONFIRMATION',
      context,
    };
  }

  /**
   * CONFIRMATION state: Final order confirmation and timing
   */
  private async handleConfirmation(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling CONFIRMATION state');

    const estimatedMinutes = 25; // Placeholder
    const confirmationMessage = (this.voiceProvider as any).getOrderConfirmationMessage(
      context.language,
      estimatedMinutes
    );

    return {
      response: confirmationMessage,
      nextState: 'CLOSING',
      context,
    };
  }

  /**
   * CLOSING state: Thank customer and end call
   */
  private async handleClosing(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log('[AVOS] Handling CLOSING state');

    const closingMessages: Record<SupportedLanguage, string> = {
      en: 'Thank you for your order! Goodbye!',
      zh: '感谢您的订单！再见！',
      yue: '感謝您嘅訂單！再見！',
      es: '¡Gracias por tu pedido! ¡Adiós!',
    };

    return {
      response: closingMessages[context.language],
      nextState: 'CLOSING',
      context,
    };
  }

  /**
   * ERROR_RECOVERY state: Handle comprehension failures
   * 1st fail: rephrase question
   * 2nd fail: offer options
   * 3rd fail: transfer to human
   */
  private async handleErrorRecovery(
    context: DialogContext,
    intent: IntentResult
  ): Promise<StateTransitionResult> {
    console.log(
      `[AVOS] Handling ERROR_RECOVERY state (error count: ${context.errorCount})`
    );

    if (context.errorCount >= context.maxErrors) {
      // Transfer to human
      console.log('[AVOS] Max errors reached, transferring to human');
      const response =
        context.language === 'en'
          ? 'I apologize for the confusion. Let me connect you with a team member.'
          : context.language === 'zh'
            ? '为混淆道歉。让我将您与团队成员联系。'
            : context.language === 'yue'
              ? '為混淆道歉。讓我將您與團隊成員聯繫。'
              : 'Disculpe la confusión. Déjame conectarte con un miembro del equipo.';

      return {
        response,
        nextState: 'TRANSFER_TO_HUMAN',
        context,
      };
    }

    // Recover based on error count
    const response = (this.voiceProvider as any).getErrorRecoveryPrompt(
      context.language,
      context.errorCount
    );

    // Return to previous meaningful state (typically TAKING_ORDER)
    const previousState =
      context.currentState === 'ERROR_RECOVERY' ? 'TAKING_ORDER' : context.currentState;

    return {
      response,
      nextState: previousState,
      context,
    };
  }

  /**
   * Handle unexpected errors
   */
  private handleUnexpectedError(context: DialogContext): StateTransitionResult {
    console.log('[AVOS] Handling unexpected error');

    context.errorCount++;
    const errorMessage =
      context.language === 'en'
        ? 'An error occurred. Please try again.'
        : context.language === 'zh'
          ? '发生了一个错误。请重试。'
          : context.language === 'yue'
            ? '發生咗一個錯誤。請重試。'
            : 'Ocurrió un error. Por favor, inténtalo de nuevo.';

    return {
      response: errorMessage,
      nextState: 'ERROR_RECOVERY',
      context,
    };
  }

  /**
   * Handle error recovery attempt based on error count
   */
  private handleErrorRecoveryAttempt(
    context: DialogContext,
    intent: IntentResult
  ): StateTransitionResult {
    const response = (this.voiceProvider as any).getErrorRecoveryPrompt(
      context.language,
      context.errorCount
    );

    return {
      response,
      nextState:
        context.errorCount >= context.maxErrors ? 'ERROR_RECOVERY' : context.currentState,
      context,
    };
  }

  /**
   * Find a menu item by name (fuzzy search)
   */
  private findMenuItem(query: string): AVOSMenuIndexEntry | undefined {
    const lowerQuery = query.toLowerCase();

    // Exact match first
    let match = this.menuItems.find(
      (item) =>
        item.itemName.toLowerCase() === lowerQuery ||
        item.itemNameZh?.toLowerCase() === lowerQuery ||
        item.itemNameYue?.toLowerCase() === lowerQuery ||
        item.itemNameEs?.toLowerCase() === lowerQuery
    );

    if (match) return match;

    // Alias match
    match = this.menuItems.find((item) =>
      item.aliases.some((alias) => alias.toLowerCase() === lowerQuery)
    );

    if (match) return match;

    // Partial match
    match = this.menuItems.find(
      (item) =>
        item.itemName.toLowerCase().includes(lowerQuery) ||
        item.itemNameZh?.toLowerCase().includes(lowerQuery) ||
        item.itemNameYue?.toLowerCase().includes(lowerQuery) ||
        item.itemNameEs?.toLowerCase().includes(lowerQuery)
    );

    return match;
  }
}
