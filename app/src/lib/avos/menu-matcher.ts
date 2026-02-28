/**
 * Menu Matcher - Core matching engine for AVOS menu intelligence system
 * Supports multiple matching strategies: exact, alias, fuzzy, and phonetic
 * Zero external dependencies - self-contained solution
 */

import { getPhoneticVariations, normalizeForSearch, generateSearchTerms, arePhoneticallyRelated } from './phonetic-utils';

/**
 * Type definitions for the menu matching system
 */
export type SupportedLanguage = 'en' | 'zh' | 'yue' | 'es';

export interface AVOSMenuIndexEntry {
  id: string;
  restaurantId: string;
  name: string;
  nameZh?: string;
  nameYue?: string;
  nameEs?: string;
  category: string;
  price: number;
  description?: string;
  aliases?: string[]; // Alternative names/common spellings
  aliases_jsonb?: Record<string, string[]>; // JSON format for Supabase
  available: boolean;
  isUpsellItem?: boolean; // Drinks, desserts, soups
  searchTerms?: string; // Pre-computed search index
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MenuMatch {
  item: AVOSMenuIndexEntry;
  confidence: number; // 0-1 score
  matchType: 'exact' | 'alias' | 'fuzzy' | 'phonetic';
  matchedTerm?: string;
}

export interface QuantityExtraction {
  quantity: number;
  itemText: string;
}

export interface ModificationExtraction {
  modifications: string[];
  cleanText: string;
}

/**
 * Levenshtein distance calculation for fuzzy matching
 * Measures the minimum number of single-character edits required
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the dp table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/**
 * Main MenuMatcher class implementing multi-strategy matching
 */
export class MenuMatcher {
  private menuItems: AVOSMenuIndexEntry[] = [];
  private restaurantId: string;
  private searchIndex: Map<string, AVOSMenuIndexEntry[]> = new Map();
  private readonly FUZZY_THRESHOLD = 0.65;
  private readonly PHONETIC_THRESHOLD = 0.7;

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId;
  }

  /**
   * Load menu items from database/source
   * In production, would fetch from Supabase
   */
  async loadMenu(items: AVOSMenuIndexEntry[]): Promise<void> {
    this.menuItems = items;
    this.buildSearchIndex();
  }

  /**
   * Build internal search index for faster matching
   */
  private buildSearchIndex(): void {
    this.searchIndex.clear();

    for (const item of this.menuItems) {
      // Index by normalized name
      const nameLower = normalizeForSearch(item.name);
      if (!this.searchIndex.has(nameLower)) {
        this.searchIndex.set(nameLower, []);
      }
      this.searchIndex.get(nameLower)!.push(item);

      // Index by normalized Chinese name
      if (item.nameZh) {
        const zhLower = normalizeForSearch(item.nameZh);
        if (!this.searchIndex.has(zhLower)) {
          this.searchIndex.set(zhLower, []);
        }
        this.searchIndex.get(zhLower)!.push(item);
      }

      // Index by aliases
      if (item.aliases && Array.isArray(item.aliases)) {
        item.aliases.forEach(alias => {
          const aliasLower = normalizeForSearch(alias);
          if (!this.searchIndex.has(aliasLower)) {
            this.searchIndex.set(aliasLower, []);
          }
          this.searchIndex.get(aliasLower)!.push(item);
        });
      }
    }
  }

