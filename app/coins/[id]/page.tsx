import React from 'react';
import { fetcher, getPools, getSolanaTokenDetails, getRugCheckReport } from '@/lib/coingecko.actions';
import Link from 'next/link';
import { ArrowUpRight, ShieldCheck, ShieldAlert, Shield, ShieldQuestion, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import LiveDataWrapper from '@/components/LiveDataWrapper';
import Converter from '@/components/Converter';

const renderFormattedText = (text: string) => {
  if (!text) return null;
  const solanaAddrRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  const parts = text.split(solanaAddrRegex);
  const matches = text.match(solanaAddrRegex);
  if (!matches) return <span>{text}</span>;

  return (
    <span>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {matches[i] && (
            <Link
              href={`https://orbmarkets.io/address/${matches[i]}`}
              target="_blank"
              className="text-green-500 hover:underline font-mono inline-flex items-center gap-0.5"
            >
              {matches[i].slice(0, 4)}...{matches[i].slice(-4)}
              <ArrowUpRight size={10} className="inline" />
            </Link>
          )}
        </React.Fragment>
      ))}
    </span>
  );
};

const getRiskBadgeStyles = (level: string) => {
  const lvl = level?.toLowerCase();
  if (lvl === 'danger' || lvl === 'high' || lvl === 'critical') {
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  } else if (lvl === 'warn' || lvl === 'warning' || lvl === 'medium') {
    return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  } else {
    return 'text-green-500 bg-green-500/10 border-green-500/20';
  }
};

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

    let solanaDetails: any = null;
    let rugCheckReport: any = null;

    if (coinData.asset_platform_id === 'solana' && contractAddress) {
      try {
        const [details, report] = await Promise.all([
          getSolanaTokenDetails(contractAddress),
          getRugCheckReport(contractAddress),
        ]);
        solanaDetails = details;
        rugCheckReport = report;
      } catch (err) {
        console.error('Error fetching Solana token details or RugCheck report:', err);
      }
    }

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

    if (solanaDetails) {
      coinDetails.push(
        {
          label: 'Metadata Status',
          value: solanaDetails.isMutable ? 'Mutable' : 'Immutable',
        },
        {
          label: 'Mint Authority',
          value: solanaDetails.mintAuthority ? '-' : 'Disabled',
          link: solanaDetails.mintAuthority ? `https://orbmarkets.io/address/${solanaDetails.mintAuthority}` : undefined,
          linkText: solanaDetails.mintAuthority ? `${solanaDetails.mintAuthority.slice(0, 4)}...${solanaDetails.mintAuthority.slice(-4)}` : undefined,
        },
        {
          label: 'Freeze Authority',
          value: solanaDetails.freezeAuthority ? '-' : 'Disabled',
          link: solanaDetails.freezeAuthority ? `https://orbmarkets.io/address/${solanaDetails.freezeAuthority}` : undefined,
          linkText: solanaDetails.freezeAuthority ? `${solanaDetails.freezeAuthority.slice(0, 4)}...${solanaDetails.freezeAuthority.slice(-4)}` : undefined,
        }
      );
    }

    let ratingColor = 'text-green-500 bg-green-500/10 border-green-500/20';
    let ratingLabel = 'Good';
    let RatingIcon = ShieldCheck;
    let scoreText = '0';
    let riskDescription = 'This asset has a low risk profile with no high-severity flags.';

    if (rugCheckReport) {
      if (rugCheckReport.score === -1) {
        ratingColor = 'text-purple-100/60 bg-purple-100/5 border-purple-100/10';
        ratingLabel = 'Unavailable';
        RatingIcon = ShieldQuestion;
        scoreText = 'N/A';
        riskDescription = rugCheckReport.warning || 'RugCheck report is currently unavailable.';
      } else {
        scoreText = rugCheckReport.score.toLocaleString();
        if (rugCheckReport.score > 2000) {
          ratingColor = 'text-red-500 bg-red-500/10 border-red-500/20';
          ratingLabel = 'Danger';
          RatingIcon = ShieldAlert;
          riskDescription = 'High vulnerability risks detected. Review individual risk flags carefully.';
        } else if (rugCheckReport.score >= 1000) {
          ratingColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
          ratingLabel = 'Warning';
          RatingIcon = AlertTriangle;
          riskDescription = 'Moderate risk profile. Verify holding distributions and mint authorities.';
        } else {
          ratingColor = 'text-green-500 bg-green-500/10 border-green-500/20';
          ratingLabel = 'Good';
          RatingIcon = ShieldCheck;
          riskDescription = 'Clean security profile. No high-severity vulnerabilities found.';
        }
      }
    }

    return (
      <main id="coin-details-page">
        <section className="primary">
          <LiveDataWrapper
            coinId={id}
            poolId={pool.id}
            coin={coinData}
            coinOHLCData={coinOHLCData}
            contractAddress={contractAddress}
            decimals={solanaDetails?.decimals || 9}
          >
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
                    <p className={`text-base font-medium ${
                      value === 'Immutable' ? 'text-green-500 font-semibold' :
                      value === 'Mutable' ? 'text-red-500 font-semibold' : ''
                    }`}>{value}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {coinData.asset_platform_id === 'solana' && rugCheckReport && (
            <div className="details mt-8">
              <h4 className="border-b border-white/5 flex items-center gap-2">
                <RatingIcon className={rugCheckReport.score > 2000 ? 'text-red-500' : rugCheckReport.score >= 1000 ? 'text-amber-500' : rugCheckReport.score === -1 ? 'text-purple-100/60' : 'text-green-500'} size={24} />
                RugCheck Security Report
              </h4>

              <div className="bg-dark-500 p-5 rounded-lg flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <p className="text-sm text-purple-100/60 mb-1">Safety Score</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-white">{scoreText}</span>
                      {rugCheckReport.score !== -1 && (
                        <span className="text-xs text-purple-100/40">/ 5000+</span>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${ratingColor}`}>
                    {ratingLabel}
                  </span>
                </div>

                <p className="text-sm text-purple-100/80 leading-relaxed">
                  {riskDescription}
                </p>

                {rugCheckReport.score !== -1 && rugCheckReport.risks && rugCheckReport.risks.length > 0 ? (
                  <div className="space-y-3 mt-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-100/40">Flagged Risk Indicators</p>
                    <div className="max-h-60 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-white/5">
                      {rugCheckReport.risks.map((risk: any, idx: number) => (
                        <div key={idx} className="bg-dark-600/50 p-3.5 rounded border border-white/5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{risk.name}</span>
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-medium capitalize ${getRiskBadgeStyles(risk.level)}`}>
                              {risk.level || 'low'}
                            </span>
                          </div>
                          {risk.description && (
                            <p className="text-xs text-purple-100/60 leading-relaxed">
                              {renderFormattedText(risk.description)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : rugCheckReport.score === -1 ? null : (
                  <div className="bg-dark-600/30 border border-white/5 rounded p-4 text-center mt-2">
                    <p className="text-xs text-purple-100/50">
                      All verified security metrics show an immaculate status.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
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
