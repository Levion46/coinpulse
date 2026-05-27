'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useHeliusWebSocket } from '@/hooks/useHeliusWebSocket';
import DataTable from '@/components/DataTable';
import { cn, timeAgo } from '@/lib/utils';
import { ExternalLink, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function HeliusTerminalLogs() {
  const { publicKey } = useWallet();
  const address = publicKey ? publicKey.toString() : null;
  const { activities, currentSlot, isConnected } = useHeliusWebSocket({ address });

  const columns: DataTableColumn<any>[] = [
    {
      header: 'Time',
      cellClassName: 'time-cell text-purple-100/60 text-sm py-3',
      cell: (act) => timeAgo(act.timestamp),
    },
    {
      header: 'Slot',
      cellClassName: 'slot-cell text-white font-medium text-sm py-3',
      cell: (act) => `#${act.slot}`,
    },
    {
      header: 'Signature',
      cellClassName: 'signature-cell font-mono text-purple-100 text-sm py-3',
      cell: (act) => (
        <a
          href={`https://orbmarkets.io/tx/${act.signature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-white transition-all hover:underline"
        >
          <span>{act.signature.slice(0, 6)}...{act.signature.slice(-6)}</span>
          <ExternalLink size={12} className="text-purple-100/40" />
        </a>
      ),
    },
    {
      header: 'Status',
      cellClassName: 'status-cell font-semibold text-sm py-3',
      cell: (act) => (
        <div className="flex items-center gap-1.5">
          {act.err ? (
            <>
              <ShieldAlert size={14} className="text-red-500" />
              <span className="text-red-500">Failed</span>
            </>
          ) : (
            <>
              <ShieldCheck size={14} className="text-green-500" />
              <span className="text-green-500">Success</span>
            </>
          )}
        </div>
      ),
    },
    {
      header: 'Activity Log / Instruction',
      cellClassName: 'logs-cell text-xs text-purple-100/60 font-mono truncate max-w-[200px] md:max-w-[350px] py-3',
      cell: (act) => {
        const invokeLog = act.logs.find((log: string) => log.includes('invoke'));
        if (invokeLog) {
          const parts = invokeLog.split(' ');
          const programId = parts[1];
          if (programId === '675k1DMJy9s1ZYL7435fS8Hdg28f6RCYtkc3F4yDyp4B') return 'Raydium Liquidity Pool Swap';
          if (programId === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4') return 'Jupiter DEX Swap';
          if (programId === '11111111111111111111111111111111') return 'SOL System Transfer';
          if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') return 'SPL Token Transfer';
          return `Invoke Program: ${programId.slice(0, 4)}...`;
        }
        return act.logs[0] || 'Unknown Program Call';
      },
    },
  ];

  return (
    <div id="categories" className="custom-scrollbar mt-7 w-full p-6 bg-dark-500 border border-purple-100/5 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-purple-100/5 mb-4">
        <div>
          <h4 className="text-xl font-semibold text-white">Solana Live HFT Ticker</h4>
          <p className="text-xs text-purple-100/40 mt-1">
            {address 
              ? `Streaming live transaction activity for connected wallet: ${address.slice(0, 6)}...`
              : 'Streaming live Raydium Liquidity Pool transactions from Solana mainnet-beta'
            }
          </p>
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
            <span className="text-purple-100/60">{isConnected ? 'Live WebSockets Connected' : 'WS Reconnecting'}</span>
          </div>
          {currentSlot && (
            <span className="bg-dark-400 px-3 py-1 rounded-md text-white font-mono text-xs border border-purple-100/5">
              Slot: {currentSlot.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={activities}
        rowKey={(act) => act.signature}
        tableClassName="w-full text-left"
        bodyRowClassName="hover:bg-dark-400/20!"
      />
    </div>
  );
}
