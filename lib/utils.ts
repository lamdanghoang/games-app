import { formatEther } from "viem";

/**
 * Format ETH amount with appropriate decimal places
 * @param amount - Amount in wei (bigint) or ETH (string)
 * @param maxDecimals - Maximum decimal places to show (default: 4)
 * @returns Formatted ETH string
 */
export function formatEth(
  amount: bigint | string,
  maxDecimals: number = 4,
): string {
  let ethAmount: string;

  if (typeof amount === "bigint") {
    ethAmount = formatEther(amount);
  } else {
    ethAmount = amount;
  }

  const num = parseFloat(ethAmount);

  // If amount is 0, return "0"
  if (num === 0) return "0";

  // If amount is very small (< 0.0001), show more decimals
  if (num < 0.0001) {
    return num.toFixed(6);
  }

  // If amount is small (< 0.01), show 4 decimals
  if (num < 0.01) {
    return num.toFixed(4);
  }

  // If amount is medium (< 1), show 3 decimals
  if (num < 1) {
    return num.toFixed(3);
  }

  // If amount is large (< 100), show 2 decimals
  if (num < 100) {
    return num.toFixed(2);
  }

  // For very large amounts, show 1 decimal
  return num.toFixed(1);
}

/**
 * Format ETH amount for display with currency symbol
 * @param amount - Amount in wei (bigint) or ETH (string)
 * @param maxDecimals - Maximum decimal places to show (default: 4)
 * @returns Formatted string with ETH symbol
 */
export function formatEthWithSymbol(
  amount: bigint | string,
  maxDecimals: number = 4,
): string {
  return `${formatEth(amount, maxDecimals)} ETH`;
}
