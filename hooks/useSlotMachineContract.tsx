"use client";

import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWatchBlocks,
  useWriteContract,
  useWatchContractEvent,
  useWaitForTransactionReceipt,
} from "wagmi";
import { SLOT_MACHINE_CONTRACT } from "@/constants/contract";
import { useCallback, useEffect, useState } from "react";
import { formatEther, decodeEventLog, parseAbiItem } from "viem";
import { formatEth } from "@/lib/utils";
import { PendingReward, SpinResult } from "@/types";

// Utility function to decode events from logs
function decodeSlotMachineEvents(logs: any[]) {
  const decodedEvents: any[] = [];

  // Event signatures from the contract ABI
  const eventSignatures = {
    PayoutCalculated:
      "PayoutCalculated(address,uint256,uint256,uint8,uint8,uint8,uint256,uint256,bool,string,uint256)",
    SpinResult: "SpinResult(address,uint256,uint8,uint8,uint8,uint256)",
    SpinStarted: "SpinStarted(address,uint256,uint256,uint256)",
    RewardClaimed: "RewardClaimed(address,uint256,uint256,uint256)",
  };

  for (const log of logs) {
    try {
      // Try to decode each log
      const decoded = decodeEventLog({
        abi: SLOT_MACHINE_CONTRACT.abi,
        data: log.data,
        topics: log.topics,
      });

      console.log("✅ Successfully decoded event:", decoded);
      decodedEvents.push(decoded);

      // If this is a PayoutCalculated event, try to create a SpinResult
      if (decoded.eventName === "PayoutCalculated") {
        const args = decoded.args as any;
        if (args) {
          const result: SpinResult = {
            player: args.player,
            spinId: args.spinId,
            betAmount: args.betAmount,
            reel1: Number(args.reel1),
            reel2: Number(args.reel2),
            reel3: Number(args.reel3),
            payout: args.payout,
            multiplier: args.multiplier,
            isJackpot: args.isJackpot,
            winType: args.winType,
            timestamp: args.timestamp,
          };
          console.log("🎉 Created SpinResult from decoded event:", result);
          return result; // Return the first valid result
        }
      }
    } catch (error) {
      console.log("⚠️ Could not decode log:", log);
      console.log("Error:", error);
    }
  }

  return null;
}

