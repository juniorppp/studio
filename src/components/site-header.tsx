
'use client';

import Link from 'next/link';
import { AppLogo } from '@/components/app-logo';
import { Button } from '@/components/ui/button';
import { Home, Settings, LogIn, UserPlus, LogOut } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { useLocalization } from '@/hooks/use-localization';
import { getUserSession, logoutUser } from '@/actions/auth';
import { useEffect, useState } from 'react';
import type { UserJWTPayload } from '@/types';
import { useRouter, usePathname } from 'next/navigation'; // Import usePathname

export function SiteHeader() {
  const { t } = useLocalization();
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname
  const [session, setSession] = useState<UserJWTPayload | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      setIsLoadingSession(true);
      console.log('[SiteHeader] Attempting to fetch session on path:', pathname);
      try {
        const currentSession = await getUserSession();
        console.log('[SiteHeader] Fetched session result:', currentSession);
        setSession(currentSession);
      } catch (error) {
        console.error("[SiteHeader] Failed to fetch session in useEffect:", error);
        setSession(null);
      } finally {
        setIsLoadingSession(false);
      }
    };
    fetchSession();
  }, [pathname]); // Add pathname to dependency array

  const handleLogout = async () => {
    console.log('[SiteHeader] Logging out...');
    await logoutUser(); // This action performs a server-side redirect
    setSession(null); // Optimistic client-side update
    // router.refresh(); // Removed, as redirect + pathname change in useEffect should handle re-fetch
    console.log('[SiteHeader] Logout action called, optimistic session set to null.');
  };

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
          {isLoadingSession && (
            <Button variant="ghost" size="sm" disabled className="text-xs">Loading nav...</Button>
          )}
          {!isLoadingSession && session && (
            <>
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
            </>
          )}
           {!isLoadingSession && !session && (
             <p className="text-xs text-muted-foreground hidden sm:block">Login to access features.</p>
           )}
        </nav>
        <div className="flex items-center space-x-2">
          {isLoadingSession ? (
            <Button variant="ghost" size="sm" disabled>...</Button>
          ) : session ? (
            <>
              <span className="text-sm text-muted-foreground">
                {t('nav.welcomeUser', { username: session.username })}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('nav.logout')}
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" passHref>
                <Button variant="ghost" size="sm">
                  <LogIn className="mr-2 h-4 w-4" />
                  {t('nav.login')}
                </Button>
              </Link>
              <Link href="/register" passHref>
                <Button variant="outline" size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t('nav.register')}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
