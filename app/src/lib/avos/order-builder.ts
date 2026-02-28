/**
 * Order Builder for AVOS
 * Manages order construction during a voice conversation
 * Handles item additions, removals, modifications, and final order creation
 */

import {
  AVOSOrderItem,
  AVOSOrder,
  AVOSMenuIndexEntry,
  SupportedLanguage,
} from './types';
import { v4 as uuidv4 } from 'uuid';

export class OrderBuilder {
  private restaurantId: string;
  private menuItems: AVOSMenuIndexEntry[];
  private items: AVOSOrderItem[] = [];
  private subtotalUsd: number = 0;

  constructor(restaurantId: string, menuItems: AVOSMenuIndexEntry[]) {
    console.log(
      `[AVOS] Initializing OrderBuilder for restaurant: ${restaurantId}`
    );
    this.restaurantId = restaurantId;
    this.menuItems = menuItems;
  }

  /**
   * Add item to order
   * @returns The added item
   */
  addItem(
    menuItemId: string,
    quantity: number = 1,
    modifications: string[] = []
  ): AVOSOrderItem {
    console.log(
      `[AVOS] Adding item to order: ${menuItemId} x${quantity} (mods: ${modifications.length})`
    );

    // Find menu item details
    const menuItem = this.menuItems.find((m) => m.menuItemId === menuItemId);
    if (!menuItem) {
      throw new Error(`Menu item not found: ${menuItemId}`);
    }

    // Check if item already in order
    const existingItem = this.items.find(
      (item) =>
        item.menuItemId === menuItemId &&
        JSON.stringify(item.modifications) === JSON.stringify(modifications)
    );

    if (existingItem) {
      // Increment quantity if item with same mods already exists
      console.log(`[AVOS] Item already in order, incrementing quantity`);
      existingItem.quantity += quantity;
      this.subtotalUsd += menuItem.priceUsd * quantity;
      return existingItem;
    }

    // Create new order item
    const orderItem: AVOSOrderItem = {
      menuItemId,
      name: menuItem.itemName,
      quantity,
      priceUsd: menuItem.priceUsd,
      modifications,
    };

    this.items.push(orderItem);
    this.subtotalUsd += menuItem.priceUsd * quantity;

    console.log(
      `[AVOS] Item added to order: ${menuItem.itemName} (price: $${menuItem.priceUsd.toFixed(2)})`
    );

    return orderItem;
  }

  /**
   * Remove item from order by menuItemId
   * @returns true if item was removed, false if not found
   */
  removeItem(menuItemId: string): boolean {
    console.log(`[AVOS] Removing item from order: ${menuItemId}`);

    const index = this.items.findIndex((item) => item.menuItemId === menuItemId);
    if (index === -1) {
      console.log(`[AVOS] Item not found in order: ${menuItemId}`);
      return false;
    }

    const removedItem = this.items[index];
    const itemCost = removedItem.priceUsd * removedItem.quantity;
    this.subtotalUsd -= itemCost;
    this.items.splice(index, 1);

    console.log(
      `[AVOS] Item removed from order: ${removedItem.name} (saved: $${itemCost.toFixed(2)})`
    );

    return true;
  }

  /**
   * Modify item in the order
   * @returns The modified item, or throws if not found
   */
  modifyItem(menuItemId: string, modifications: string[]): AVOSOrderItem {
    console.log(
      `[AVOS] Modifying item in order: ${menuItemId} (new mods: ${modifications.length})`
    );

    const item = this.items.find((i) => i.menuItemId === menuItemId);
    if (!item) {
      throw new Error(`Item not found in order: ${menuItemId}`);
    }

    // Update modifications
    const oldModCount = item.modifications.length;
    item.modifications = modifications;

    console.log(
      `[AVOS] Item modified: ${item.name} (mods: ${oldModCount} -> ${modifications.length})`
    );

    return item;
  }

  /**
   * Get current subtotal
   */
  getSubtotal(): number {
    return Math.round(this.subtotalUsd * 100) / 100; // Round to 2 decimals
  }

  /**
   * Get all items in order
   */
  getItems(): AVOSOrderItem[] {
    return [...this.items]; // Return copy to prevent external modification
  }

  /**
   * Get item count
   */
  getItemCount(): number {
    return this.items.length;
  }

