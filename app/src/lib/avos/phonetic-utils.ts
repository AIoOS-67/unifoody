/**
 * Phonetic utilities for multi-language menu matching
 * Supports Chinese (Mandarin/Pinyin), Cantonese (Jyutping), Spanish, and English
 * Zero external dependencies - self-contained solution
 */

// Common Chinese (Mandarin) dish mappings with pinyin and English variants
const CHINESE_DISH_MAP = new Map<string, string[]>([
  // Chicken dishes
  ["宫保鸡丁", ["gong bao ji ding", "kung pao chicken", "kungpao", "gongbao", "gung pao"]],
  ["左宗棠鸡", ["zuo zong tang ji", "general tso chicken", "general tsos", "general tsao", "zuozong"]],
  ["鸡蛋炒饭", ["ji dan chao fan", "egg fried rice", "egfried rice", "jidan chao fan"]],
  ["白切鸡", ["bai qie ji", "poached chicken", "white cut chicken", "baiqi"]],
  ["辣子鸡", ["la zi ji", "spicy chicken", "chicken with chilies", "laziji"]],
  ["过油鸡", ["guo you ji", "fried chicken", "oil fried chicken"]],
  ["鸡肉炒面", ["ji rou chao mian", "chicken chow mein", "chicken fried noodles"]],

  // Pork dishes
  ["糖醋排骨", ["tang cu pai gu", "sweet and sour pork", "sweet sour ribs", "tangcu"]],
  ["红烧肉", ["hong shao rou", "braised pork belly", "hong shao", "hongshao"]],
  ["干煸牛河", ["gan bian niu he", "beef chow fun", "ganbianniu"]],
  ["蚝油牛肉", ["hao you niu rou", "oyster beef", "beef with oyster sauce"]],
  ["京酱肉丝", ["jing jiang rou si", "peking pork strips", "jingjiang"]],
  ["回锅肉", ["hui guo rou", "twice cooked pork", "huiguo", "twice cooked"]],
  ["东坡肉", ["dong po rou", "dongpo pork", "su dongpo pork"]],
  ["卤蛋", ["lu dan", "tea egg", "marbled egg", "ludan"]],

  // Beef dishes
  ["牛肉面", ["niu rou mian", "beef noodle", "beef noodle soup"]],
  ["黑椒牛柳", ["hei jiao niu liu", "black pepper beef", "pepper beef strips"]],
  ["蚝油牛肉炒饭", ["hao you niu rou chao fan", "beef fried rice with oyster sauce"]],
  ["干煸牛肉", ["gan bian niu rou", "dry fried beef", "ganbian beef"]],
  ["番茄牛肉", ["fan qie niu rou", "tomato beef", "beef with tomato"]],

  // Seafood dishes
  ["虾仁炒饭", ["xia ren chao fan", "shrimp fried rice", "prawn fried rice"]],
  ["清蒸鱼", ["qing zheng yu", "steamed fish", "qingzheng"]],
  ["糖醋鱼", ["tang cu yu", "sweet and sour fish", "tangcu fish"]],
  ["剁椒鱼头", ["duo jiao yu tou", "spicy fish head", "duojiao"]],
  ["鱼香肉丝", ["yu xiang rou si", "fish fragrant pork", "yu xiang"]],
  ["蒜泥白肉", ["suan ni bai rou", "pork with garlic sauce", "suanni"]],
  ["麻辣小龙虾", ["ma la xiao long xia", "spicy crayfish", "chili crayfish"]],
  ["油爆虾", ["you bao xia", "stir fried shrimp", "youbao"]],
  ["蚝油扇贝", ["hao you shan bei", "scallop with oyster sauce"]],

  // Rice dishes
  ["炒饭", ["chao fan", "fried rice", "chafan", "chaofan"]],
  ["番茄鸡蛋炒饭", ["fan qie ji dan chao fan", "tomato egg fried rice"]],
  ["豉油炒饭", ["chi you chao fan", "soy sauce fried rice"]],
  ["叉烧炒饭", ["cha shao chao fan", "bbq pork fried rice"]],
  ["青豆玉米炒饭", ["qing dou yu mi chao fan", "pea corn fried rice"]],
  ["五彩炒饭", ["wu cai chao fan", "five color fried rice"]],
  ["蛋炒饭", ["dan chao fan", "egg fried rice", "egfried rice"]],
  ["三味炒饭", ["san wei chao fan", "three flavor fried rice"]],

  // Noodle dishes
  ["炒面", ["chao mian", "lo mein", "lomein", "chow mein", "chao main"]],
  ["鸡蛋面", ["ji dan mian", "egg noodle", "egg fried noodles"]],
  ["牛肉面", ["niu rou mian", "beef noodles", "beef noodle soup"]],
  ["麻辣面", ["ma la mian", "spicy numbing noodles", "malian"]],
  ["炸酱面", ["zha jiang mian", "noodles with sauce", "zhajian"]],
  ["汤面", ["tang mian", "noodle soup", "soup noodles"]],
  ["刀削面", ["dao xiao mian", "shaved noodles", "daoxiao"]],
  ["兰州拉面", ["lan zhou la mian", "lanzhou pulled noodles", "lanzhou"]],
  ["红油面", ["hong you mian", "spicy oil noodles", "hongyou"]],

  // Soup dishes
  ["酸辣汤", ["suan la tang", "hot and sour soup", "sour spicy soup"]],
  ["云吞汤", ["yun tun tang", "wonton soup", "won ton soup", "wonton"]],
  ["鸡蛋汤", ["ji dan tang", "egg drop soup", "egg soup"]],
  ["玉米汤", ["yu mi tang", "corn soup", "corn chowder"]],
  ["番茄汤", ["fan qie tang", "tomato soup", "tomato broth"]],
  ["青菜汤", ["qing cai tang", "vegetable soup", "greens soup"]],
  ["冬瓜汤", ["dong gua tang", "winter melon soup"]],
  ["鱼翅汤", ["yu chi tang", "shark fin soup", "yuchi"]],
  ["老火汤", ["lao huo tang", "slow cooked soup", "laohuo"]],
  ["紫菜汤", ["zi cai tang", "seaweed soup", "purple seaweed soup"]],
  ["莼菜汤", ["chun cai tang", "water shield soup"]],

  // Tofu & Vegetable dishes
  ["麻婆豆腐", ["ma po dou fu", "mapo tofu", "mapotofu", "spicy tofu"]],
  ["豆腐炒鸡蛋", ["dou fu chao ji dan", "tofu scrambled eggs", "tofu egg"]],
  ["炸豆腐", ["zha dou fu", "fried tofu", "tofu puffs"]],
  ["家常豆腐", ["jia chang dou fu", "home style tofu"]],
  ["豉汁豆腐", ["chi zhi dou fu", "tofu with black bean sauce"]],
  ["清炒时蔬", ["qing chao shi shu", "stir fried seasonal vegetables"]],
  ["蒜蓉西兰花", ["suan rong xi lan hua", "garlic broccoli"]],
  ["炒空心菜", ["chao kong xin cai", "stir fried water spinach"]],
  ["四季豆炒肉", ["si ji dou chao rou", "green bean with meat"]],
  ["玉米粒炒虾仁", ["yu mi li chao xia ren", "corn shrimp"]],

  // Duck dishes
  ["北京烤鸭", ["bei jing kao ya", "peking duck", "beijing duck", "peking roast"]],
  ["卤水鸭", ["lu shui ya", "braised duck", "soy sauce duck"]],
  ["烤鸭腿", ["kao ya tui", "roasted duck leg"]],
  ["鸭肉炒面", ["ya rou chao mian", "duck noodle", "duck chow mein"]],

  // Dumpling & Appetizer dishes
  ["饺子", ["jiao zi", "dumpling", "dumplings"]],
  ["水饺", ["shui jiao", "boiled dumplings", "water dumpling"]],
  ["煎饺", ["jian jiao", "pan fried dumplings", "fried dumpling"]],
  ["春卷", ["chun juan", "spring roll", "egg roll"]],
  ["炸春卷", ["zha chun juan", "fried spring roll"]],
  ["馄饨", ["hun tun", "wonton", "woon ton"]],
  ["烧卖", ["shao mai", "shumai", "pork and shrimp dumpling"]],
  ["粉蒸肉", ["fen zheng rou", "sticky rice wrapped meat"]],

  // Dim sum related
  ["点心", ["dian xin", "dim sum", "yum cha", "dimsum"]],
  ["叉烧包", ["cha shao bao", "bbq pork bun", "char siu bao"]],
  ["竹筒鸡", ["zhu tong ji", "bamboo chicken", "chicken in bamboo"]],
  ["蒸蛋", ["zheng dan", "steamed egg custard"]],
  ["蛋挞", ["dan ta", "egg tart", "custard tart"]],

  // Other popular dishes
  ["八宝饭", ["ba bao fan", "eight treasure rice", "babao"]],
  ["宫廷鸡尾虾", ["gong ting ji wei xia", "imperial shrimp", "palace shrimp"]],
  ["芙蓉蛋炒饭", ["fu rong dan chao fan", "hibiscus egg fried rice"]],
  ["咕噜肉", ["gu lu rou", "sweet and sour pork", "gulu pork"]],
  ["豉油皇炒饭", ["chi you huang chao fan", "soy sauce king fried rice"]],
  ["辣子肉", ["la zi rou", "spicy meat", "chili meat"]],
  ["水煮肉片", ["shui zhu rou pian", "boiled meat slices", "shuizhu"]],
  ["鱼香茄子", ["yu xiang qie zi", "fish fragrant eggplant"]],
  ["虫草花炖鸡", ["chong cao hua dun ji", "cordyceps flower chicken soup"]],
  ["冬虫夏草炖鸡", ["dong chong xia cao dun ji", "cordyceps chicken soup"]],
]);

