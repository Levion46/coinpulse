import React from 'react';
import { fetcher, getPools } from '@/lib/coingecko.actions';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import LiveDataWrapper from '@/components/LiveDataWrapper';
import Converter from '@/components/Converter';

const Page = async ({ params }: NextPageProps) => {
  const { id } = await params;

  try {
    const [coinData, coinOHLCData] = await Promise.all([
      fetcher<CoinDetailsData>(`/coins/${id}`, {
        dex_pair_format: 'contract_address',
      }),
      fetcher<OHLCData>(`/coins/${id}/ohlc`, {
        vs_currency: 'usd',
        days: 1,
        interval: 'hourly',
        precision: 'full',
      }),
    ]);

    const platform = coinData.asset_platform_id
      ? coinData.detail_platforms?.[coinData.asset_platform_id]
      : null;
    const network = platform?.geckoterminal_url.split('/')[3] || null;
    const contractAddress = platform?.contract_address || null;

    const pool = await getPools(id, network, contractAddress);

    const coinDetails = [
      {
        label: 'Market Cap',
        value: formatCurrency(coinData.market_data.market_cap.usd),
      },
      {
        label: 'Market Cap Rank',
        value: `# ${coinData.market_cap_rank}`,
      },
      {
        label: 'Total Volume',
        value: formatCurrency(coinData.market_data.total_volume.usd),
      },
      {
        label: 'Website',
        value: '-',
        link: coinData.links.homepage[0],
        linkText: 'Homepage',
      },
      {
        label: 'Explorer',
        value: '-',
        link: coinData.links.blockchain_site[0],
        linkText: 'Explorer',
      },
      {
        label: 'Community',
        value: '-',
        link: coinData.links.subreddit_url,
        linkText: 'Community',
      },
    ];

    return (
      <main id="coin-details-page">
        <section className="primary">
          <LiveDataWrapper coinId={id} poolId={pool.id} coin={coinData} coinOHLCData={coinOHLCData}>
            <h4>Exchange Listings</h4>
          </LiveDataWrapper>
        </section>

        <section className="secondary">
          <Converter
            symbol={coinData.symbol}
            icon={coinData.image.small}
            priceList={coinData.market_data.current_price}
          />

          <div className="details">
            <h4>Coin Details</h4>

            <ul className="details-grid">
              {coinDetails.map(({ label, value, link, linkText }, index) => (
                <li key={index}>
                  <p className={label}>{label}</p>

                  {link ? (
                    <div className="link">
                      <Link href={link} target="_blank">
                        {linkText || label}
                      </Link>
                      <ArrowUpRight size={16} />
                    </div>
                  ) : (
                    <p className="text-base font-medium">{value}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    console.error(`Error loading coin details page for id ${id}:`, error);
    return (
      <main id="coin-details-page" className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center p-8 max-w-md mx-auto bg-dark-400 rounded-lg border border-purple-100/5">
          <h4 className="text-xl font-semibold text-white mb-2">Details Unavailable</h4>
          <p className="text-sm text-purple-100/60 leading-relaxed">
            We are unable to load the details for "{id}". This may be due to rate-limiting, an unconfigured API key, or an invalid coin identifier.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-white text-black font-semibold text-sm px-4 py-2 hover:bg-neutral-200 transition-colors"
            >
              Go to Home Page
            </Link>
          </div>
        </div>
      </main>
    );
  }
};
export default Page;
