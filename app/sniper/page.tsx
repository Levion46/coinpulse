'use client';

import React, { useState, useEffect } from 'react';
import {
  getHeliusWebhooks,
  createHeliusWebhook,
  deleteHeliusWebhook
} from '@/lib/coingecko.actions';
import {
  Crosshair,
  Settings,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Activity
} from 'lucide-react';
import Link from 'next/link';

interface Webhook {
  webhookID: string;
  webhookURL: string;
  transactionTypes: string[];
  accountAddresses: string[];
  webhookType: string;
}

const RAYDIUM_POOL_V4 = '675kPX9M4sg3aJ679yw1Wp6t6385Ua7778G3R6rL';

const SniperDashboard = () => {
  // Webhook State
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('https://coinpulse.app/api/webhook/sniper');
  const [newMonitoredAddress, setNewMonitoredAddress] = useState(RAYDIUM_POOL_V4);
  
  // Sniper Rules Configuration State
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(true);
  const [buyAmountSol, setBuyAmountSol] = useState(0.25);
  const [minLiquidityUsd, setMinLiquidityUsd] = useState(25000);
  const [maxSlippage, setMaxSlippage] = useState(15); // 15%
  
  // Filters Toggles
  const [requireImmutable, setRequireImmutable] = useState(true);
  const [requireNoFreeze, setRequireNoFreeze] = useState(true);
  const [requireNoMint, setRequireNoMint] = useState(true);
  const [maxRugCheckScore, setMaxRugCheckScore] = useState(1000);

  // States
  const [loading, setLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);

  // Fetch registered webhooks
  const loadWebhooks = async () => {
    try {
      const list = await getHeliusWebhooks();
      setWebhooks(list);
    } catch (err) {
      console.error('Failed to load Helius webhooks:', err);
    }
  };

  useEffect(() => {
    loadWebhooks();
  }, []);

  // Handle Webhook Registration
  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl) return;

    setLoading(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const addresses = newMonitoredAddress ? [newMonitoredAddress] : [RAYDIUM_POOL_V4];
      const newWebhook = await createHeliusWebhook(newWebhookUrl, addresses);
      setWebhooks((prev) => [...prev, newWebhook]);
      setActionSuccessMsg('Helius High-Frequency Webhook registered successfully!');
      setNewMonitoredAddress(RAYDIUM_POOL_V4);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create webhook. Check your Helius API Key.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Webhook Deletion
  const handleDeleteWebhook = async (id: string) => {
    setLoading(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const success = await deleteHeliusWebhook(id);
      if (success) {
        setWebhooks((prev) => prev.filter((w) => w.webhookID !== id));
        setActionSuccessMsg('Webhook removed successfully.');
      } else {
        throw new Error('Helius API rejected webhook deletion');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete webhook.');
    } finally {
      setLoading(false);
    }
  };

  // Simulate Incoming Webhook events
  useEffect(() => {
    const logs = [
      '⚡ [SYS] Live high-frequency monitor standing by...',
      `🔍 [FILTER] Monitoring Raydium Pool Creator: ${RAYDIUM_POOL_V4.slice(0, 8)}...`,
      '💡 [RULE] Auto-execute rules: Min Liquidity $25k | Auto-Buy: 0.25 SOL',
    ];
    setSimulatedLogs(logs);

    if (!autoBuyEnabled) return;

    const interval = setInterval(() => {
      const simulatedTokens = [
        { name: 'QuantumSol', symbol: 'QTS', lp: 120400, rug: 450, mint: 'Disabled', freeze: 'Disabled' },
        { name: 'ShadowCoin', symbol: 'SHD', lp: 8400, rug: 1950, mint: 'Disabled', freeze: 'Enabled' },
        { name: 'AeroSwap', symbol: 'AER', lp: 48900, rug: 3100, mint: 'Enabled', freeze: 'Disabled' },
        { name: 'NeptuneToken', symbol: 'NEPT', lp: 62000, rug: 120, mint: 'Disabled', freeze: 'Disabled' }
      ];

      const token = simulatedTokens[Math.floor(Math.random() * simulatedTokens.length)];
      const timestamp = new Date().toLocaleTimeString();

      const newLogs = [
        `🔔 [${timestamp}] [NEW POOL] Detected LP Pool creation for ${token.name} (${token.symbol})`,
        `📊 [${timestamp}] [METRICS] Liquidity: $${token.lp.toLocaleString()} | RugCheck score: ${token.rug}`,
        `🛡️ [${timestamp}] [SECURITY] Mint Authority: ${token.mint} | Freeze Authority: ${token.freeze}`
      ];

      // Evaluate rules
      let failedRules = [];
      if (token.lp < minLiquidityUsd) failedRules.push(`LP $${token.lp.toLocaleString()} < $${minLiquidityUsd.toLocaleString()}`);
      if (requireNoMint && token.mint === 'Enabled') failedRules.push('Mint Authority is Enabled');
      if (requireNoFreeze && token.freeze === 'Enabled') failedRules.push('Freeze Authority is Enabled');
      if (token.rug > maxRugCheckScore) failedRules.push(`RugCheck score ${token.rug} > ${maxRugCheckScore}`);

      if (failedRules.length > 0) {
        newLogs.push(`❌ [${timestamp}] [SNIPER REJECTED] Token does not match rules: ${failedRules.join(', ')}`);
      } else {
        newLogs.push(`🚀 [${timestamp}] [SNIPER EXECUTION] Rules match! Sending Swap bundle for ${buyAmountSol} SOL`);
        newLogs.push(`✅ [${timestamp}] [SNIPER CONFIRMED] Jito Bundle confirmed in slot. Bought ${token.name}. Signature: 4kP3...o5e3`);
      }

      setSimulatedLogs((prev) => [...prev, ...newLogs].slice(-15));
    }, 8000);

    return () => clearInterval(interval);
  }, [autoBuyEnabled, buyAmountSol, minLiquidityUsd, requireNoMint, requireNoFreeze, maxRugCheckScore]);

  return (
    <main id="coins-page">
      <div className="content">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
              <Crosshair size={22} />
            </div>
            <div>
              <h4 className="text-2xl font-bold text-white tracking-tight">Sniper Cockpit</h4>
              <p className="text-xs text-purple-100/50 mt-0.5">High-frequency Webhook monitoring & rules management</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${
              autoBuyEnabled 
                ? 'text-green-500 bg-green-500/10 border-green-500/20' 
                : 'text-purple-100/60 bg-purple-100/5 border-purple-100/10'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${autoBuyEnabled ? 'bg-green-500 animate-pulse' : 'bg-purple-100/40'}`} />
              {autoBuyEnabled ? 'Monitor Active' : 'Monitor Paused'}
            </span>
          </div>
        </div>

        {actionSuccessMsg && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-lg flex gap-3 text-sm items-start">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Action Confirmed</p>
              <p className="text-purple-100/60 mt-0.5 text-xs">{actionSuccessMsg}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex gap-3 text-sm items-start">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Action Denied</p>
              <p className="text-purple-100/60 mt-0.5 text-xs">{errorMsg}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Sniper Rules Controls (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-dark-500 p-5 rounded-lg border border-white/5 space-y-5">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <Settings className="text-green-500" size={18} />
                <h5 className="text-lg font-semibold text-white">Snipe Parameters</h5>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Auto Buy Toggle & SOL size */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-dark-600/30 p-3.5 rounded border border-white/5">
                    <div>
                      <p className="text-sm font-semibold text-white">Automated Sniper Execution</p>
                      <p className="text-[10px] text-purple-100/50 mt-0.5">Auto-buy pools matching rule conditions</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoBuyEnabled}
                      onChange={(e) => setAutoBuyEnabled(e.target.checked)}
                      className="w-5 h-5 rounded border-white/5 accent-green-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-purple-100/50 font-semibold flex items-center justify-between mb-1.5">
                      <span>Snipe Buy Size</span>
                      <span className="text-white font-mono">{buyAmountSol} SOL</span>
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="5.0"
                      step="0.05"
                      value={buyAmountSol}
                      onChange={(e) => setBuyAmountSol(parseFloat(e.target.value))}
                      className="w-full h-1 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-[9px] text-purple-100/30 mt-1 font-mono">
                      <span>0.05 SOL</span>
                      <span>5.0 SOL</span>
                    </div>
                  </div>
                </div>

                {/* Min Liquidity & Max Slippage */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-purple-100/50 font-semibold flex items-center justify-between mb-1.5">
                      <span>Min Liquidity Pool backing</span>
                      <span className="text-white font-mono">${minLiquidityUsd.toLocaleString()}</span>
                    </label>
                    <input
                      type="range"
                      min="1000"
                      max="100000"
                      step="1000"
                      value={minLiquidityUsd}
                      onChange={(e) => setMinLiquidityUsd(parseInt(e.target.value))}
                      className="w-full h-1 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-[9px] text-purple-100/30 mt-1 font-mono">
                      <span>$1,000</span>
                      <span>$100,000</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-purple-100/50 font-semibold flex items-center justify-between mb-1.5">
                      <span>Maximum Slippage Limit</span>
                      <span className="text-white font-mono">{maxSlippage}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={maxSlippage}
                      onChange={(e) => setMaxSlippage(parseInt(e.target.value))}
                      className="w-full h-1 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-[9px] text-purple-100/30 mt-1 font-mono">
                      <span>1%</span>
                      <span>50%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Filters */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-purple-100/40">On-chain Security Filters</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center justify-between bg-dark-600/30 px-3.5 py-2.5 rounded border border-white/5 text-xs text-purple-100/80 cursor-pointer hover:border-white/10 transition-colors">
                    <span className="font-medium">Immutable Metadata</span>
                    <input
                      type="checkbox"
                      checked={requireImmutable}
                      onChange={(e) => setRequireImmutable(e.target.checked)}
                      className="w-4 h-4 rounded border-white/5 accent-green-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between bg-dark-600/30 px-3.5 py-2.5 rounded border border-white/5 text-xs text-purple-100/80 cursor-pointer hover:border-white/10 transition-colors">
                    <span className="font-medium">Freeze Authority Disabled</span>
                    <input
                      type="checkbox"
                      checked={requireNoFreeze}
                      onChange={(e) => setRequireNoFreeze(e.target.checked)}
                      className="w-4 h-4 rounded border-white/5 accent-green-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between bg-dark-600/30 px-3.5 py-2.5 rounded border border-white/5 text-xs text-purple-100/80 cursor-pointer hover:border-white/10 transition-colors">
                    <span className="font-medium">Mint Authority Disabled</span>
                    <input
                      type="checkbox"
                      checked={requireNoMint}
                      onChange={(e) => setRequireNoMint(e.target.checked)}
                      className="w-4 h-4 rounded border-white/5 accent-green-500 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="mt-3">
                  <label className="text-xs text-purple-100/50 font-semibold flex items-center justify-between mb-1.5">
                    <span>Max RugCheck Score Limit</span>
                    <span className="text-white font-mono">{maxRugCheckScore === 1000 ? '1,000 (Safe)' : maxRugCheckScore === 2500 ? '2,500 (Moderate)' : 'Under 5,000'}</span>
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    step="500"
                    value={maxRugCheckScore}
                    onChange={(e) => setMaxRugCheckScore(parseInt(e.target.value))}
                    className="w-full h-1 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                  <div className="flex justify-between text-[9px] text-purple-100/30 mt-1 font-mono">
                    <span>500 (Very Safe)</span>
                    <span>5,000 (Risky)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Helius Webhook CRUD List */}
            <div className="bg-dark-500 p-5 rounded-lg border border-white/5 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <Server className="text-green-500" size={18} />
                <h5 className="text-lg font-semibold text-white">Monitored Webhooks</h5>
              </div>

              {webhooks.length === 0 ? (
                <div className="bg-dark-600/30 border border-white/5 rounded p-5 text-center text-xs text-purple-100/40">
                  No active webhooks registered. Use the register form to create a webhook monitor.
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((wh) => (
                    <div key={wh.webhookID} className="bg-dark-600/50 p-4 rounded border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">Helius Router Stream</span>
                          <span className="px-1.5 py-0.5 rounded border border-green-500/20 text-green-500 bg-green-500/10 text-[9px] font-bold uppercase">
                            {wh.webhookType}
                          </span>
                        </div>
                        <p className="font-mono text-purple-100/60 truncate max-w-xs md:max-w-md">URL: {wh.webhookURL}</p>
                        <p className="font-mono text-purple-100/40 truncate max-w-xs md:max-w-md">Monitored account: {wh.accountAddresses[0]}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteWebhook(wh.webhookID)}
                        disabled={loading}
                        className="self-end md:self-center p-2 rounded border border-red-500/15 hover:border-red-500/40 text-red-500 hover:bg-red-500/5 transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Webhook Register Form & Simulated Feed (Right 1 column) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Create Webhook Form */}
            <form onSubmit={handleRegisterWebhook} className="bg-dark-500 p-5 rounded-lg border border-white/5 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <Plus className="text-green-500" size={18} />
                <h5 className="text-lg font-semibold text-white">Register Monitor</h5>
              </div>

              <div className="space-y-3.5 text-xs text-left">
                <div>
                  <label className="text-purple-100/50 font-semibold mb-1 block">Webhook Endpoint URL</label>
                  <input
                    type="url"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    required
                    className="w-full bg-dark-600 border border-white/5 rounded px-3 py-2 text-white outline-none focus:border-green-500/30 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-purple-100/50 font-semibold mb-1 block">Monitored Contract Address</label>
                  <input
                    type="text"
                    value={newMonitoredAddress}
                    onChange={(e) => setNewMonitoredAddress(e.target.value)}
                    required
                    placeholder="Raydium Router V4"
                    className="w-full bg-dark-600 border border-white/5 rounded px-3 py-2 text-white outline-none focus:border-green-500/30 font-mono transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white hover:bg-neutral-200 text-black font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  Register Webhook
                </button>
              </div>
            </form>

            {/* Live Webhook Feed logs console */}
            <div className="bg-dark-500 p-5 rounded-lg border border-white/5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="text-green-500 animate-pulse" size={18} />
                  <h5 className="text-lg font-semibold text-white">Live Monitor logs</h5>
                </div>
              </div>

              <div className="bg-dark-600/90 border border-white/5 rounded p-4 font-mono text-[10px] text-left text-green-400 space-y-1.5 h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
                {simulatedLogs.map((log, idx) => (
                  <p key={idx} className={
                    log.includes('[SNIPER EXECUTION]') ? 'text-amber-300 font-semibold' :
                    log.includes('[SNIPER CONFIRMED]') ? 'text-green-300 font-bold' :
                    log.includes('❌') ? 'text-red-400' : 'text-green-400/80'
                  }>
                    {log}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default SniperDashboard;