export function useSlotMachineContract() {
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimDigest, setClaimDigest] = useState<string | null>(null);
  const [spinHash, setSpinHash] = useState<string | null>(null);
  const [eventWatchingFailed, setEventWatchingFailed] = useState(false);
  const [useManualPolling, setUseManualPolling] = useState(false);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { debugTransaction } = useEventDebugger();
  const { supportsEventFiltering } = useRpcCapabilities();

  // Auto-enable manual polling if RPC doesn't support event filtering
  useEffect(() => {
    if (supportsEventFiltering === false) {
      console.log(
        "🔄 RPC node doesn't support event filtering, enabling manual polling",
      );
      setUseManualPolling(true);
      setEventWatchingFailed(true);
    }
  }, [supportsEventFiltering]);

  // 📌 Start a spin (payable)
  const {
    writeContract: startSpin,
    error: spinError,
    data: spinData,
    isPending: isSpinPending,
    reset: resetSpin,
  } = useWriteContract();

  // Wait for spin transaction to be confirmed
  const {
    isLoading: isSpinConfirming,
    isSuccess: isSpinConfirmed,
    isError: isSpinError,
    error: spinReceiptError,
  } = useWaitForTransactionReceipt({
    hash: spinData,
    confirmations: 1, // Wait for 1 confirmation on Base
  });

  const handleStartSpin = (betAmountWei: bigint) => {
    console.log(
      "🚀 Starting spin with bet amount:",
      formatEther(betAmountWei),
      "ETH",
    );
    setSpinResult(null);
    setIsSpinning(true);
    setSpinHash(null);
    setEventWatchingFailed(false);
    setUseManualPolling(false);

    startSpin({
      ...SLOT_MACHINE_CONTRACT,
      functionName: "spinAndProcess",
      value: betAmountWei,
      args: [],
    });
  };

  // 📌 Claim all rewards
  const {
    writeContract: claimAll,
    error: claimError,
    data: claimData,
  } = useWriteContract();

  const handleClaimAll = () => {
    console.log("💰 Claiming all rewards...");
    setIsClaiming(true);
    claimAll({
      ...SLOT_MACHINE_CONTRACT,
      functionName: "claimAllRewards",
      args: [],
    });
  };

  // Enhanced error handler for event watching
  const handleEventError = useCallback((eventName: string, error: any) => {
    console.error(`❌ Error watching ${eventName} events:`, error);

    // Check if this is a filter not found error (Base Sepolia issue)
    if (
      error.message?.includes("filter not found") ||
      error.message?.includes("Missing or invalid parameters")
    ) {
      console.log(
        `🔄 ${eventName} event watching failed due to RPC limitations, switching to manual polling...`,
      );
      setEventWatchingFailed(true);
      setUseManualPolling(true);
    }
  }, []);

  // Handle spin contract errors (user rejection, insufficient funds, etc.)
  useEffect(() => {
    if (spinError) {
      console.error("❌ Spin contract error:", spinError);
      setIsSpinning(false);
      setSpinResult(null);
      setSpinHash(null);
      setEventWatchingFailed(false);
      setUseManualPolling(false);

      // Reset the contract state after a delay
      setTimeout(() => {
        resetSpin();
      }, 3000);
    }
  }, [spinError, resetSpin]);

  // Only watch events if RPC supports it and we haven't failed
  const shouldWatchEvents =
    supportsEventFiltering !== false && !eventWatchingFailed;

  // Watch for payout calculated events with better error handling
  useWatchContractEvent({
    ...SLOT_MACHINE_CONTRACT,
    eventName: "PayoutCalculated",
    onLogs(logs) {
      console.log("🎯 PayoutCalculated event received:", logs);
      if (logs && logs.length > 0) {
        const log = logs[logs.length - 1] as any;
        console.log("📊 Processing event log:", log);

        try {
          const result: SpinResult = {
            player: log.args.player as string,
            spinId: log.args.spinId as bigint,
            betAmount: log.args.betAmount as bigint,
            reel1: Number(log.args.reel1),
            reel2: Number(log.args.reel2),
            reel3: Number(log.args.reel3),
            payout: log.args.payout as bigint,
            multiplier: log.args.multiplier as bigint,
            isJackpot: log.args.isJackpot as boolean,
            winType: log.args.winType as string,
            timestamp: log.args.timestamp as bigint,
          };
          console.log("🎉 Spin result processed:", result);
          setSpinResult(result);
          setIsSpinning(false);
        } catch (error) {
          console.error("❌ Error processing PayoutCalculated event:", error);
          console.error("Raw log data:", log);
        }
      }
    },
    onError(error) {
      handleEventError("PayoutCalculated", error);
    },
    enabled: shouldWatchEvents,
  });

  // Watch for reward claimed events
  useWatchContractEvent({
    ...SLOT_MACHINE_CONTRACT,
    eventName: "RewardClaimed",
    args: address ? { player: address } : undefined,
    onLogs(logs) {
      console.log("🎁 RewardClaimed event received:", logs);
      if (logs && logs.length > 0) {
        const log = logs[logs.length - 1] as any;
        console.log("💰 Processing claim log:", log);
        setClaimDigest(log.transactionHash);
        setIsClaiming(false);
      }
    },
    onError(error) {
      handleEventError("RewardClaimed", error);
    },
    enabled: shouldWatchEvents,
  });

  // Watch for SpinResult events (fallback)
  useWatchContractEvent({
    ...SLOT_MACHINE_CONTRACT,
    eventName: "SpinResult",
    onLogs(logs) {
      console.log("🎲 SpinResult event received:", logs);
      if (logs && logs.length > 0) {
        const log = logs[logs.length - 1] as any;
        console.log("📊 SpinResult log:", log);
      }
    },
    onError(error) {
      handleEventError("SpinResult", error);
    },
    enabled: shouldWatchEvents,
  });

  // Watch for SpinStarted events
  useWatchContractEvent({
    ...SLOT_MACHINE_CONTRACT,
    eventName: "SpinStarted",
    onLogs(logs) {
      console.log("🚀 SpinStarted event received:", logs);
      if (logs && logs.length > 0) {
        const log = logs[logs.length - 1] as any;
        console.log("📊 SpinStarted log:", log);
      }
    },
    onError(error) {
      handleEventError("SpinStarted", error);
    },
    enabled: shouldWatchEvents,
  });

  // Effect to handle spin confirmation and errors
  useEffect(() => {
    if (isSpinConfirmed && spinData) {
      console.log("✅ Spin transaction confirmed:", spinData);
      setSpinHash(spinData);

      // If event watching failed or manual polling is enabled, start manual polling immediately
      if (eventWatchingFailed || useManualPolling) {
        console.log(
          "🔄 Event watching failed or manual polling enabled, starting immediate manual polling...",
        );
        // Start manual polling right away
        setTimeout(() => {
          if (!spinResult) {
            console.log("⏰ Starting immediate manual fetch...");
            debugTransaction(spinData);
          }
        }, 2000); // Wait only 2 seconds
      } else {
        // Try to manually fetch the result if event didn't fire
        setTimeout(() => {
          if (!spinResult) {
            console.log("⏰ Event didn't fire, trying manual fetch...");
            // Auto-debug the transaction
            debugTransaction(spinData);
          }
        }, 5000); // Wait 5 seconds
      }
    }

    // Handle spin transaction errors
    if (isSpinError && spinReceiptError) {
      console.error("❌ Spin transaction failed:", spinReceiptError);
      setIsSpinning(false);
      setSpinResult(null);
      setSpinHash(null);
      setEventWatchingFailed(false);
      setUseManualPolling(false);
    }
  }, [
    isSpinConfirmed,
    isSpinError,
    spinReceiptError,
    spinData,
    spinResult,
    debugTransaction,
    eventWatchingFailed,
    useManualPolling,
  ]);

  // Manual event polling as fallback for Base network
  useEffect(() => {
    if (!publicClient || !spinHash) return;

    let pollCount = 0;
    const maxPolls = 10; // Maximum number of polling attempts
    const baseDelay = eventWatchingFailed || useManualPolling ? 1000 : 3000;

    const pollForEvents = async () => {
      try {
        pollCount++;
        console.log(
          `🔍 Polling for events manually... (attempt ${pollCount}/${maxPolls})`,
        );

        const receipt = await publicClient.getTransactionReceipt({
          hash: spinHash as `0x${string}`,
        });
        console.log("📋 Transaction receipt:", receipt);

        // Parse logs manually if needed
        if (receipt.logs.length > 0) {
          console.log("📝 Transaction logs:", receipt.logs);

          // Try to find our contract events
          const contractLogs = receipt.logs.filter(
            (log) =>
              log.address.toLowerCase() ===
              SLOT_MACHINE_CONTRACT.address.toLowerCase(),
          );

          if (contractLogs.length > 0) {
            console.log("🎯 Found contract logs:", contractLogs);

            // Try to decode events using our utility function
            console.log(
              "🔍 Attempting to decode events using utility function...",
            );
            const decodedResult = decodeSlotMachineEvents(contractLogs);

            if (decodedResult) {
              console.log(
                "🎉 Successfully decoded spin result from logs:",
                decodedResult,
              );
              setSpinResult(decodedResult);
              setIsSpinning(false);
              return; // Success, stop polling
            } else {
              console.log("⚠️ Could not decode any events from logs");
            }
          } else {
            console.log("⚠️ No contract logs found in transaction");
          }
        } else {
          console.log("⚠️ No logs found in transaction yet");
        }

        // If we haven't found the result and haven't exceeded max polls, continue polling
        if (pollCount < maxPolls && !spinResult) {
          const nextDelay = baseDelay + pollCount * 500; // Increase delay with each attempt
          console.log(`⏰ Scheduling next poll in ${nextDelay}ms...`);
          setTimeout(pollForEvents, nextDelay);
        } else if (pollCount >= maxPolls) {
          console.log("⏰ Max polling attempts reached, giving up");
          // Try one last time with debugTransaction
          if (!spinResult) {
            console.log("🔍 Final attempt: using debugTransaction...");
            debugTransaction(spinHash);
          }
        }
      } catch (error) {
        console.error("❌ Error polling for events:", error);

        // Retry on error if we haven't exceeded max polls
        if (pollCount < maxPolls && !spinResult) {
          const retryDelay = baseDelay + pollCount * 1000; // Longer delay on error
          console.log(`🔄 Retrying in ${retryDelay}ms due to error...`);
          setTimeout(pollForEvents, retryDelay);
        }
      }
    };

    // Start polling immediately if event watching failed or manual polling is enabled
    if (spinHash && !spinResult) {
      const initialDelay =
        eventWatchingFailed || useManualPolling ? 1000 : 3000;
      console.log(`🚀 Starting manual polling in ${initialDelay}ms...`);
      const timer = setTimeout(pollForEvents, initialDelay);
      return () => clearTimeout(timer);
    }
  }, [
    publicClient,
    spinHash,
    spinResult,
    eventWatchingFailed,
    useManualPolling,
    debugTransaction,
  ]);

  return {
    handleStartSpin,
    isSpinning: isSpinning || isSpinConfirming || isSpinPending,
    spinError,
    claimError,
    handleClaimAll,
    isClaiming,
    spinResult,
    claimDigest,
    spinHash,
    isSpinConfirming,
    isSpinPending,
    eventWatchingFailed,
    useManualPolling,
    supportsEventFiltering,
  };
}