  /**
   * Main matching function - tries 4 strategies in order of specificity
   * Returns array of matches ranked by confidence
   */
  matchItem(spokenText: string, language: SupportedLanguage = 'en'): MenuMatch[] {
    const cleanText = normalizeForSearch(spokenText);

    if (!cleanText || this.menuItems.length === 0) {
      return [];
    }

    const matches: MenuMatch[] = [];

    // Strategy 1: Exact match (case-insensitive, normalized)
    const exactMatches = this.exactMatch(cleanText);
    matches.push(...exactMatches);

    // Strategy 2: Alias lookup
    const aliasMatches = this.aliasMatch(cleanText);
    matches.push(
      ...aliasMatches.filter(
        m => !matches.some(existing => existing.item.id === m.item.id)
      )
    );

    // Strategy 3: Fuzzy string similarity
    const fuzzyMatches = this.fuzzyMatch(cleanText);
    matches.push(
      ...fuzzyMatches.filter(
        m => !matches.some(existing => existing.item.id === m.item.id)
      )
    );

    // Strategy 4: Phonetic match
    const phoneticMatches = this.phoneticMatch(cleanText);
    matches.push(
      ...phoneticMatches.filter(
        m => !matches.some(existing => existing.item.id === m.item.id)
      )
    );

    // Sort by confidence (descending) and return
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Strategy 1: Exact name match (case-insensitive, normalized)
   */
  private exactMatch(query: string): MenuMatch[] {
    const matches: MenuMatch[] = [];

    for (const item of this.menuItems) {
      const itemNameNorm = normalizeForSearch(item.name);
      if (itemNameNorm === query) {
        matches.push({
          item,
          confidence: 1.0,
          matchType: 'exact',
          matchedTerm: item.name,
        });
      }

      // Also check Chinese name
      if (item.nameZh) {
        const zhNorm = normalizeForSearch(item.nameZh);
        if (zhNorm === query) {
          matches.push({
            item,
            confidence: 1.0,
            matchType: 'exact',
            matchedTerm: item.nameZh,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Strategy 2: Alias lookup (check aliases JSONB and array)
   */
  private aliasMatch(query: string): MenuMatch[] {
    const matches: MenuMatch[] = [];

    for (const item of this.menuItems) {
      let aliasesArray: string[] = [];

      // Handle both array and JSONB alias formats
      if (item.aliases && Array.isArray(item.aliases)) {
        aliasesArray = item.aliases;
      }

      if (item.aliases_jsonb) {
        // Flatten JSONB aliases (they're usually organized by type)
        Object.values(item.aliases_jsonb).forEach(list => {
          if (Array.isArray(list)) {
            aliasesArray.push(...list);
          }
        });
      }

      for (const alias of aliasesArray) {
        const aliasNorm = normalizeForSearch(alias);
        if (aliasNorm === query) {
          matches.push({
            item,
            confidence: 0.95,
            matchType: 'alias',
            matchedTerm: alias,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Strategy 3: Fuzzy string similarity using Levenshtein distance
   */
  private fuzzyMatch(query: string): MenuMatch[] {
    const matches: MenuMatch[] = [];
    const processedItems = new Set<string>();

    for (const item of this.menuItems) {
      if (processedItems.has(item.id)) continue;

      let bestScore = 0;
      let matchedTerm = '';

      // Compare against item name
      const itemNameNorm = normalizeForSearch(item.name);
      let similarity = stringSimilarity(query, itemNameNorm);
      if (similarity > bestScore) {
        bestScore = similarity;
        matchedTerm = item.name;
      }

      // Compare against Chinese name
      if (item.nameZh) {
        const zhNorm = normalizeForSearch(item.nameZh);
        similarity = stringSimilarity(query, zhNorm);
        if (similarity > bestScore) {
          bestScore = similarity;
          matchedTerm = item.nameZh;
        }
      }

      // Compare against aliases
      if (item.aliases && Array.isArray(item.aliases)) {
        for (const alias of item.aliases) {
          const aliasNorm = normalizeForSearch(alias);
          similarity = stringSimilarity(query, aliasNorm);
          if (similarity > bestScore) {
            bestScore = similarity;
            matchedTerm = alias;
          }
        }
      }

      // Only include if above threshold
      if (bestScore >= this.FUZZY_THRESHOLD && bestScore < 1.0) {
        matches.push({
          item,
          confidence: bestScore,
          matchType: 'fuzzy',
          matchedTerm,
        });
        processedItems.add(item.id);
      }
    }

    return matches;
  }

  /**
   * Strategy 4: Phonetic match using pinyin/jyutping/transliteration
   */
  private phoneticMatch(query: string): MenuMatch[] {
    const matches: MenuMatch[] = [];
    const processedItems = new Set<string>();

    // Get phonetic variations of the query
    const queryVariations = getPhoneticVariations(query);

    for (const item of this.menuItems) {
      if (processedItems.has(item.id)) continue;

      let bestScore = 0;
      let matchedTerm = '';

      // Get variations for item names
      const nameVariations = getPhoneticVariations(item.name);
      const zhVariations = item.nameZh ? getPhoneticVariations(item.nameZh) : [];
      const allItemVariations = [...nameVariations, ...zhVariations];

      // Check if any query variation matches any item variation
      for (const queryVar of queryVariations) {
        const queryVarNorm = normalizeForSearch(queryVar);

        for (const itemVar of allItemVariations) {
          const itemVarNorm = normalizeForSearch(itemVar);

          // Direct match
          if (queryVarNorm === itemVarNorm) {
            bestScore = 1.0;
            matchedTerm = item.name;
            break;
          }

          // Phonetic relationship check
          if (arePhoneticallyRelated(queryVar, itemVar, this.PHONETIC_THRESHOLD)) {
            const similarity = stringSimilarity(queryVarNorm, itemVarNorm);
            if (similarity > bestScore) {
              bestScore = similarity;
              matchedTerm = item.name;
            }
          }
        }

        if (bestScore > 0) break;
      }

      if (bestScore >= this.PHONETIC_THRESHOLD && bestScore < 1.0) {
        matches.push({
          item,
          confidence: bestScore,
          matchType: 'phonetic',
          matchedTerm,
        });
        processedItems.add(item.id);
      }
    }

    return matches;
  }

  /**
   * Extract quantity from spoken text
   * Handles: EN (one/two/three, 1/2/3)
   *          ZH (一份/两份, 一个/两个)
   *          YUE (一份/兩份)
   *          ES (uno/dos/tres)
   */
  static extractQuantity(text: string, language: SupportedLanguage = 'en'): QuantityExtraction {
    const lowerText = text.toLowerCase();

    // English number words
    const enNumbers: Record<string, number> = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      'a': 1, 'an': 1, 'a couple of': 2, 'a few': 3,
    };

    // Spanish number words
    const esNumbers: Record<string, number> = {
      cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
      seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    };

    // Chinese/Cantonese number words
    const zhNumbers: Record<string, number> = {
      一: 1, 两: 2, 三: 3, 四: 4, 五: 5,
      六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
      兩: 2, // Cantonese
    };

    let quantity = 1;
    let quantityPattern = '';

    // Try to match numeric digits first
    const digitMatch = text.match(/\b(\d+)\s*(?:份|个|份|杯|碗|盘)?/);
    if (digitMatch) {
      quantity = parseInt(digitMatch[1], 10);
      quantityPattern = digitMatch[0];
    }

    if (language === 'en' || language === 'es') {
      // English and Spanish handling
      const numberMap = language === 'en' ? enNumbers : esNumbers;

      for (const [word, num] of Object.entries(numberMap)) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lowerText)) {
          quantity = num;
          quantityPattern = word;
          break;
        }
      }
    } else if (language === 'zh' || language === 'yue') {
      // Chinese and Cantonese handling
      for (const [char, num] of Object.entries(zhNumbers)) {
        if (text.includes(char)) {
          quantity = num;
          quantityPattern = char;
          break;
        }
      }
    }

    // Remove quantity pattern from text to get clean item name
    const cleanText = quantityPattern
      ? text.replace(new RegExp(quantityPattern, 'i'), '').trim()
      : text;

    return {
      quantity: Math.max(1, quantity),
      itemText: cleanText,
    };
  }

  /**
   * Extract modifications/special requests from spoken text
   * Handles: EN (no MSG, extra spicy, mild, no onion, with extra sauce)
   *          ZH (不要味精, 加辣, 少盐, 多放酱)
   *          ES (sin MSG, extra picante)
   */
  static extractModifications(text: string, language: SupportedLanguage = 'en'): ModificationExtraction {
    const modifications: string[] = [];
    let cleanText = text;

    // English modifications
    const enModifications = [
      { pattern: /no\s+(msg|monosodium glutamate|onion|garlic|salt|sugar)/gi, replacement: 'no $1' },
      { pattern: /extra\s+(spicy|hot|sauce|salt|sugar)/gi, replacement: 'extra $1' },
      { pattern: /mild|light salt|low sodium/gi, replacement: (match: string) => match },
      { pattern: /well done|medium|rare/gi, replacement: (match: string) => match },
      { pattern: /with (extra |more |less )?sauce/gi, replacement: (match: string) => match },
      { pattern: /no ice|extra ice/gi, replacement: (match: string) => match },
    ];

    // Chinese modifications
    const zhModifications = [
      { pattern: /不要(味精|洋葱|大蒜|盐|糖)/g, replacement: '不要$1' },
      { pattern: /(加|多)(辣|辣椒|酱|盐|糖)/g, replacement: '$1$2' },
      { pattern: /少(盐|油|糖)/g, replacement: '少$1' },
      { pattern: /(清汤|清油|不油腻)/g, replacement: '$1' },
      { pattern: /不放(味精|洋葱|大蒜)/g, replacement: '不放$1' },
    ];

    // Spanish modifications
    const esModifications = [
      { pattern: /sin\s+(msg|cebolla|ajo|sal|azúcar)/gi, replacement: 'sin $1' },
      { pattern: /extra\s+(picante|hot|salsa|sal|azúcar)/gi, replacement: 'extra $1' },
      { pattern: /poco\s+(sal|azúcar|picante)/gi, replacement: 'poco $1' },
      { pattern: /(sin hielo|con hielo)/gi, replacement: '$1' },
    ];

    // Apply modifications based on language
    let patterns: Array<{ pattern: RegExp; replacement: string | ((match: string) => string) }> = [];

    if (language === 'en') {
      patterns = enModifications;
    } else if (language === 'zh' || language === 'yue') {
      patterns = zhModifications;
    } else if (language === 'es') {
      patterns = esModifications;
    }

    // Extract modifications
    for (const { pattern, replacement } of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!modifications.includes(match)) {
            modifications.push(match);
          }
        });
        // Remove from clean text
        cleanText = cleanText.replace(pattern, '').trim();
      }
    }

    return {
      modifications,
      cleanText,
    };
  }

  /**
   * Get available item categories
   */
  getAvailableCategories(): string[] {
    const categories = new Set<string>();
    for (const item of this.menuItems) {
      if (item.available) {
        categories.add(item.category);
      }
    }
    return Array.from(categories).sort();
  }

  /**
   * Get items by category
   */
  getItemsByCategory(category: string): AVOSMenuIndexEntry[] {
    return this.menuItems.filter(
      item => item.category === category && item.available
    );
  }

  /**
   * Suggest upsell items (drinks, soups, desserts not in current order)
   */
  suggestUpsell(currentOrderItemIds: string[]): AVOSMenuIndexEntry[] {
    const currentSet = new Set(currentOrderItemIds);

    // Filter to potential upsell items
    const upsellCandidates = this.menuItems.filter(
      item =>
        item.available &&
        !currentSet.has(item.id) &&
        (item.isUpsellItem === true ||
          this.isUpsellCategory(item.category))
    );

    // Return limited set of recommendations (e.g., top 3)
    return upsellCandidates.slice(0, 3);
  }

  /**
   * Check if category is typically an upsell category
   */
  private isUpsellCategory(category: string): boolean {
    const upsellCategories = [
      'drinks', 'beverages', 'soup', 'soups', 'soup',
      'dessert', 'desserts', 'drink',
      'side', 'sides',
    ];

    return upsellCategories.some(
      cat => category.toLowerCase().includes(cat)
    );
  }

  /**
   * Get all menu items for debugging/management
   */
  getAllItems(): AVOSMenuIndexEntry[] {
    return [...this.menuItems];
  }

  /**
   * Update menu items
   */
  updateItems(items: AVOSMenuIndexEntry[]): void {
    this.menuItems = items;
    this.buildSearchIndex();
  }

  /**
   * Clear all loaded data
   */
  clear(): void {
    this.menuItems = [];
    this.searchIndex.clear();
  }
}
