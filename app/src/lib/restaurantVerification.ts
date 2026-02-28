// lib/restaurantVerification.ts
// 餐厅注册防欺诈验证系统

interface RestaurantVerificationData {
  name: string;
  address: string;
  streetNumber: string;
  streetName: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
}

export interface VerificationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  warnings: string[];
}

// Google Places API 验证（需要 API Key）
export async function verifyAddressWithGooglePlaces(
  streetNumber: string, 
  streetName: string, 
  city: string, 
  state: string, 
  zipCode: string
): Promise<{ isValid: boolean; details?: Record<string, unknown> }> {
  try {
    const address = `${streetNumber} ${streetName}, ${city}, ${state} ${zipCode}`;
    
    // 这里需要实际的 Google Places API Key
    // const response = await fetch(
    //   `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(address)}&inputtype=textquery&key=${process.env.GOOGLE_PLACES_API_KEY}`
    // );
    
    // 暂时返回模拟验证结果
    console.log('🔍 Address verification:', address);
    
    // 基本格式验证
    const hasValidFormat = !!(streetNumber && streetName && city && state && zipCode);
    const zipCodePattern = /^\d{5}(-\d{4})?$/;
    const isValidZip = zipCodePattern.test(zipCode);
    
    return {
      isValid: hasValidFormat && isValidZip,
      details: { formatted_address: address }
    };
  } catch (error) {
    console.error('Address verification failed:', error);
    return { isValid: false };
  }
}

// 餐厅名称验证
export function verifyRestaurantName(name: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // 基本验证
  if (name.length < 2) {
    issues.push('Restaurant name too short');
  }
  
  if (name.length > 100) {
    issues.push('Restaurant name too long');
  }
  
  // 检查可疑模式
  const suspiciousPatterns = [
    /test|fake|dummy|sample/i,
    /^\d+$/,  // 纯数字
    /^[^a-zA-Z]*$/,  // 没有字母
  ];
  
  suspiciousPatterns.forEach(pattern => {
    if (pattern.test(name)) {
      issues.push('Restaurant name appears suspicious');
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// 电话号码验证
export function verifyPhoneNumber(phone: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // 移除所有非数字字符
  const cleanPhone = phone.replace(/\D/g, '');
  
  // 检查长度
  if (cleanPhone.length !== 11 || !cleanPhone.startsWith('1')) {
    issues.push('Invalid US phone number format');
  }
  
  // 检查区号
  const areaCode = cleanPhone.substring(1, 4);
  const invalidAreaCodes = ['000', '111', '555', '800', '888', '877', '866', '855'];
  
  if (invalidAreaCodes.includes(areaCode)) {
    issues.push('Invalid area code');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// 邮箱域名验证
export function verifyEmailDomain(email: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // 基本邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    issues.push('Invalid email format');
    return { isValid: false, issues };
  }
  
  const domain = email.split('@')[1].toLowerCase();
  
  // 检查是否为常见临时邮箱服务
  const tempEmailDomains = [
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.org',
    'throwaway.email'
  ];
  
  if (tempEmailDomains.includes(domain)) {
    issues.push('Temporary email domains not allowed');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// 钱包地址验证（检查是否为真实的智能钱包）
export async function verifyWalletAddress(address: string): Promise<{ isValid: boolean; isSmartWallet: boolean; issues: string[] }> {
  const issues: string[] = [];
  
  try {
    // 基本地址格式验证
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      issues.push('Invalid wallet address format');
      return { isValid: false, isSmartWallet: false, issues };
    }
    
    // 检查是否为已知的智能钱包（通过合约代码）
    // 这里可以添加实际的区块链查询
    // const response = await fetch(`https://api.uniscan.xyz/api?module=account&action=getcode&address=${address}&apikey=YourApiKeyToken`);
    
    // 暂时返回基本验证
    console.log('🔍 Wallet verification for:', address);
    
    return {
      isValid: true,
      isSmartWallet: true, // 假设已通过 Coinbase Smart Wallet 连接
      issues
    };
  } catch (error) {
    console.error('Wallet verification failed:', error);
    issues.push('Unable to verify wallet');
    return { isValid: false, isSmartWallet: false, issues };
  }
}

// 综合验证函数
export async function verifyRestaurantRegistration(data: RestaurantVerificationData): Promise<VerificationResult> {
  const issues: string[] = [];
  const warnings: string[] = [];
  let score = 100;
  
  // 1. 餐厅名称验证
  const nameCheck = verifyRestaurantName(data.name);
  if (!nameCheck.isValid) {
    issues.push(...nameCheck.issues);
    score -= 20;
  }
  
  // 2. 地址验证
  const addressCheck = await verifyAddressWithGooglePlaces(
    data.streetNumber, data.streetName, data.city, data.state, data.zipCode
  );
  if (!addressCheck.isValid) {
    issues.push('Address could not be verified');
    score -= 30;
  }
  
  // 3. 电话号码验证
  const phoneCheck = verifyPhoneNumber(data.phone);
  if (!phoneCheck.isValid) {
    issues.push(...phoneCheck.issues);
    score -= 15;
  }
  
  // 4. 邮箱验证
  const emailCheck = verifyEmailDomain(data.email);
  if (!emailCheck.isValid) {
    issues.push(...emailCheck.issues);
    score -= 10;
  }
  
  // 5. 添加警告
  if (score < 70) {
    warnings.push('Registration requires manual review');
  }
  
  if (score < 50) {
    warnings.push('High risk registration - may be fraudulent');
  }
  
  return {
    isValid: score >= 50 && issues.length === 0,
    score,
    issues,
    warnings
  };
}

// 获取验证建议
export function getVerificationSuggestions(result: VerificationResult): string[] {
  const suggestions: string[] = [];
  
  if (result.score < 70) {
    suggestions.push('Consider implementing additional verification steps');
    suggestions.push('Require business license or tax ID verification');
    suggestions.push('Use phone/SMS verification for the business phone');
  }
  
  if (result.score < 50) {
    suggestions.push('Require manual approval before activation');
    suggestions.push('Request additional business documentation');
    suggestions.push('Implement waiting period before account activation');
  }
  
  return suggestions;
}