  /**
   * Get total quantity of items (sum of all quantities)
   */
  getTotalQuantity(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Clear the entire order
   */
  clear(): void {
    console.log('[AVOS] Clearing order');
    this.items = [];
    this.subtotalUsd = 0;
  }

  /**
   * Check if order is empty
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Get formatted order summary for TTS (text-to-speech)
   * Formatted naturally for reading aloud in the target language
   */
  getOrderSummary(language: SupportedLanguage): string {
    console.log(`[AVOS] Getting order summary (language: ${language})`);

    if (this.items.length === 0) {
      const emptyMessages: Record<SupportedLanguage, string> = {
        en: 'Your order is empty.',
        zh: '您的订单为空。',
        yue: '您嘅訂單為空。',
        es: 'Su pedido está vacío.',
      };
      return emptyMessages[language];
    }

    // Build item list with formatting
    const itemLines = this.items.map((item) => {
      const quantity = item.quantity > 1 ? ` x${item.quantity}` : '';
      const modsStr =
        item.modifications && item.modifications.length > 0
          ? ` (${item.modifications.join(', ')})`
          : '';
      const itemPrice = (item.priceUsd * item.quantity).toFixed(2);

      return {
        name: item.name,
        quantity,
        mods: modsStr,
        price: itemPrice,
      };
    });

    // Format based on language
    let summary: string;

    switch (language) {
      case 'en':
        summary = 'Your order includes:\n';
        for (const line of itemLines) {
          summary += `- ${line.name}${line.quantity}${line.mods} - $${line.price}\n`;
        }
        summary += `Subtotal: $${this.getSubtotal().toFixed(2)}`;
        break;

      case 'zh':
        summary = '您的订单包括：\n';
        for (const line of itemLines) {
          summary += `- ${line.name}${line.quantity}${line.mods} - $${line.price}\n`;
        }
        summary += `小计：$${this.getSubtotal().toFixed(2)}`;
        break;

      case 'yue':
        summary = '您嘅訂單包括：\n';
        for (const line of itemLines) {
          summary += `- ${line.name}${line.quantity}${line.mods} - $${line.price}\n`;
        }
        summary += `小計：$${this.getSubtotal().toFixed(2)}`;
        break;

      case 'es':
        summary = 'Su pedido incluye:\n';
        for (const line of itemLines) {
          summary += `- ${line.name}${line.quantity}${line.mods} - $${line.price}\n`;
        }
        summary += `Subtotal: $${this.getSubtotal().toFixed(2)}`;
        break;

      default:
        summary = 'Order items: ' + itemLines.map((l) => l.name).join(', ');
    }

    return summary;
  }

  /**
   * Get detailed item list for display
   */
  getItemList(language: SupportedLanguage): Array<{
    name: string;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
    modifications: string[];
  }> {
    return this.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      pricePerUnit: item.priceUsd,
      totalPrice: Math.round(item.priceUsd * item.quantity * 100) / 100,
      modifications: item.modifications,
    }));
  }

  /**
   * Convert current order to AVOSOrder for database storage
   * @param callId - Reference to the AVOS call
   * @param customerPhone - Customer phone number in E.164 format
   * @param taxUsd - Calculated tax amount
   * @param foodyAmount - Amount in Foody tokens
   * @param exchangeRate - USD to Foody exchange rate
   * @returns Partial AVOSOrder (missing id, createdAt which should be set during storage)
   */
  toAVOSOrder(
    callId: string,
    customerPhone: string,
    taxUsd: number,
    foodyAmount: number,
    exchangeRate: number,
    paymentMethod: 'foody_wallet' | 'sms_link' = 'sms_link'
  ): Omit<AVOSOrder, 'id' | 'createdAt'> {
    console.log(
      `[AVOS] Converting OrderBuilder to AVOSOrder (call: ${callId}, tax: $${taxUsd.toFixed(2)})`
    );

    const subtotal = this.getSubtotal();
    const total = Math.round((subtotal + taxUsd) * 100) / 100;

    return {
      callId,
      restaurantId: this.restaurantId,
      customerPhone,
      items: [...this.items],
      subtotalUsd: subtotal,
      taxUsd: Math.round(taxUsd * 100) / 100,
      totalUsd: total,
      foodyAmount,
      exchangeRate,
      paymentMethod,
      paymentStatus: 'pending',
    };
  }

  /**
   * Get order analytics
   */
  getAnalytics(): {
    itemCount: number;
    totalQuantity: number;
    subtotal: number;
    avgPricePerItem: number;
    mostExpensiveItem: AVOSOrderItem | null;
    cheapestItem: AVOSOrderItem | null;
  } {
    const subtotal = this.getSubtotal();
    const totalQty = this.getTotalQuantity();

    let mostExpensive: AVOSOrderItem | null = null;
    let cheapest: AVOSOrderItem | null = null;

    for (const item of this.items) {
      if (!mostExpensive || item.priceUsd > mostExpensive.priceUsd) {
        mostExpensive = item;
      }
      if (!cheapest || item.priceUsd < cheapest.priceUsd) {
        cheapest = item;
      }
    }

    return {
      itemCount: this.items.length,
      totalQuantity: totalQty,
      subtotal,
      avgPricePerItem:
        this.items.length > 0
          ? Math.round((subtotal / this.items.length) * 100) / 100
          : 0,
      mostExpensiveItem: mostExpensive,
      cheapestItem: cheapest,
    };
  }

  /**
   * Validate order is ready for checkout
   * @returns Object with validation result and any error messages
   */
  validate(): {
    isValid: boolean;
    errors: string[];
  } {
    console.log('[AVOS] Validating order');

    const errors: string[] = [];

    if (this.items.length === 0) {
      errors.push('Order is empty');
    }

    if (this.subtotalUsd <= 0) {
      errors.push('Order subtotal must be greater than 0');
    }

    for (const item of this.items) {
      if (item.quantity <= 0) {
        errors.push(`Invalid quantity for ${item.name}: ${item.quantity}`);
      }

      if (item.priceUsd < 0) {
        errors.push(`Invalid price for ${item.name}: $${item.priceUsd}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
