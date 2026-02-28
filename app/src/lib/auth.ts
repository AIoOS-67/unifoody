// lib/auth.ts
import { supabase } from "@/lib/supabase";

/**
 * Checks whether a wallet address is already registered as a diner or restaurant.
 * Returns: "diner", "restaurant", or null.
 */
export async function checkUserExists(walletAddress: string): Promise<"diner" | "restaurant" | null> {
  if (!walletAddress) {
    console.log("❌ No wallet address provided");
    return null;
  }

  try {
    console.log("🔍 Checking user registration for wallet:", walletAddress);

    // 🔹 Step 1: Check diners table
    const { data: diners, error: dinerError } = await supabase
      .from("diners")
      .select("id, wallet_address, role")
      .eq("wallet_address", walletAddress);

    if (dinerError) {
      console.error("⚠️ Supabase error querying diners:", dinerError);
    } else if (diners && diners.length > 0) {
      console.log("✅ Found diner registration:", diners[0]);
      return "diner";
    }

    // 🔹 Step 2: Check restaurants table
    const { data: restaurants, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, wallet_address, role")
      .eq("wallet_address", walletAddress);

    if (restaurantError) {
      console.error("⚠️ Supabase error querying restaurants:", restaurantError);
    } else if (restaurants && restaurants.length > 0) {
      console.log("✅ Found restaurant registration:", restaurants[0]);
      return "restaurant";
    }

    console.log("❌ Wallet not registered in any table:", walletAddress);
    return null;

  } catch (e) {
    console.error("🚨 Unexpected error during registration check:", e);
    return null;
  }
}
export function isDemoWalletAddress(address: string): boolean {
  const demoAddresses: string[] = [
    // 保留真正的演示地址（如果有的话）
    // '0x1234567890123456789012345678901234567890', // 示例演示地址
  ];
  return demoAddresses.includes(address);
}