export function useContractBalance() {
  const publicClient = usePublicClient();
  const [balance, setBalance] = useState<string>("0");

  // Fetch balance from the blockchain
  const fetchBalance = useCallback(async () => {
    if (!publicClient) return;
    try {
      const rawBalance = await publicClient.getBalance({
        address: SLOT_MACHINE_CONTRACT.address,
      });
      setBalance(formatEth(rawBalance));
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  }, [publicClient]);

  // Refetch whenever a new block is mined
  useWatchBlocks({
    onBlock: () => {
      fetchBalance();
    },
  });

  // Initial fetch
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    refetch: fetchBalance,
  };
}

// New hook for debugging events
export function useEventDebugger() {
  const publicClient = usePublicClient();
  const [lastEvents, setLastEvents] = useState<any[]>([]);
  const [decodedEvents, setDecodedEvents] = useState<any[]>([]);
  const [isDebugging, setIsDebugging] = useState(false);

  const debugTransaction = useCallback(
    async (hash: string) => {
      if (!publicClient || isDebugging) return;

      setIsDebugging(true);
      let retryCount = 0;
      const maxRetries = 3;

      const attemptDebug = async () => {
        try {
          console.log(
            `🔍 Debugging transaction: ${hash} (attempt ${retryCount + 1}/${maxRetries})`,
          );

          // Get transaction receipt
          const receipt = await publicClient.getTransactionReceipt({
            hash: hash as `0x${string}`,
          });
          console.log("📋 Transaction receipt:", receipt);

          // Get transaction details
          const tx = await publicClient.getTransaction({
            hash: hash as `0x${string}`,
          });
          console.log("📄 Transaction details:", tx);

          // Parse logs manually
          if (receipt.logs.length > 0) {
            console.log("📝 Raw logs:", receipt.logs);

            // Try to decode logs using contract ABI
            const decodedLogs = receipt.logs.map((log, index) => {
              try {
                console.log(`📊 Log ${index}:`, {
                  address: log.address,
                  topics: log.topics,
                  data: log.data,
                });
                return log;
              } catch (error) {
                console.error(`❌ Error decoding log ${index}:`, error);
                return log;
              }
            });

            setLastEvents(decodedLogs);

            // Try to decode slot machine events specifically
            const slotMachineLogs = receipt.logs.filter(
              (log) =>
                log.address.toLowerCase() ===
                SLOT_MACHINE_CONTRACT.address.toLowerCase(),
            );

            if (slotMachineLogs.length > 0) {
              console.log(
                "🎯 Found slot machine logs, attempting to decode...",
              );
              const decoded = decodeSlotMachineEvents(slotMachineLogs);
              if (decoded) {
                setDecodedEvents([decoded]);
                console.log("✅ Successfully decoded slot machine events");
                setIsDebugging(false);
                return; // Success
              }
            } else {
              console.log("⚠️ No slot machine logs found in transaction");
            }
          } else {
            console.log("⚠️ No logs found in transaction yet");
          }

          // If we haven't found the result and haven't exceeded max retries, retry
          if (retryCount < maxRetries - 1) {
            retryCount++;
            const retryDelay = 2000 + retryCount * 1000; // 2s, 3s, 4s
            console.log(`⏰ Retrying debug in ${retryDelay}ms...`);
            setTimeout(attemptDebug, retryDelay);
          } else {
            console.log("⏰ Max debug attempts reached");
            setIsDebugging(false);
          }
        } catch (error) {
          console.error("❌ Error debugging transaction:", error);

          // Retry on error if we haven't exceeded max retries
          if (retryCount < maxRetries - 1) {
            retryCount++;
            const retryDelay = 3000 + retryCount * 1000; // 3s, 4s, 5s
            console.log(`🔄 Retrying debug in ${retryDelay}ms due to error...`);
            setTimeout(attemptDebug, retryDelay);
          } else {
            console.log("⏰ Max debug attempts reached due to errors");
            setIsDebugging(false);
          }
        }
      };

      // Start debugging
      attemptDebug();
    },
    [publicClient, isDebugging],
  );

  return {
    lastEvents,
    decodedEvents,
    debugTransaction,
    isDebugging,
  };
}

