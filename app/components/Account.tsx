"use client";

import {
  useCurrentAccountBalance,
  usePlayerStats,
  useSlotMachineContract,
  useTotalPendingRewards,
} from "@/hooks/useSlotMachineContract";
import { useAccount } from "wagmi";

export default function Account() {
  const { totalPendingRewards } = useTotalPendingRewards();
  const { balance: accountBalance } = useCurrentAccountBalance();
  const { totalSpins, totalWagered, totalWon } = usePlayerStats();
  const { address } = useAccount();

  const { handleClaimAll, isClaiming } = useSlotMachineContract();

  return (
    <div className="px-6 max-w-sm w-full">
      <div className="bg-gradient-to-b from-gray-300 via-gray-400 to-gray-600 rounded-xl p-4 border-2 border-gray-600 backdrop-blur-sm">
        <h3 className="text-lg font-bold mb-4 text-center border-b border-cyan-600 pb-2">
          ACCOUNT STATISTICS
        </h3>

        <div className="flex justify-between items-center">
          <div className="text-gray-200 text-sm font-semibold tracking-wider">
            ADDRESS
          </div>
          <div className="text-lg font-mono px-3 py-1 text-gray-50">
            {`${address?.slice(0, 6)}...${address?.slice(-5)}`}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-gray-200 text-sm font-semibold tracking-wider">
            BALANCE
          </div>
          <div className="text-lg font-mono px-3 py-1 text-gray-50">
            {Number(accountBalance).toFixed(5)} ETH
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-gray-200 text-sm font-semibold tracking-wider">
            TOTAL SPINS
          </div>
          <div className="text-orange-300 text-lg font-mono rounded px-3 py-1 text-gray-50">
            {totalSpins.toLocaleString()}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-gray-200 text-sm font-semibold tracking-wider">
            TOTAL BETS
          </div>
          <div className="text-orange-300 text-lg font-mono rounded px-3 py-1 text-gray-50">
            {Number(totalWagered).toFixed(5)} ETH
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-gray-200 text-sm font-semibold tracking-wider">
            TOTAL WON
          </div>
          <div className="text-orange-300 text-lg font-mono rounded px-3 py-1 text-gray-50">
            {Number(totalWon).toFixed(5)} ETH
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-gray-200 text-sm font-semibold tracking-wider">
            PENDING
          </div>
          <div className="text-orange-300 text-lg font-mono bg-black/50 rounded px-3 py-1 text-gray-50">
            {Number(totalPendingRewards).toFixed(5)} ETH
          </div>
        </div>

        {/* Claim Button */}

        <div className="mt-4">
          {totalPendingRewards > BigInt(0) ? (
            <button
              onClick={() => handleClaimAll()}
              disabled={isClaiming}
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold py-2 px-4 rounded-lg hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-orange-500/50"
            >
              {isClaiming ? "CLAIMING..." : "CLAIM ALL PAYOUT"}
            </button>
          ) : (
            <button
              disabled
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold py-2 px-4 rounded-lg transform transition-all duration-200 shadow-lg opacity-80"
            >
              NO PAYOUT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
