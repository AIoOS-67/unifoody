// lib/taxService.ts
// 🇺🇸 Complete US State Food Tax Rates Implementation
// Direct state-based tax calculation for restaurant prepared food

interface TaxRate {
  rate: number;
  state_rate: number;
  county_rate: number;
  city_rate: number;
  combined_district_rate: number;
  total_rate: number;
}

interface TaxCalculation {
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  tax_rate: number;
  zip_code: string;
  state: string;
}

// �️ Complete US State Prepared Food Tax Rates (All 50 States)
// Based on comprehensive state-by-state analysis
// Using "Up to" maximum rates where applicable, 0% for "Varies" states
const PREPARED_FOOD_TAX_RATES: Record<string, number> = {
  // A-F States
  'AL': 0.04,    // Alabama: 4.00%
  'AK': 0.00,    // Alaska: 0.00%
  'AZ': 0.0560,  // Arizona: Up to 5.60%
  'AR': 0.1125,  // Arkansas: Up to 11.25%
  'CA': 0.1025,  // California: Up to 10.25%
  'CO': 0.08,    // Colorado: Up to 8.00%
  'CT': 0.0635,  // Connecticut: 6.35%
  'DE': 0.00,    // Delaware: 0.00%
  'FL': 0.08,    // Florida: Up to 8.00%
  
  // G-M States
  'GA': 0.08,    // Georgia: Up to 8.00%
  'HI': 0.04,    // Hawaii: 4.00%
  'ID': 0.07,    // Idaho: Up to 7.00%
  'IL': 0.1025,  // Illinois: Up to 10.25%
  'IN': 0.07,    // Indiana: 7.00%
  'IA': 0.07,    // Iowa: Up to 7.00%
  'KS': 0.0865,  // Kansas: Up to 8.65%
  'KY': 0.06,    // Kentucky: 6.00%
  'LA': 0.1145,  // Louisiana: Up to 11.45%
  'ME': 0.055,   // Maine: 5.50%
  'MD': 0.06,    // Maryland: 6.00%
  'MA': 0.0625,  // Massachusetts: 6.25%
  'MI': 0.06,    // Michigan: 6.00%
  'MN': 0.0775,  // Minnesota: Up to 7.75%
  'MS': 0.08,    // Mississippi: Up to 8.00%
  'MO': 0.0863,  // Missouri: Up to 8.63%
  'MT': 0.00,    // Montana: 0.00% (Varies → use 0)
  
  // N-S States
  'NE': 0.075,   // Nebraska: Up to 7.50%
  'NV': 0.0825,  // Nevada: Up to 8.25%
  'NH': 0.00,    // New Hampshire: 0.00%
  'NJ': 0.06625, // New Jersey: 6.625%
  'NM': 0.0813,  // New Mexico: Up to 8.13%
  'NY': 0.08875, // New York: Up to 8.875%
  'NC': 0.0775,  // North Carolina: Up to 7.75%
  'ND': 0.075,   // North Dakota: Up to 7.50%
  'OH': 0.08,    // Ohio: Up to 8.00%
  'OK': 0.115,   // Oklahoma: Up to 11.50%
  'OR': 0.00,    // Oregon: 0.00%
  'PA': 0.08,    // Pennsylvania: Up to 8.00%
  'RI': 0.08,    // Rhode Island: 8.00%
  'SC': 0.09,    // South Carolina: Up to 9.00%
  'SD': 0.062,   // South Dakota: Up to 6.20%
  
  // T-W States
  'TN': 0.0975,  // Tennessee: Up to 9.75%
  'TX': 0.0825,  // Texas: Up to 8.25%
  'UT': 0.0905,  // Utah: Up to 9.05%
  'VT': 0.10,    // Vermont: Up to 10.00%
  'VA': 0.07,    // Virginia: Up to 7.00%
  'WA': 0.106,   // Washington: Up to 10.60%
  'WV': 0.07,    // West Virginia: Up to 7.00%
  'WI': 0.056,   // Wisconsin: Up to 5.60%
  'WY': 0.06,    // Wyoming: Up to 6.00%
};

// Default tax rate fallback
const DEFAULT_TAX_RATE = 0.0725; // 7.25% national average

/**
 * 🏛️ 根据州获取税率 (新的简化方法)
 * @param state - 州代码 (如 'NY', 'CA', 'TX')
 * @returns TaxRate 对象
 */
