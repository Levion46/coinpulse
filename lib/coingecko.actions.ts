'use server';

import qs from 'query-string';

const BASE_URL = process.env.COINGECKO_BASE_URL;
const API_KEY = process.env.COINGECKO_API_KEY;

export async function fetcher<T>(
  endpoint: string,
  params?: QueryParams,
  revalidate = 60,
): Promise<T> {
  if (!BASE_URL) {
    throw new Error('COINGECKO_BASE_URL is not configured.');
  }

  const url = qs.stringifyUrl(
    {
      url: `${BASE_URL}/${endpoint}`,
      query: params,
    },
    { skipEmptyString: true, skipNull: true },
  );

  const response = await fetch(url, {
    headers: {
      'x-cg-pro-api-key': API_KEY,
      'Content-Type': 'application/json',
    } as Record<string, string>,
    next: { revalidate },
  });

  if (!response.ok) {
    const errorBody: CoinGeckoErrorBody = await response.json().catch(() => ({}));

    throw new Error(`API Error: ${response.status}: ${errorBody.error || response.statusText} `);
  }

  return response.json();
}

export async function getPools(
  id: string,
  network?: string | null,
  contractAddress?: string | null,
): Promise<PoolData> {
  const fallback: PoolData = {
    id: '',
    address: '',
    name: '',
    network: '',
  };

  if (network && contractAddress) {
    try {
      const poolData = await fetcher<{ data: PoolData[] }>(
        `/onchain/networks/${network}/tokens/${contractAddress}/pools`,
      );

      return poolData.data?.[0] ?? fallback;
    } catch (error) {
      console.log(error);
      return fallback;
    }
  }

  try {
    const poolData = await fetcher<{ data: PoolData[] }>('/onchain/search/pools', { query: id });

    return poolData.data?.[0] ?? fallback;
  } catch {
    return fallback;
  }
}

export async function searchCoins(query: string): Promise<{ coins: SearchCoin[] }> {
  if (!query) return { coins: [] };

  try {
    const response = await fetcher<{ coins: any[] }>('/search', { query });
    const coins = (response.coins || []).map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      market_cap_rank: coin.market_cap_rank || null,
      thumb: coin.thumb || coin.large || '',
      large: coin.large || coin.thumb || '',
      data: {
        price: coin.data?.price,
        price_change_percentage_24h: coin.data?.price_change_percentage_24h?.usd || 0,
      },
    }));
    return { coins };
  } catch (error) {
    console.error('Error searching coins:', error);
    return { coins: [] };
  }
}

export async function getSolBalance(publicKey: string): Promise<number> {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) {
    console.error('HELIUS_RPC_URL is not set.');
    return 0;
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-balance',
        method: 'getBalance',
        params: [publicKey],
      }),
    });

    const result = await response.json();
    const lamports = result.result?.value || 0;
    return lamports / 1000000000;
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    return 0;
  }
}

export async function getWalletPortfolio(publicKey: string): Promise<any[]> {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) {
    console.error('HELIUS_RPC_URL is not set.');
    return [];
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-assets',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: publicKey,
          page: 1,
          limit: 100,
          displayOptions: {
            showFungible: true,
          },
        },
      }),
    });

    const result = await response.json();
    const items = result.result?.items || [];
    
    return items
      .filter((item: any) => item.interface === 'FungibleToken' || item.interface === 'FungibleAsset')
      .map((item: any) => {
        const symbol = item.content?.metadata?.symbol || 'UNKNOWN';
        const name = item.content?.metadata?.name || 'Unknown Token';
        const image = item.content?.links?.image || item.content?.files?.[0]?.uri || '';
        const decimals = item.token_info?.decimals || 0;
        const balanceLamports = item.token_info?.balance || 0;
        const balance = balanceLamports / Math.pow(10, decimals);
        const price = item.token_info?.price_info?.price_per_token || 0;
        const valueUsd = balance * price;

        return {
          mint: item.id,
          symbol,
          name,
          image,
          decimals,
          balance,
          price,
          valueUsd,
        };
      })
      .filter((token: any) => token.balance > 0);
  } catch (error) {
    console.error('Error fetching wallet portfolio:', error);
    return [];
  }
}


