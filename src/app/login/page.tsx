
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginUser } from '@/actions/auth';
import { useToast } from '@/hooks/use-toast';
import { AppLogo } from '@/components/app-logo';
import { useLocalization } from '@/hooks/use-localization';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useLocalization(); // Assuming LocalizationProvider is in RootLayout

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await loginUser(username, password);
    setIsLoading(false);

    if (result.success) {
      toast({ title: t('loginPage.toast.success.title'), description: result.message });
      const nextUrl = searchParams.get('next') || '/';
      router.push(nextUrl);
      router.refresh(); // Important to re-fetch server components with new session
    } else {
      setError(result.message || t('loginPage.toast.failure.defaultDescription'));
      toast({
        variant: 'destructive',
        title: t('loginPage.toast.failure.title'),
        description: result.message || t('loginPage.toast.failure.defaultDescription'),
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <AppLogo />
          </div>
          <CardTitle className="text-2xl font-bold">{t('loginPage.title')}</CardTitle>
          <CardDescription>{t('loginPage.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('loginPage.usernameLabel')}</Label>
              <Input
                id="username"
                type="text"
                placeholder={t('loginPage.usernamePlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('loginPage.passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('loginPage.loadingButton') : t('loginPage.submitButton')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-center text-sm">
          <p>
            {t('loginPage.noAccountPrompt')}{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              {t('loginPage.registerLink')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
