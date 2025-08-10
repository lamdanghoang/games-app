"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { SpinResult } from "@/types";
import { formatEther, parseEther } from "viem";
import { formatEth } from "@/lib/utils";
import {
  useContractBalance,
  useCurrentAccountBalance,
  useLatestWin,
  useSlotMachineContract,
} from "@/hooks/useSlotMachineContract";

const SYMBOLS: string[] = [
  "🍒",
  "🍋",
  "🍊",
  "🍀",
  "🍇",
  "🔔",
  "👑",
  "💎",
  "7️⃣",
];

const REEL_COUNT = 3;
const SYMBOL_HEIGHT = 64; // px

// Bet amounts
const betAmounts = ["0.0001", "0.0005", "0.001", "0.005"];

// Easing functions
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

// Create a list of symbol strings for a reel
const createReelSymbols = (symbols: string[], count = 30): string[] => {
  const reelContent: string[] = [];
  for (let i = 0; i < count; i++) {
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    reelContent.push(sym);
  }
  return reelContent;
};

export default function SlotMachine() {
  const [showWinFlash, setShowWinFlash] = useState(false);
  const [winMessage, setWinMessage] = useState<string>("");
  const [bet, setBet] = useState("0.001");

  // State to hold the symbols for each reel
  const [reelSymbols, setReelSymbols] = useState<string[][]>([
    ["🍒"],
    ["🍒"],
    ["🍒"],
  ]);

  // State to manage the CSS transform for the animation
  const [reelTransforms, setReelTransforms] = useState<string[]>(
    Array(REEL_COUNT).fill("translateY(0)"),
  );

  const spinResultsRef = useRef<string[]>([]);
  const animationFrameRefs = useRef<number[]>([]);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  const { handleStartSpin, spinResult, isSpinning } = useSlotMachineContract();
  const { latestWin } = useLatestWin();
  const { balance: poolBalance } = useContractBalance();
  const { balance: accountBalance } = useCurrentAccountBalance();

  // Cleanup function for timeouts
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

  // Clear all ongoing animations
  const clearAnimations = useCallback(() => {
    animationFrameRefs.current.forEach(cancelAnimationFrame);
    timeoutRefs.current.forEach(clearTimeout);
    animationFrameRefs.current = [];
    timeoutRefs.current = [];
  }, []);

  // Main spin animation function
  const animateSpinWithResult = useCallback(
    (symbolResults: string[]) => {
      if (isSpinning) return;

      setWinMessage("");
      spinResultsRef.current = [];

      clearAnimations();

      // Generate reel symbols with result at the end
      const newReelSymbols: string[][] = [];
      for (let i = 0; i < REEL_COUNT; i++) {
        const spinSymbols = createReelSymbols(SYMBOLS);
        const resultSymbol = symbolResults[i];
        const finalSymbols = [...spinSymbols, resultSymbol];
        newReelSymbols.push(finalSymbols);
      }

      setReelSymbols(newReelSymbols);

      setReelTransforms(Array(REEL_COUNT).fill("translateY(0)"));

      // Animate each reel
      newReelSymbols.forEach((symbols, reelIndex) => {
        const finalPosition = -(symbols.length - 1) * SYMBOL_HEIGHT;
        const spinDuration = 2000 + reelIndex * 400; // Staggered timing
        const startTime = Date.now();

        const animateReel = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / spinDuration, 1);

          if (progress < 1) {
            // Use cubic ease-out for smooth deceleration
            const easedProgress = easeOutCubic(progress);
            const currentY = finalPosition * easedProgress;

            setReelTransforms((prev) => {
              const newTransforms = [...prev];
              newTransforms[reelIndex] = `translateY(${currentY}px)`;
              return newTransforms;
            });

            const frameId = requestAnimationFrame(animateReel);
            animationFrameRefs.current[reelIndex] = frameId;
          } else {
            // Animation complete
            setReelTransforms((prev) => {
              const newTransforms = [...prev];
              newTransforms[reelIndex] = `translateY(${finalPosition}px)`;
              return newTransforms;
            });

            // Store result
            spinResultsRef.current[reelIndex] = symbols[symbols.length - 1];

            // Check for win when last reel stops
            if (reelIndex === REEL_COUNT - 1) {
              const timeout = setTimeout(() => {
                checkWinCondition(spinResult);
              }, 300);
              timeoutRefs.current.push(timeout);
            }
          }
        };

        // Start animation with slight delay
        const startTimeout = setTimeout(() => {
          const frameId = requestAnimationFrame(animateReel);
          animationFrameRefs.current[reelIndex] = frameId;
        }, 100);

        timeoutRefs.current.push(startTimeout);
      });
    },
    [spinResult],
  );

  // Check win condition using contract data
  const checkWinCondition = useCallback(
    (spinResult: SpinResult | null) => {
      if (!spinResult) {
        setWinMessage("❌ No result received!");
        return;
      }

      // Convert contract values from string to number
      const payoutAmount = Number(formatEther(spinResult.payout));

      // Check if it's a win (payout > 0)
      const isWin = +payoutAmount > 0;

      if (isWin) {
        // Handle jackpot win (TRIPLE_SEVEN or contract isJackpot flag)
        if (spinResult.isJackpot || spinResult.winType === "TRIPLE_SEVEN") {
          setWinMessage(`🎰 JACKPOT! You won ${payoutAmount.toFixed(3)} ETH!`);
        } else {
          // Regular win with win type
          const winTypeMsg = spinResult.winType || "WIN";

          // Calculate the actual multiplier for display
          // Contract returns multiplier * 100 for double matches
          let displayMultiplier = Number(spinResult.multiplier);

          // Check if this is a double match (winType contains "DOUBLE")
          if (winTypeMsg.includes("DOUBLE")) {
            displayMultiplier = displayMultiplier / 100;
          }

          setWinMessage(
            `🎉 ${winTypeMsg}! You won ${payoutAmount.toFixed(
              3,
            )} ETH! (${displayMultiplier}x)`,
          );
          setShowWinFlash(true);

          // Flash effect duration
          setTimeout(() => setShowWinFlash(false), 3000);
        }
      } else {
        setWinMessage("❌ Try again!");
      }

      // refetchAll();
    },
    [spinResult],
  );

  const handleSpinClick = () => {
    if (isSpinning) return;
    setShowWinFlash(false);

    handleStartSpin(parseEther(`${bet}`));
  };

  // Handle spin result from contract
  useEffect(() => {
    if (
      spinResult &&
      spinResult.reel1 !== undefined &&
      spinResult.reel2 !== undefined &&
      spinResult.reel3 !== undefined
    ) {
      console.log(spinResult);
      const symbols = [
        SYMBOLS[spinResult.reel1],
        SYMBOLS[spinResult.reel2],
        SYMBOLS[spinResult.reel3],
      ];

      console.log("Spin result symbols:", symbols);
      animateSpinWithResult(symbols);
    }
  }, [spinResult]);

  return (
    <div className="relative">
      {/* Machine Body */}
      <div className="bg-gradient-to-b from-gray-300 via-gray-400 to-gray-600 rounded-3xl p-6 shadow-2xl border-8 border-gray-700 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent"></div>

        {/* Top Display Panel */}
        <div className="bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-2xl p-4 mb-6 border-4 border-yellow-700 shadow-inner">
          <div className="text-center">
            <div className="text-2xl font-bold text-black text-nowrap">
              GAME POOL: {formatEth(poolBalance)} ETH
            </div>
          </div>
        </div>

        {/* Balance/Win Display */}
        <div className="bg-black rounded-xl p-4 mb-6 border-4 border-gray-600">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-yellow-400 text-sm font-bold tracking-wider">
                BALANCE
              </div>
              <div className="text-yellow-300 text-2xl font-mono bg-black/50 rounded px-2 text-nowrap">
                <span>{formatEth(accountBalance)}</span>
                <span className="ml-1 text-sm">ETH</span>
              </div>
            </div>
            <div>
              <div className="text-yellow-400 text-sm font-bold tracking-wider">
                WIN
              </div>
              <div
                className={`text-2xl font-mono bg-black/50 rounded px-2 text-nowrap ${
                  showWinFlash
                    ? "text-red-400 animate-pulse"
                    : "text-yellow-300"
                }`}
              >
                <span>{latestWin ? formatEth(latestWin.amount) : "0"}</span>
                <span className="ml-1 text-sm">ETH</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Reel Window */}
        <div className="relative mb-6">
          {/* Window Frame */}
          <div className="bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-2xl p-5 border-4 border-yellow-800 shadow-inner">
            {/* Reels Container */}
            <div className="bg-white rounded-xl p-4 grid grid-cols-3 gap-4">
              {reelSymbols.map((symbols, i) => (
                <div
                  key={i}
                  className="bg-white border-4 border-[#444] overflow-hidden rounded-lg shadow-[inset_0_0_10px_#000] h-[74px]"
                >
                  <div
                    className="flex flex-col transition-transform duration-1000 ease-out"
                    style={{
                      transform: reelTransforms[i],
                    }}
                  >
                    {symbols.map((symbol, symbolIndex) => (
                      <div
                        key={symbolIndex}
                        className="flex justify-center items-center text-5xl p-2.5 h-16 flex-shrink-0"
                      >
                        {symbol}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Decorative Lights */}
            <div className="absolute top-2 left-2 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
            <div className="absolute top-2 right-2 w-4 h-4 bg-green-500 rounded-full animate-pulse delay-500"></div>
            <div className="absolute bottom-2 left-2 w-4 h-4 bg-blue-500 rounded-full animate-pulse delay-1000"></div>
            <div className="absolute bottom-2 right-2 w-4 h-4 bg-yellow-500 rounded-full animate-pulse delay-1500"></div>
          </div>
        </div>

        {/* Win/Lose Message */}
        {winMessage && (
          <div
            className={`text-center -mt-1.5 mb-2 py-2 rounded-lg font-bold text-lg transition-all duration-500 ${
              winMessage.includes("won") ||
              winMessage.includes("JACKPOT") ||
              winMessage.includes("WIN")
                ? "bg-gradient-to-r from-green-500 to-yellow-500 text-green-300 border border-green-500/50 shadow-lg shadow-green-500/25"
                : "bg-red-500 text-gray-50 border border-red-500/50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {spinResult?.isJackpot && "🎰"}
              <span>{winMessage}</span>
              {spinResult?.isJackpot && "🎰"}
            </div>
            {spinResult?.isJackpot && (
              <div className="text-sm text-yellow-300 mt-1 animate-pulse">
                JACKPOT WINNER!
              </div>
            )}
          </div>
        )}

        {/* Bet Amount Selection */}
        <div className="mt-2 mb-6">
          <label className="block text-sm text-gray-300 font-semibold mb-4 text-center">
            Select Bet Amount:
          </label>
          <div className="grid grid-cols-4 gap-2">
            {betAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setBet(amount)}
                disabled={isSpinning}
                className={`
                                            relative p-1 rounded-lg text-sm font-semibold transition-all duration-200
                                            ${
                                              bet === amount
                                                ? "bg-gradient-to-br from-orange-500 to-yellow-500 text-white scale-105 shadow-lg"
                                                : "bg-white/10 text-gray-300 hover:bg-white/20 hover:scale-105"
                                            }
                                            ${
                                              isSpinning
                                                ? "opacity-50 cursor-not-allowed"
                                                : "cursor-pointer"
                                            }
                                        `}
              >
                {amount} ETH
              </button>
            ))}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center">
          {/* SPIN Button */}
          <button
            onClick={handleSpinClick}
            disabled={isSpinning}
            className={`
                relative bg-gradient-to-b from-red-400 to-red-600 hover:from-red-300 hover:to-red-500
                rounded-xl p-4 text-white font-bold text-lg shadow-lg border-4 border-red-700
                transform transition-all duration-150 w-1/2
                ${
                  isSpinning
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-105 active:scale-95 shadow-red-500/50"
                }
              `}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 rounded-lg"></div>
            <div className="relative">
              {isSpinning ? "SPINNING..." : "SPIN"}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
