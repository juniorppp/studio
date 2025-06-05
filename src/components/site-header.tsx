
'use client';

import Link from 'next/link';
import { AppLogo } from '@/components/app-logo';
import { Button } from '@/components/ui/button';
import { Home, Settings } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { useLocalization } from '@/hooks/use-localization';

export function SiteHeader() {
  const { t } = useLocalization();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <AppLogo className="h-6 w-auto" />
          <span className="hidden font-bold sm:inline-block sr-only">
            {siteConfig.name}
          </span>
        </Link>
        <nav className="flex flex-1 items-center space-x-2">
          <Link href="/" passHref>
            <Button variant="ghost" className="text-sm font-medium">
              <Home className="mr-2 h-4 w-4" />
              {t('nav.home')}
            </Button>
          </Link>
          <Link href="/settings" passHref>
            <Button variant="ghost" className="text-sm font-medium">
              <Settings className="mr-2 h-4 w-4" />
              {t('nav.settings')}
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
