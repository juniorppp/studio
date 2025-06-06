
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerUser } from '@/actions/auth';
import { useToast } from '@/hooks/use-toast';
import { AppLogo } from '@/components/app-logo';
import { useLocalization } from '@/hooks/use-localization';


export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLocalization();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(t('registerPage.error.passwordMismatch'));
      toast({ variant: 'destructive', title: t('generic.error'), description: t('registerPage.error.passwordMismatch')});
      return;
    }
    setIsLoading(true);
    setError(null);

    const result = await registerUser(name, username, password);
    setIsLoading(false);

    if (result.success) {
      toast({ title: t('registerPage.toast.success.title'), description: result.message });
      router.push('/login');
    } else {
      setError(result.message || t('registerPage.toast.failure.defaultDescription'));
      toast({
        variant: 'destructive',
        title: t('registerPage.toast.failure.title'),
        description: result.message || t('registerPage.toast.failure.defaultDescription'),
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
          <CardTitle className="text-2xl font-bold">{t('registerPage.title')}</CardTitle>
          <CardDescription>{t('registerPage.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('registerPage.nameLabel')}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t('registerPage.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">{t('registerPage.usernameLabel')}</Label>
              <Input
                id="username"
                type="text"
                placeholder={t('registerPage.usernamePlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('registerPage.passwordLabel')}</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('registerPage.confirmPasswordLabel')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('registerPage.loadingButton') : t('registerPage.submitButton')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-center text-sm">
          <p>
            {t('registerPage.alreadyAccountPrompt')}{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t('registerPage.loginLink')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