// Cantonese (粤语/Jyutping) dish mappings
const CANTONESE_DISH_MAP = new Map<string, string[]>([
  ["点心", ["dim sam", "dim sum", "yum cha", "dimsum"]],
  ["叉烧", ["char siu", "cha siu", "bbq pork", "charsiu"]],
  ["虾饺", ["har gow", "ha gao", "hargao", "shrimp dumpling"]],
  ["烧卖", ["siu mai", "shumai", "siu mai", "pork dumpling"]],
  ["肠粉", ["cheung fun", "rice noodle roll", "cheung fun", "chong fun"]],
  ["蒸排骨", ["zing pái gwat", "steamed spareribs", "steamed pork ribs"]],
  ["鸡脚", ["gai geok", "chicken feet", "chicken claw"]],
  ["鸭翅", ["aap ci", "duck wings"]],
  ["猪皮", ["zyu pei", "pork skin"]],
  ["牛肉丸", ["ngau yuk yuen", "beef ball", "beef balls"]],
  ["鱼丸", ["yu yuen", "fish ball", "fish balls"]],
  ["春卷", ["chun gyun", "spring roll", "spring rolls"]],
  ["炸鬼佬", ["zaa gwai lou", "foreign fried item"]],
  ["蛋挞", ["daan taat", "egg tart", "custard tart"]],
  ["纳豆", ["naa tou", "natto"]],
  ["榨菜", ["zaa choi", "pickled vegetable"]],
  ["糯米鸡", ["no mai gai", "sticky rice chicken"]],
  ["叉烧包", ["char siu bao", "bbq pork bun"]],
  ["豉汁排骨", ["chi zap pái gwat", "black bean pork ribs"]],
  ["鲜虾肠粉", ["sin haa cheung fun", "shrimp rice noodle roll"]],
  ["烧鸭", ["siu aap", "roasted duck", "siu duck"]],
  ["烧鹅", ["siu ngo", "roasted goose", "roasted duck"]],
  ["白切鸡", ["baak chit gai", "poached chicken", "white cut chicken"]],
  ["豉油鸡", ["chi you gai", "soy sauce chicken"]],
  ["鸡汤", ["gai tong", "chicken soup"]],
  ["鱼汤", ["yu tong", "fish soup"]],
  ["冬瓜汤", ["dong gua tong", "winter melon soup"]],
  ["虫草花汤", ["chong cao fa tong", "cordyceps flower soup"]],
  ["糖水", ["tong sui", "sweet soup", "dessert soup"]],
  ["红豆薏米", ["hung dau jai mai", "red bean job tears"]],
  ["芝麻糊", ["ji maa wu", "sesame paste"]],
  ["绿豆糕", ["luk dau gou", "green bean cake"]],
  ["蛋挞", ["daan taat", "egg tart"]],
  ["酥皮糕", ["sou pei gou", "crispy skin cake"]],
  ["叉烧炒饭", ["char siu chao fan", "bbq fried rice"]],
  ["蛋炒饭", ["daan chao fan", "egg fried rice"]],
  ["虾仁炒饭", ["ha yan chao fan", "shrimp fried rice"]],
  ["豉油炒饭", ["chi you chao fan", "soy sauce fried rice"]],
  ["鸡肉炒面", ["gai yuk chao min", "chicken chow mein"]],
  ["牛肉炒面", ["ngau yuk chao min", "beef chow mein"]],
  ["虾炒面", ["ha chao min", "shrimp chow mein"]],
  ["斋炒面", ["zaai chao min", "vegetarian chow mein"]],
]);