// Hook to check RPC node capabilities
export function useRpcCapabilities() {
  const publicClient = usePublicClient();
  const [supportsEventFiltering, setSupportsEventFiltering] = useState<
    boolean | null
  >(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkRpcCapabilities = useCallback(async () => {
    if (!publicClient || isChecking) return;

    setIsChecking(true);
    try {
      console.log("🔍 Checking RPC node capabilities...");

      // Try to create a simple event filter
      const filter = await publicClient.createEventFilter({
        address: SLOT_MACHINE_CONTRACT.address,
        event: parseAbiItem("event TestEvent()"),
        fromBlock: "latest",
        toBlock: "latest",
      });

      console.log("✅ RPC node supports event filtering");
      setSupportsEventFiltering(true);

      // Clean up the test filter
      try {
        await publicClient.uninstallFilter({ filter });
      } catch (cleanupError) {
        console.log("⚠️ Could not clean up test filter:", cleanupError);
      }
    } catch (error) {
      console.log("❌ RPC node does not support event filtering:", error);
      setSupportsEventFiltering(false);
    } finally {
      setIsChecking(false);
    }
  }, [publicClient, isChecking]);

  // Check capabilities on mount
  useEffect(() => {
    checkRpcCapabilities();
  }, [checkRpcCapabilities]);

  return {
    supportsEventFiltering,
    isChecking,
    checkRpcCapabilities,
  };
}

export function useCurrentAccountBalance() {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useBalance({
    address,
  });

  return {
    balance: formatEth(data?.value || BigInt("0")), // BigInt balance in wei
    symbol: data?.symbol,
    isLoading,
    refetch,
  };
}

export function usePendingRewards() {
  const { address } = useAccount();

  const { data, isLoading, error, refetch } = useReadContract({
    ...SLOT_MACHINE_CONTRACT,
    functionName: "getPendingRewards",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const rewards: PendingReward[] =
    (data as any[])?.map((r) => ({
      amount: r.amount as bigint,
      spinId: r.spinId as bigint,
      timestamp: r.timestamp as bigint,
      reel1: Number(r.reel1),
      reel2: Number(r.reel2),
      reel3: Number(r.reel3),
      multiplier: r.multiplier as bigint,
      isJackpot: r.isJackpot as boolean,
    })) ?? [];

  return {
    rewards,
    isLoading,
    error,
    refetch,
  };
}

export function useTotalPendingRewards() {
  const { address } = useAccount();

  const { data, isLoading, error, refetch } = useReadContract({
    ...SLOT_MACHINE_CONTRACT,
    functionName: "getTotalPendingAmount",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const totalPendingRewards = (data as bigint) ?? BigInt(0);

  return {
    totalPendingRewards,
    isLoading,
    error,
    refetch,
  };
}

export function useCasinoStats() {
  const { data, isLoading, error, refetch } = useReadContract({
    ...SLOT_MACHINE_CONTRACT,
    functionName: "getCasinoStats",
  });

  // Parse the returned tuple data
  const stats = data as
    | [bigint, bigint, bigint, bigint, bigint, boolean]
    | undefined;

  return {
    balance: stats ? formatEth(stats[0]) : "0", // Contract balance in ETH
    totalSpins: stats ? Number(stats[1]) : 0, // Total spins
    totalWagered: stats ? formatEth(stats[2]) : "0", // Total wagered in ETH
    totalPayouts: stats ? formatEth(stats[3]) : "0", // Total payouts in ETH
    jackpotHits: stats ? Number(stats[4]) : 0, // Total jackpot hits
    isActive: stats ? stats[5] : false, // Casino status
    isLoading,
    error,
    refetch,
  };
}

export function usePlayerStats() {
  const { address } = useAccount();

  const { data, isLoading, error, refetch } = useReadContract({
    ...SLOT_MACHINE_CONTRACT,
    functionName: "getPlayerStats",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Parse the returned PlayerStats struct
  const stats = data as [bigint, bigint, bigint, bigint, bigint] | undefined;

  return {
    totalSpins: stats ? Number(stats[0]) : 0,
    totalWagered: stats ? formatEth(stats[1]) : "0",
    totalWon: stats ? formatEth(stats[2]) : "0",
    biggestWin: stats ? formatEth(stats[3]) : "0",
    lastPlayTime: stats ? Number(stats[4]) : 0,
    winRate: stats
      ? Number(stats[2]) > 0
        ? (Number(formatEth(stats[2])) / Number(formatEth(stats[1]))) * 100
        : 0
      : 0,
    isLoading,
    error,
    refetch,
  };
}

export function useLatestWin() {
  const { address } = useAccount();

  const {
    data: pendingRewards,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    ...SLOT_MACHINE_CONTRACT,
    functionName: "getPendingRewards",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Parse the returned PendingReward array and find the latest win
  const rewards = pendingRewards as any[] | undefined;

  let latestWin = null;
  if (rewards && rewards.length > 0) {
    // Sort by timestamp (newest first) and find the most recent win
    const sortedRewards = [...rewards].sort(
      (a, b) => Number(b.timestamp) - Number(a.timestamp),
    );

    latestWin = {
      spinId: Number(sortedRewards[0].spinId),
      amount: formatEth(sortedRewards[0].amount),
      timestamp: Number(sortedRewards[0].timestamp),
      reel1: Number(sortedRewards[0].reel1),
      reel2: Number(sortedRewards[0].reel2),
      reel3: Number(sortedRewards[0].reel3),
      multiplier: Number(sortedRewards[0].multiplier),
      isJackpot: sortedRewards[0].isJackpot,
      winType: sortedRewards[0].isJackpot
        ? "MEGA JACKPOT!"
        : sortedRewards[0].multiplier >= 100
          ? "TRIPLE MATCH"
          : "DOUBLE MATCH",
      timeAgo: getTimeAgo(Number(sortedRewards[0].timestamp)),
    };
  }

  return {
    latestWin,
    totalPendingRewards: rewards ? rewards.length : 0,
    isLoading,
    error,
    refetch,
  };
}

// Helper function to calculate time ago
function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} days ago`;
  if (hours > 0) return `${hours} hours ago`;
  if (minutes > 0) return `${minutes} mins ago`;
  if (seconds > 0) return `${seconds} sec ago`;
  return "Right now";
}