export async function getTaxRateByState(state: string): Promise<TaxRate> {
  try {
    const stateCode = state.toUpperCase();
    const taxRate = PREPARED_FOOD_TAX_RATES[stateCode] || DEFAULT_TAX_RATE;
    
    const result: TaxRate = {
      rate: taxRate,
      state_rate: taxRate, // 简化：全部归为州税率
      county_rate: 0,
      city_rate: 0,
      combined_district_rate: 0,
      total_rate: taxRate
    };
    
    console.log(`🍽️ Food tax rate for ${stateCode}: ${(taxRate * 100).toFixed(2)}%`);
    return result;
    
  } catch (error) {
    console.error('State tax rate lookup failed:', error);
    // 返回默认税率
    return {
      rate: DEFAULT_TAX_RATE,
      state_rate: DEFAULT_TAX_RATE,
      county_rate: 0,
      city_rate: 0,
      combined_district_rate: 0,
      total_rate: DEFAULT_TAX_RATE
    };
  }
}

/**
 * 📍 根据邮政编码获取税率 (向后兼容，但内部使用州查询)
 * @param zipCode - 邮政编码
 * @returns TaxRate 对象
 */
export async function getTaxRateByZipCode(zipCode: string): Promise<TaxRate> {
  try {
    // 从ZIP code推断州 (简化版本，主要用于向后兼容)
    const state = getStateFromZip(zipCode);
    return await getTaxRateByState(state);
    
  } catch (error) {
    console.error('ZIP code tax rate lookup failed:', error);
    return await getTaxRateByState('NY'); // 默认使用NY
  }
}

/**
 * 💰 计算税费
 * @param subtotal - 小计金额
 * @param state - 州代码
 * @param taxRate - 税率对象 (可选，如果不提供会自动查询)
 * @returns TaxCalculation 对象
 */
export async function calculateTax(
  subtotal: number, 
  state: string, 
  taxRate?: TaxRate
): Promise<TaxCalculation> {
  
  // 如果没有提供税率，自动查询
  if (!taxRate) {
    taxRate = await getTaxRateByState(state);
  }
  
  const tax_amount = subtotal * taxRate.total_rate;
  const total_amount = subtotal + tax_amount;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount: Math.round(tax_amount * 100) / 100,
    total_amount: Math.round(total_amount * 100) / 100,
    tax_rate: taxRate.total_rate,
    zip_code: '', // 不再需要ZIP code
    state: state.toUpperCase()
  };
}

/**
 * 🗺️ 从ZIP code推断州 (简化版本，用于向后兼容)
 */
function getStateFromZip(zipCode: string): string {
  const zip = zipCode.slice(0, 2);
  
  // 基于前两位数字的简化映射
  const zipToState: Record<string, string> = {
    '10': 'NY', '11': 'NY', '12': 'NY', '13': 'NY', '14': 'NY', // New York
    '90': 'CA', '91': 'CA', '92': 'CA', '93': 'CA', '94': 'CA', '95': 'CA', // California
    '75': 'TX', '76': 'TX', '77': 'TX', '78': 'TX', '79': 'TX', // Texas
    '60': 'IL', '61': 'IL', '62': 'IL', // Illinois
    '32': 'FL', '33': 'FL', '34': 'FL', // Florida
    '98': 'WA', '99': 'WA', // Washington
    '80': 'CO', '81': 'CO', // Colorado
    '07': 'NJ', '08': 'NJ', // New Jersey
  };
  
  return zipToState[zip] || 'NY'; // 默认返回NY
}

/**
 * 📊 获取所有州的税率列表 (用于调试和管理)
 */
export function getAllStateTaxRates(): Record<string, number> {
  return { ...PREPARED_FOOD_TAX_RATES };
}

/**
 * 🔍 获取特定州的税率信息 (用于调试)
 */
export function getStateTaxInfo(state: string): { 
  state: string; 
  rate: number; 
  percentage: string; 
  hasNoTax: boolean;
} {
  const stateCode = state.toUpperCase();
  const rate = PREPARED_FOOD_TAX_RATES[stateCode] || DEFAULT_TAX_RATE;
  
  return {
    state: stateCode,
    rate: rate,
    percentage: `${(rate * 100).toFixed(2)}%`,
    hasNoTax: rate === 0
  };
}