// Spanish common food terms
const SPANISH_FOOD_MAP = new Map<string, string[]>([
  ["arroz frito", ["fried rice", "arroz frito"]],
  ["pollo", ["chicken", "pollo", "pollo asado"]],
  ["cerdo", ["pork", "cerdo", "puerco"]],
  ["camarones", ["shrimp", "camarones", "camaron"]],
  ["pescado", ["fish", "pescado"]],
  ["carne", ["meat", "carne", "beef"]],
  ["tallarín", ["noodle", "tallarín", "noodles"]],
  ["sopa", ["soup", "sopa"]],
  ["caldo", ["broth", "caldo"]],
  ["verdura", ["vegetable", "verdura", "vegetables"]],
  ["tomate", ["tomato", "tomate", "tomatoes"]],
  ["cebolla", ["onion", "cebolla", "onions"]],
  ["ajo", ["garlic", "ajo"]],
  ["chile", ["chili", "chile", "chili pepper"]],
  ["picante", ["spicy", "picante"]],
  ["dulce", ["sweet", "dulce"]],
  ["salado", ["salty", "salado"]],
  ["huevo", ["egg", "huevo", "eggs"]],
  ["arroz", ["rice", "arroz"]],
  ["pan", ["bread", "pan"]],
  ["ensalada", ["salad", "ensalada"]],
  ["frito", ["fried", "frito"]],
  ["asado", ["roasted", "asado"]],
  ["cocido", ["cooked", "cocido"]],
  ["vapor", ["steamed", "vapor"]],
  ["salsa", ["sauce", "salsa"]],
  ["aceite", ["oil", "aceite"]],
  ["vinagre", ["vinegar", "vinagre"]],
  ["pimienta", ["pepper", "pimienta"]],
  ["sal", ["salt", "sal"]],
]);

