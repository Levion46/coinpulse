'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useState } from 'react';
import SearchModal from './SearchModal';
import WalletDrawer from './WalletDrawer';

const Header = () => {
  const pathname = usePathname();
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <header>
      <div className="main-container inner">
        <Link href="/">
          <Image src="/logo.svg" alt="CoinPulse logo" width={132} height={40} />
        </Link>

        <nav className="flex items-center">
          <Link
            href="/"
            className={cn('nav-link', {
              'is-active': pathname === '/',
              'is-home': true,
            })}
          >
            Home
          </Link>

          <SearchModal />

          <Link
            href="/coins"
            className={cn('nav-link', {
              'is-active': pathname === '/coins',
            })}
          >
            All Coins
          </Link>

          <Link
            href="/sniper"
            className={cn('nav-link', {
              'is-active': pathname === '/sniper',
            })}
          >
            Sniper
          </Link>

          {connected && publicKey ? (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="nav-link cursor-pointer font-semibold text-purple-100 hover:text-white"
            >
              {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
            </button>
          ) : (
            <button
              onClick={() => setVisible(true)}
              className="nav-link cursor-pointer font-semibold text-purple-100 hover:text-white"
            >
              Connect Wallet
            </button>
          )}
        </nav>
      </div>

      {connected && publicKey && (
        <WalletDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          publicKey={publicKey.toString()}
        />
      )}
    </header>
  );
};



export default Header;
