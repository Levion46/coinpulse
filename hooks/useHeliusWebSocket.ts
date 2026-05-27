'use client';

import { useEffect, useRef, useState } from 'react';

export interface HeliusActivity {
  signature: string;
  slot: number;
  err: boolean;
  logs: string[];
  timestamp: number;
}

interface UseHeliusWebSocketProps {
  address?: string | null;
}

export const useHeliusWebSocket = ({ address }: UseHeliusWebSocketProps) => {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef<number>(1000); // Start reconnect delay at 1s
  const [activities, setActivities] = useState<HeliusActivity[]>([]);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

  useEffect(() => {
    if (!heliusApiKey) {
      console.warn('Helius API Key is not configured in environment variables.');
      return;
    }

    const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

    const connect = () => {
      console.log('Connecting to Helius WebSockets...');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const send = (payload: Record<string, unknown>) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        }
      };

      ws.onopen = () => {
        console.log('Successfully connected to Helius WebSocket server.');
        setIsConnected(true);
        reconnectDelayRef.current = 1000; // Reset reconnect delay

        // Keep connection alive: send standard WebSocket ping frames every 30 seconds
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            // standard send ping frame (standard browser ws uses empty send or standard frames)
            send({ jsonrpc: '2.0', method: 'ping', id: 'keep-alive' });
          }
        }, 30000);

        // 1. Subscribe to general Solana slot changes
        send({
          jsonrpc: '2.0',
          id: 'slot-sub',
          method: 'slotSubscribe',
          params: [],
        });

        // 2. Subscribe to transaction logs
        if (address) {
          // If address is provided, monitor transactions mentioning the address
          send({
            jsonrpc: '2.0',
            id: 'logs-sub-addr',
            method: 'logsSubscribe',
            params: [
              { mentions: [address] },
              { commitment: 'confirmed' }
            ],
          });
        } else {
          // If no address is provided, stream general transaction activity for Raydium program to make it interesting
          send({
            jsonrpc: '2.0',
            id: 'logs-sub-all',
            method: 'logsSubscribe',
            params: [
              { mentions: ['675k1DMJy9s1ZYL7435fS8Hdg28f6RCYtkc3F4yDyp4B'] }, // Raydium Liquidity Pool v4
              { commitment: 'confirmed' }
            ],
          });
        }
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        // Ignore standard subscription receipts
        if (msg.result !== undefined && typeof msg.result === 'number') {
          return;
        }

        // Handle slot notifications
        if (msg.method === 'slotNotification') {
          const slot = msg.params?.result?.slot;
          if (slot) setCurrentSlot(slot);
        }

        // Handle transaction logs notifications
        if (msg.method === 'logsNotification') {
          const result = msg.params?.result;
          if (result) {
            const newActivity: HeliusActivity = {
              signature: result.value.signature,
              slot: result.context.slot,
              err: !!result.value.err,
              logs: result.value.logs || [],
              timestamp: Date.now(),
            };

            setActivities((prev) => [newActivity, ...prev].slice(0, 15));
          }
        }
      };

      const handleDisconnect = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Auto-reconnection with exponential backoff capped at 30 seconds
        const delay = reconnectDelayRef.current;
        console.log(`Helius WebSocket disconnected. Reconnecting in ${delay}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
          connect();
        }, delay);
      };

      ws.onclose = handleDisconnect;
      ws.onerror = (error) => {
        console.error('Helius WebSocket error encountered:', error);
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [address, heliusApiKey]);

  return {
    activities,
    currentSlot,
    isConnected,
  };
};
