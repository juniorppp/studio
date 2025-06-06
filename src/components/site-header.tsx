
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
import { useRouter } from 'next/navigation';

export function SiteHeader() {
  const { t } = useLocalization();
  const router = useRouter();
  const [session, setSession] = useState<UserJWTPayload | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      setIsLoadingSession(true);
      try {
        const currentSession = await getUserSession();
        setSession(currentSession);
      } catch (error) {
        console.error("Failed to fetch session:", error);
        setSession(null);
      } finally {
        setIsLoadingSession(false);
      }
    };
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setSession(null); // Update client-side state
    // router.push('/login'); // logoutUser action already redirects
    router.refresh(); // Ensure page reloads with new auth state
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
          {session && (
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
        </nav>
        <div className="flex items-center space-x-2">
          {isLoadingSession ? (
            <Button variant="ghost" size="sm" disabled>...</Button>
          ) : session ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
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
