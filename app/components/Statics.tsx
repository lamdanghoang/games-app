import { useCasinoStats } from "@/hooks/useSlotMachineContract";

export default function Statics() {
  const {
    balance,
    totalSpins,
    totalWagered,
    totalPayouts,
    jackpotHits,
    isLoading,
    error,
  } = useCasinoStats();

  if (isLoading) return <div>LOADING...</div>;
  if (error) return <div>ERROR: {error.message}</div>;

  return (
    <div className="px-6 max-w-sm w-full">
      <div className="bg-gradient-to-b from-gray-300 via-gray-400 to-gray-600 rounded-xl p-4 border-2 border-gray-600 backdrop-blur-sm">
        <h3 className="text-lg font-bold mb-4 text-center border-b border-cyan-600 pb-2">
          GAME STATISTICS
        </h3>

        <div className="flex justify-between items-center">
          <div className="text-gray-200 text-sm font-semibold tracking-wider">
            GAME POOL
          </div>
          <div className="text-lg font-mono px-3 py-1 text-gray-50">
            {balance.toLocaleString()} ETH
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
            {totalWagered.toLocaleString()} ETH
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-gray-200 text-sm font-semibold tracking-wider">
            TOTAL PAYOUT
          </div>
          <div className="text-orange-300 text-lg font-mono rounded px-3 py-1 text-gray-50">
            {totalPayouts.toLocaleString()} ETH
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-gray-200 text-sm font-semibold tracking-wider">
            JACKPOT HITS
          </div>
          <div className="text-orange-300 text-lg font-mono rounded px-3 py-1 text-gray-50">
            {jackpotHits.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
