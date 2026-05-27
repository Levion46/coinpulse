'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import { searchCoins } from '@/lib/coingecko.actions';

export default function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchCoin[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Keyboard shortcut handler (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch search results on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { coins } = await searchCoins(query);
        setResults(coins);
      } catch (error) {
        console.error('Failed to search:', error);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Handle coin selection
  const handleSelect = (coinId: string) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    router.push(`/coins/${coinId}`);
  };

  return (
    <div id="search-modal">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="trigger">
            <Search className="size-4" />
            <span>Search</span>
            <kbd className="kbd">⌘K</kbd>
          </button>
        </DialogTrigger>
        <DialogContent className="dialog p-0 border-none outline-none overflow-hidden" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Search Coins</DialogTitle>
          </DialogHeader>
          <div className="cmd-input flex items-center border-b border-dark-400 px-4 py-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-purple-100" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a coin name or symbol to search..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-purple-100 disabled:cursor-not-allowed disabled:opacity-50 text-white"
              autoFocus
            />
          </div>
          <div className="list overflow-y-auto p-2">
            {loading ? (
              <div className="empty">Searching...</div>
            ) : results.length > 0 ? (
              results.map((coin) => (
                <div
                  key={coin.id}
                  onClick={() => handleSelect(coin.id)}
                  className="search-item px-3 rounded-md"
                >
                  <div className="coin-info">
                    {coin.thumb && (
                      <img src={coin.thumb} alt={coin.name} />
                    )}
                    <div>
                      <span className="font-medium text-white">{coin.name}</span>
                      <span className="coin-symbol">{coin.symbol}</span>
                    </div>
                  </div>
                  <div className="coin-price text-right col-span-1 text-white font-semibold">
                    {coin.data?.price ? formatCurrency(coin.data.price) : '—'}
                  </div>
                  <div className={cn(
                    "coin-change text-right justify-end col-span-1 font-semibold flex items-center gap-1",
                    coin.data?.price_change_percentage_24h > 0
                      ? "text-green-500"
                      : coin.data?.price_change_percentage_24h < 0
                      ? "text-red-500"
                      : "text-gray-400"
                  )}>
                    {coin.data?.price_change_percentage_24h !== 0 ? (
                      <>
                        {formatPercentage(coin.data.price_change_percentage_24h)}
                        {coin.data.price_change_percentage_24h > 0 ? (
                          <TrendingUp className="size-4" />
                        ) : (
                          <TrendingDown className="size-4" />
                        )}
                      </>
                    ) : '—'}
                  </div>
                </div>
              ))
            ) : query ? (
              <div className="empty">No results found.</div>
            ) : (
              <div className="empty">Type to search cryptocurrencies...</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
