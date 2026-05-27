'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js';
import {
  Settings,
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Info,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';

interface SwapPanelProps {
  coinName: string;
  coinSymbol: string;
  coinImage: string;
  contractAddress: string | null;
  decimals: number;
}

const JITO_TIP_ACCOUNTS = [
  '96aQD3mL64G758u7nssTqV2m9oTze15ALgpao9B91gJU',
  'HFqNZ5gfeMzJt2c7W5sE2qBt15K2Tx1E5kyE3vj3k6fT',
  'Cw8CFyM99B1bXWZp3C5tQH8g1y3fn895ZCmTv6s23sxs',
  'GoDMRDW6W5Sg6PceN3o7sA59oM8g1g6wR4bN7Qe9nJ',
  'ADa5V6CcgcUJwzoLs9a3Xo7Q1Z8pD74Z6m5k7sSzoYg',
  'ADuUk9ZGLFrhyN4C1C4CybRCFt3q49eT7zT4F4H8a2',
  'DttWaMuDTUBjDrx11XNFkn9B7J5AE6gX4C2t8nB',
  '3AVi9VwMQvH3M74qTo6LWDs2xJk6fQWk5n4hMpHp2t52'
];

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const SwapPanel = ({ coinName, coinSymbol, coinImage, contractAddress, decimals }: SwapPanelProps) => {
  const { publicKey, signTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();

  // State Management
  const [isBuy, setIsBuy] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5); // 0.5%
  const [showSettings, setShowSettings] = useState(false);
  const [priorityLevel, setPriorityLevel] = useState<'market' | 'turbo'>('market');
  const [useJito, setUseJito] = useState(true);
  const [jitoTip, setJitoTip] = useState(0.0002); // SOL

  // Balances
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [quoteResponse, setQuoteResponse] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txState, setTxState] = useState<'idle' | 'quoting' | 'confirming' | 'submitting' | 'success'>('idle');

  // Client RPC dynamic setup
  const rpcUrl = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!key) return 'https://api.mainnet-beta.solana.com';
    return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  }, []);

  const connection = useMemo(() => new Connection(rpcUrl, 'confirmed'), [rpcUrl]);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connected) {
      setSolBalance(null);
      setTokenBalance(null);
      return;
    }

    try {
      // SOL Balance
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / 1e9);

      // Token Balance
      if (contractAddress) {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: new PublicKey(contractAddress),
        });
        const uiAmount = tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
        setTokenBalance(uiAmount);
      }
    } catch (error) {
      console.error('Error fetching balances inside SwapPanel:', error);
    }
  }, [publicKey, connected, connection, contractAddress]);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  // Get active inputs
  const inputMint = isBuy ? SOL_MINT : (contractAddress || '');
  const outputMint = isBuy ? (contractAddress || '') : SOL_MINT;
  const inputDecimals = isBuy ? 9 : decimals;
  const outputDecimals = isBuy ? decimals : 9;

  // Handle Quick Percentages
  const handlePercentClick = (percent: number) => {
    const baseBalance = isBuy ? solBalance : tokenBalance;
    if (baseBalance === null || baseBalance <= 0) return;
    
    // Reserve SOL for transaction fees
    const calculatedAmount = isBuy 
      ? Math.max(0, baseBalance * percent - 0.015) 
      : baseBalance * percent;
      
    setInputAmount(calculatedAmount > 0 ? calculatedAmount.toFixed(4) : '');
  };

  // Fetch Jupiter Quote
  const fetchQuote = useCallback(async () => {
    if (!inputAmount || isNaN(Number(inputAmount)) || Number(inputAmount) <= 0 || !contractAddress) {
      setOutputAmount('');
      setQuoteResponse(null);
      setErrorMsg(null);
      return;
    }

    setTxState('quoting');
    setErrorMsg(null);

    try {
      const amountInLamports = Math.floor(Number(inputAmount) * Math.pow(10, inputDecimals));
      const slipBps = Math.floor(slippage * 100);

      const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInLamports}&slippageBps=${slipBps}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Failed to fetch swap quotes from Jupiter routing');
      }

      const quote = await res.json();
      if (quote.error) {
        throw new Error(quote.error);
      }

      setQuoteResponse(quote);
      const outAmount = Number(quote.outAmount) / Math.pow(10, outputDecimals);
      setOutputAmount(outAmount.toFixed(isBuy ? 2 : 5));
      setTxState('idle');
    } catch (error: any) {
      console.error('Quote fetch error:', error);
      setErrorMsg(error.message || 'Route compilation failed');
      setQuoteResponse(null);
      setOutputAmount('');
      setTxState('idle');
    }
  }, [inputAmount, inputMint, outputMint, inputDecimals, outputDecimals, slippage, contractAddress, isBuy]);

  // Dynamic Trigger
  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [inputAmount, isBuy, slippage, fetchQuote]);

  // Fetch priority fee from Helius Server action
  const getDynamicPriorityFee = async (): Promise<number> => {
    try {
      // Default to 1000 microLamports if anything fails
      const accountKeys = [SOL_MINT, contractAddress || ''].filter(Boolean);
      
      // Let's call our Helius priority fee estimate API
      const { getSolanaPriorityFeeEstimate } = await import('@/lib/coingecko.actions');
      const estimatedFee = await getSolanaPriorityFeeEstimate(accountKeys);
      
      return priorityLevel === 'turbo' ? Math.ceil(estimatedFee * 1.5) : estimatedFee;
    } catch (error) {
      console.warn('Unable to get dynamic priority fee estimate:', error);
      return 1000;
    }
  };

  // Perform Swap Transaction
  const handleSwap = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setVisible(true);
      return;
    }

    if (!quoteResponse) return;

    setLoading(true);
    setTxState('confirming');
    setErrorMsg(null);

    try {
      // Get priority fee estimate
      const priorityFee = await getDynamicPriorityFee();

      // Request Jupiter serialized swap transaction
      const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          computeUnitPriceMicroLamports: priorityFee,
          asLegacyTransaction: false,
        }),
      });

      if (!swapRes.ok) {
        throw new Error('Jupiter routing was unable to serialize the transaction');
      }

      const { swapTransaction } = await swapRes.json();
      
      // Deserialize the VersionedTransaction
      const transactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      // Inject Jito Tip if active
      if (useJito && jitoTip > 0) {
        try {
          // Decompile transaction message
          const addressLookupTableAccounts = await Promise.all(
            transaction.message.addressTableLookups.map(async (lookup) => {
              return await connection.getAddressLookupTable(new PublicKey(lookup.accountKey));
            })
          );
          
          const decompiledMessage = TransactionMessage.decompile(
            transaction.message,
            {
              addressLookupTableAccounts: addressLookupTableAccounts.map(res => res.value).filter(Boolean) as any,
            }
          );

          // Select random Jito tip account to avoid bottlenecks
          const jitoAccount = new PublicKey(
            JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]
          );

          // Construct Jito tip instruction
          const jitoInstruction = SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: jitoAccount,
            lamports: Math.floor(jitoTip * 1e9),
          });

          // Append Jito transfer instruction
          decompiledMessage.instructions.push(jitoInstruction);

          // Recompile v0 message
          transaction.message = decompiledMessage.compileToV0Message(
            addressLookupTableAccounts.map(res => res.value).filter(Boolean) as any
          );
        } catch (jitoErr) {
          console.warn('Jito decompilation failed, falling back to standard transaction:', jitoErr);
        }
      }

      // Wallet signing
      const signedTransaction = await signTransaction(transaction);
      
      setTxState('submitting');
      const rawTx = signedTransaction.serialize();

      // Submit raw transaction
      const txid = await connection.sendRawTransaction(rawTx, {
        skipPreflight: true,
        maxRetries: 3,
      });

      // Confirm transaction
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature: txid,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');

      setTxSignature(txid);
      setTxState('success');
      setInputAmount('');
      setOutputAmount('');
      fetchBalances();
    } catch (err: any) {
      console.error('Swap Execution error:', err);
      setErrorMsg(err.message || 'Transaction signing or confirmation rejected.');
      setTxState('idle');
    } finally {
      setLoading(false);
    }
  };

  const isInsufficientBalance = useMemo(() => {
    const val = Number(inputAmount);
    if (!val || isNaN(val)) return false;
    const baseBalance = isBuy ? solBalance : tokenBalance;
    if (baseBalance === null) return false;
    return val > baseBalance;
  }, [inputAmount, solBalance, tokenBalance, isBuy]);

  // Non-Solana fallback check
  if (!contractAddress) {
    return (
      <div className="details flex flex-col gap-4">
        <h4>Exchange / Trade</h4>
        <div className="bg-dark-500 p-6 rounded-lg border border-white/5 text-center flex flex-col items-center gap-3">
          <Info className="text-purple-100/40" size={32} />
          <p className="text-sm text-purple-100/60 leading-relaxed max-w-xs mx-auto">
            Trading features are exclusively supported for Solana blockchain assets at this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="details flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h4 className="!pb-0">Swap Assets</h4>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-purple-100/60 hover:text-white transition-colors p-1"
        >
          <Settings size={18} className={showSettings ? 'text-green-500 rotate-45 transition-transform duration-300' : 'transition-transform duration-300'} />
        </button>
      </div>

      {showSettings && (
        <div className="bg-dark-600/80 p-4 rounded border border-white/5 flex flex-col gap-3.5 text-xs">
          <div>
            <p className="text-purple-100/50 mb-1.5 font-semibold">Slippage Tolerance</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.1, 0.5, 1.0, 2.0].map((val) => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={`py-1 rounded border text-center font-medium ${
                    slippage === val
                      ? 'border-green-500 text-green-500 bg-green-500/10'
                      : 'border-white/5 hover:border-white/10 text-purple-100'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/5 pt-3 flex items-center justify-between">
            <div>
              <p className="text-purple-100/50 font-semibold mb-0.5">Helius Priority Fee</p>
              <p className="text-[10px] text-purple-100/40">Real-time RPC gas estimate</p>
            </div>
            <div className="flex gap-1">
              {['market', 'turbo'].map((level) => (
                <button
                  key={level}
                  onClick={() => setPriorityLevel(level as any)}
                  className={`px-3 py-1 rounded border capitalize font-semibold ${
                    priorityLevel === level
                      ? 'border-green-500 text-green-500 bg-green-500/10'
                      : 'border-white/5 hover:border-white/10 text-purple-100'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/5 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-purple-100/50 font-semibold mb-0.5">Jito MEV Bundler Tip</p>
                <p className="text-[10px] text-purple-100/40">Locks instantly inside Jito bundles</p>
              </div>
              <input
                type="checkbox"
                checked={useJito}
                onChange={(e) => setUseJito(e.target.checked)}
                className="w-4 h-4 rounded border-white/5 accent-green-500 cursor-pointer"
              />
            </div>
            {useJito && (
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {[0.0002, 0.001, 0.005].map((val) => (
                  <button
                    key={val}
                    onClick={() => setJitoTip(val)}
                    className={`py-1 rounded border text-center font-medium ${
                      jitoTip === val
                        ? 'border-green-500 text-green-500 bg-green-500/10'
                        : 'border-white/5 hover:border-white/10 text-purple-100'
                    }`}
                  >
                    {val} SOL
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-dark-500 p-5 rounded-lg flex flex-col gap-4">
        {/* Input Box */}
        <div className="bg-dark-600/50 p-4 rounded border border-white/5">
          <div className="flex items-center justify-between text-xs text-purple-100/60 mb-2">
            <span>From (You pay)</span>
            {connected && (
              <span className="font-medium">
                Balance: {isBuy ? solBalance?.toFixed(4) ?? '0.00' : tokenBalance?.toFixed(2) ?? '0.00'} {isBuy ? 'SOL' : coinSymbol.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <input
              type="text"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="bg-transparent text-xl font-bold text-white border-none outline-none w-full placeholder:text-purple-100/20"
              disabled={loading}
            />
            <div className="flex items-center gap-1.5 bg-dark-500 px-3 py-1.5 rounded-lg border border-white/5 shrink-0">
              {isBuy ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">S</div>
                  <span className="text-sm font-semibold text-white">SOL</span>
                </>
              ) : (
                <>
                  <img src={coinImage} alt={coinName} className="w-5 h-5 rounded-full object-cover" />
                  <span className="text-sm font-semibold text-white">{coinSymbol.toUpperCase()}</span>
                </>
              )}
            </div>
          </div>
          {connected && (
            <div className="flex gap-1.5 mt-3 justify-end">
              {[0.25, 0.5, 0.75, 1.0].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePercentClick(p)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded border border-white/5 text-purple-100/50 hover:text-white hover:border-white/10"
                  disabled={loading}
                >
                  {p === 1.0 ? 'MAX' : `${p * 100}%`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Switch Arrow */}
        <div className="flex justify-center -my-2.5 z-10">
          <button
            onClick={() => {
              setIsBuy(!isBuy);
              setInputAmount('');
              setOutputAmount('');
              setQuoteResponse(null);
            }}
            className="w-8 h-8 rounded-full bg-dark-500 border border-white/5 flex items-center justify-center hover:border-green-500/30 text-purple-100/60 hover:text-white transition-colors"
            disabled={loading}
          >
            <ArrowUpDown size={14} />
          </button>
        </div>

        {/* Output Box */}
        <div className="bg-dark-600/50 p-4 rounded border border-white/5">
          <div className="flex items-center justify-between text-xs text-purple-100/60 mb-2">
            <span>To (Estimated received)</span>
            {connected && (
              <span className="font-medium">
                Balance: {isBuy ? tokenBalance?.toFixed(2) ?? '0.00' : solBalance?.toFixed(4) ?? '0.00'} {isBuy ? coinSymbol.toUpperCase() : 'SOL'}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <input
              type="text"
              placeholder="0.00"
              value={outputAmount}
              readOnly
              className="bg-transparent text-xl font-bold text-white border-none outline-none w-full placeholder:text-purple-100/20 cursor-default"
            />
            <div className="flex items-center gap-1.5 bg-dark-500 px-3 py-1.5 rounded-lg border border-white/5 shrink-0">
              {!isBuy ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">S</div>
                  <span className="text-sm font-semibold text-white">SOL</span>
                </>
              ) : (
                <>
                  <img src={coinImage} alt={coinName} className="w-5 h-5 rounded-full object-cover" />
                  <span className="text-sm font-semibold text-white">{coinSymbol.toUpperCase()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quotes Stats Info */}
        {quoteResponse && (
          <div className="bg-dark-600/30 border border-white/5 rounded p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-purple-100/50">
              <span>Exchange Rate</span>
              <span className="font-mono text-white">
                1 {isBuy ? 'SOL' : coinSymbol.toUpperCase()} = {
                  (Number(quoteResponse.outAmount) / Math.pow(10, outputDecimals) / (Number(inputAmount) || 1)).toLocaleString(undefined, { maximumFractionDigits: 6 })
                } {isBuy ? coinSymbol.toUpperCase() : 'SOL'}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-purple-100/50 border-t border-white/5 pt-2">
              <span>Price Impact</span>
              <span className={`font-semibold ${
                Number(quoteResponse.priceImpactPct) > 5 ? 'text-red-500' :
                Number(quoteResponse.priceImpactPct) > 1 ? 'text-amber-500' : 'text-green-500'
              }`}>
                {Number(quoteResponse.priceImpactPct) < 0.01 ? '< 0.01%' : `${(Number(quoteResponse.priceImpactPct) * 100).toFixed(2)}%`}
              </span>
            </div>

            <div className="flex justify-between items-center text-purple-100/50 border-t border-white/5 pt-2">
              <span>Minimum Received</span>
              <span className="font-mono text-white">
                {(Number(quoteResponse.otherAmountThreshold) / Math.pow(10, outputDecimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {isBuy ? coinSymbol.toUpperCase() : 'SOL'}
              </span>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!connected ? (
          <button
            onClick={() => setVisible(true)}
            className="w-full bg-white hover:bg-neutral-200 text-black font-semibold py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            Connect Wallet
          </button>
        ) : isInsufficientBalance ? (
          <button
            disabled
            className="w-full bg-dark-600 border border-white/5 text-purple-100/30 font-semibold py-3.5 px-4 rounded-lg cursor-not-allowed"
          >
            Insufficient Balance
          </button>
        ) : txState === 'quoting' ? (
          <button
            disabled
            className="w-full bg-dark-600 border border-white/5 text-purple-100/50 font-semibold py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <RefreshCw className="animate-spin text-green-500" size={16} />
            Fetching dynamic routes...
          </button>
        ) : (
          <button
            onClick={handleSwap}
            disabled={!quoteResponse || loading}
            className={`w-full font-semibold py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
              !quoteResponse 
                ? 'bg-dark-600 text-purple-100/30 cursor-not-allowed border border-white/5' 
                : 'bg-green-500 hover:bg-green-600 text-dark-900 cursor-pointer shadow-lg shadow-green-500/10'
            }`}
          >
            {txState === 'confirming' && (
              <>
                <RefreshCw className="animate-spin text-dark-900" size={16} />
                Approve inside wallet...
              </>
            )}
            {txState === 'submitting' && (
              <>
                <RefreshCw className="animate-spin text-dark-900" size={16} />
                Executing transaction bundle...
              </>
            )}
            {txState === 'idle' && `Swap Assets`}
          </button>
        )}

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3.5 rounded flex gap-2.5 text-xs items-start">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {txState === 'success' && txSignature && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded flex flex-col gap-2.5 text-xs">
            <div className="flex gap-2 items-center">
              <CheckCircle2 size={18} className="text-green-500" />
              <span className="font-bold text-white">Swap Executed Successfully!</span>
            </div>
            <p className="text-purple-100/60 leading-relaxed">
              Your transaction bundle was validated by Jito validators and has confirmed on Solana mainnet.
            </p>
            <div className="mt-1 flex justify-end">
              <Link
                href={`https://orbmarkets.io/tx/${txSignature}`}
                target="_blank"
                className="text-green-500 hover:underline font-semibold flex items-center gap-1"
              >
                View on Orb Explorer
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SwapPanel;