/**
 * Get all phonetic variations for a given dish name
 * Searches across Chinese, Cantonese, Spanish maps
 */
export function getPhoneticVariations(itemName: string): string[] {
  const normalized = itemName.trim().toLowerCase();

  // Check Chinese dishes
  for (const [chinese, variations] of CHINESE_DISH_MAP) {
    if (normalized === chinese || variations.some(v => v.toLowerCase() === normalized)) {
      return variations;
    }
  }

  // Check Cantonese dishes
  for (const [cantonese, variations] of CANTONESE_DISH_MAP) {
    if (normalized === cantonese || variations.some(v => v.toLowerCase() === normalized)) {
      return variations;
    }
  }

  // Check Spanish dishes
  for (const [spanish, variations] of SPANISH_FOOD_MAP) {
    if (normalized === spanish || variations.some(v => v.toLowerCase() === normalized)) {
      return variations;
    }
  }

  // No variations found
  return [normalized];
}

/**
 * Normalize text for phonetic search:
 * - Convert to lowercase
 * - Remove diacritics and tone marks
 * - Normalize whitespace
 * - Remove common punctuation
 */
export function normalizeForSearch(text: string): string {
  if (!text) return "";

  let normalized = text.toLowerCase().trim();

  // Remove Chinese tone marks (ā á ǎ à etc.)
  normalized = normalized
    .replace(/[āáǎà]/g, "a")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ūúǔù]/g, "u")
    .replace(/[ǖǘǚǜ]/g, "v")
    .replace(/[ń]/g, "n");

  // Remove Spanish diacritics
  normalized = normalized
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(/ü/g, "u")
    .replace(/ñ/g, "n");

  // Normalize whitespace (multiple spaces to single space)
  normalized = normalized.replace(/\s+/g, " ");

  // Remove common punctuation and special characters
  normalized = normalized.replace(/[.,!?;:\-'"()[\]{}]/g, "");

  return normalized;
}

/**
 * Generate comprehensive search terms for a menu item
 * Combines all variants and language versions
 */
export function generateSearchTerms(
  itemName: string,
  nameZh?: string,
  nameYue?: string,
  nameEs?: string
): string {
  const terms: Set<string> = new Set();

  // Add original name
  if (itemName) {
    terms.add(normalizeForSearch(itemName));
  }

  // Add Chinese variants if provided
  if (nameZh) {
    const zhVariations = getPhoneticVariations(nameZh);
    zhVariations.forEach(v => terms.add(normalizeForSearch(v)));
  }

  // Add Cantonese variants if provided
  if (nameYue) {
    const yueVariations = getPhoneticVariations(nameYue);
    yueVariations.forEach(v => terms.add(normalizeForSearch(v)));
  }

  // Add Spanish variants if provided
  if (nameEs) {
    const esVariations = getPhoneticVariations(nameEs);
    esVariations.forEach(v => terms.add(normalizeForSearch(v)));
  }

  // Return all terms joined with spaces for easy substring searching
  return Array.from(terms).join(" ");
}

/**
 * Find all menu items that contain phonetic variations of the query
 * Useful for fuzzy matching against menu
 */
export function findPhoneticMatches(query: string, menuItems: Array<{name: string; aliases?: string}>): string[] {
  const queryNorm = normalizeForSearch(query);
  const variations = getPhoneticVariations(query);
  const normVariations = variations.map(v => normalizeForSearch(v));

  const matches: string[] = [];

  // This would be used by MenuMatcher to find relevant items
  // Returns normalized forms that match the query phonetically
  normVariations.forEach(v => {
    if (v && !matches.includes(v)) {
      matches.push(v);
    }
  });

  return matches;
}

/**
 * Check if two phonetic strings are similar enough
 * Useful for handling typos and pronunciation variations
 */
export function arePhoneticallyRelated(a: string, b: string, threshold: number = 0.7): boolean {
  const normA = normalizeForSearch(a);
  const normB = normalizeForSearch(b);

  if (normA === normB) return true;

  // Check if one is substring of other
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // For very short strings, require exact match
  if (normA.length < 3 || normB.length < 3) {
    return normA === normB;
  }

  // Calculate similarity based on shared characters
  const charsA = new Set(normA.split(""));
  const charsB = new Set(normB.split(""));
  const shared = Array.from(charsA).filter(c => charsB.has(c)).length;
  const maxChars = Math.max(charsA.size, charsB.size);

  return shared / maxChars >= threshold;
}
