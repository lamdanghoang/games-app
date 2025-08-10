// Type definitions for EVM contract
export interface SpinResult {
  player: string;
  spinId: bigint;
  betAmount: bigint;
  reel1: number;
  reel2: number;
  reel3: number;
  payout: bigint;
  multiplier: bigint;
  isJackpot: boolean;
  winType: string;
  timestamp: bigint;
}

export interface PendingReward {
  amount: bigint;
  spinId: bigint;
  timestamp: bigint;
  reel1: number;
  reel2: number;
  reel3: number;
  multiplier: bigint;
  isJackpot: boolean;
}
