'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { X, Copy, Check, ExternalLink, LogOut } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getSolBalance, getWalletPortfolio } from '@/lib/coingecko.actions';

interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  publicKey: string;
}

export default function WalletDrawer({ isOpen, onClose, publicKey }: WalletDrawerProps) {
  const { disconnect } = useWallet();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch SOL & Token Portfolio on open/publicKey change
  useEffect(() => {
    if (!isOpen || !publicKey) return;

    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const [sol, tokens] = await Promise.all([
          getSolBalance(publicKey),
          getWalletPortfolio(publicKey),
        ]);
        setSolBalance(sol);
        setPortfolio(tokens);
      } catch (error) {
        console.error('Error loading portfolio:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [isOpen, publicKey]);

  // Copy wallet address helper
  const handleCopy = () => {
    navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 pointer-events-none opacity-0",
          { "opacity-100 pointer-events-auto": isOpen }
        )}
      />

      {/* Slide-out drawer container */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-dark-500 border-l border-purple-100/5 shadow-2xl p-6 flex flex-col transform transition-transform duration-300 ease-in-out translate-x-full",
          { "translate-x-0": isOpen }
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-100/5">
          <div>
            <h4 className="text-lg font-semibold text-white">Solana Wallet</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-purple-100/60">{shortAddress}</span>
              <button
                onClick={handleCopy}
                className="text-purple-100/40 hover:text-white transition-colors"
                title="Copy Address"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-purple-100/60 hover:text-white hover:bg-dark-400 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Portfolio Content */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <span className="text-sm text-purple-100/60 animate-pulse">Loading portfolio...</span>
            </div>
          ) : (
            <>
              {/* Native SOL Balance */}
              <div className="bg-dark-400/50 border border-purple-100/5 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold text-purple-100 uppercase tracking-wider">SOL Balance</span>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {solBalance !== null ? solBalance.toFixed(4) : '0.0000'} SOL
                  </h3>
                </div>
                <div className="size-10 bg-purple-600/20 border border-purple-600/30 rounded-full flex items-center justify-center font-bold text-purple-100 text-sm">
                  SOL
                </div>
              </div>

              {/* SPL Tokens Portfolio */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-purple-100 uppercase tracking-wider">Token Portfolio</h5>
                
                {portfolio.length > 0 ? (
                  <div className="divide-y divide-purple-100/5">
                    {portfolio.map((token) => (
                      <div key={token.mint} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          {token.image ? (
                            <img src={token.image} alt={token.name} className="size-8 rounded-full bg-dark-400" />
                          ) : (
                            <div className="size-8 rounded-full bg-dark-400 flex items-center justify-center text-xs font-bold text-purple-100">
                              {token.symbol.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-white leading-tight">{token.symbol}</p>
                            <p className="text-xs text-purple-100/40 leading-tight truncate max-w-[120px]">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-white">{token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                          {token.valueUsd > 0 && (
                            <p className="text-xs text-purple-100/60">{formatCurrency(token.valueUsd)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-purple-100/40 py-4 text-center">No SPL tokens found in this wallet.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-purple-100/5 space-y-3">
          {/* Orb Explorer Anchor - Helius Parity Rule compliant */}
          <a
            href={`https://orbmarkets.io/address/${publicKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-dark-400 hover:bg-dark-400/80 text-sm font-medium text-purple-100 border border-purple-100/5 transition-all text-center"
          >
            <span>View on Orb Explorer</span>
            <ExternalLink size={14} />
          </a>

          {/* Disconnect trigger */}
          <button
            onClick={() => {
              disconnect();
              onClose();
            }}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-red-500/10 hover:bg-red-500/15 text-sm font-medium text-red-500 border border-red-500/10 transition-all cursor-pointer"
          >
            <span>Disconnect Wallet</span>
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
