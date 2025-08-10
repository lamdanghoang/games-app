"use client";

import { useMiniKit, useAddFrame } from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "./components/DemoComponents";
import { Icon } from "./components/DemoComponents";
import { ChartColumn, House, Table2, Wallet2 } from "lucide-react";
import dynamic from "next/dynamic";

const SlotMachineComponent = dynamic(() => import("./components/SlotMachine"));
const PayoutTableComponent = dynamic(() => import("./components/PayoutTable"));
const StaticsComponent = dynamic(() => import("./components/Statics"));
const AccountComponent = dynamic(() => import("./components/Account"));

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  /* Frame */
  const addFrame = useAddFrame();
  // const openUrl = useOpenUrl();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-[var(--app-accent)] p-4"
          icon={<Icon name="plus" size="sm" />}
        >
          Save Frame
        </Button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
          <Icon name="check" size="sm" className="text-[#0052FF]" />
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <header className="flex justify-between items-center mb-3 h-11">
          <div>
            <div className="flex items-center space-x-2">
              <Wallet className="z-10">
                <ConnectWallet>
                  <Name className="text-inherit" />
                </ConnectWallet>
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
            </div>
          </div>
          <div>{saveFrameButton}</div>
        </header>

        <main className="flex-1">
          {activeTab === "home" && <SlotMachineComponent />}
          {activeTab === "payout" && <PayoutTableComponent />}
          {activeTab === "statics" && <StaticsComponent />}
          {activeTab === "wallet" && <AccountComponent />}

          {/* Slot Machine Frame */}
        </main>

        {/* Bottom Navigation Tabs */}
        <footer className="fixed bottom-0 left-0 right-0 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-t-3xl shadow-lg">
          <div className="flex justify-around items-center py-3 px-4">
            {/* Home Tab */}
            <button
              onClick={() => setActiveTab("home")}
              className={`flex flex-col items-center space-y-1 transition-all duration-200 ${
                activeTab === "home" ? "scale-110" : "hover:scale-105"
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <House className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-xs font-medium">Home</span>
            </button>

            {/* Statics Tab */}
            <button
              onClick={() => setActiveTab("statics")}
              className={`flex flex-col items-center space-y-1 transition-all duration-200 ${
                activeTab === "statics" ? "scale-110" : "hover:scale-105"
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <ChartColumn className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-xs font-medium">Statics</span>
            </button>

            {/* Payout Tab */}
            <button
              onClick={() => setActiveTab("payout")}
              className={`flex flex-col items-center space-y-1 transition-all duration-200 ${
                activeTab === "payout" ? "scale-110" : "hover:scale-105"
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <Table2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-xs font-medium">Payouts</span>
            </button>

            {/* Wallet Tab */}
            <button
              onClick={() => setActiveTab("wallet")}
              className={`flex flex-col items-center space-y-1 transition-all duration-200 ${
                activeTab === "wallet" ? "scale-110" : "hover:scale-105"
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <Wallet2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-xs font-medium">Wallet</span>
            </button>

            {/* Account Tab */}
            {/* <button
              onClick={() => setActiveTab("account")}
              className={`flex flex-col items-center space-y-1 transition-all duration-200 ${
                activeTab === "account" ? "scale-110" : "hover:scale-105"
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-white">Account</span>
            </button> */}
          </div>
        </footer>
      </div>
    </div>
  );
}
