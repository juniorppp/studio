
import type { Metadata } from 'next';
import './globals.css';
import { siteConfig } from '@/config/site';
import { Toaster } from "@/components/ui/toaster";
import { SiteHeader } from '@/components/site-header';
import { LocalizationProvider } from '@/contexts/localization-context';
import ErrorBoundary from '@/components/error-boundary'; // Importar o ErrorBoundary

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.defaultDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The lang attribute will be updated by LocalizationProvider client-side
    // suppressHydrationWarning is important if the initial server render lang
    // might differ from the client-side one (e.g., due to localStorage)
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground flex flex-col">
        <ErrorBoundary>
          <LocalizationProvider>
            <SiteHeader />
            <main className="flex-1">
              {children}
            </main>
            <Toaster />
          </LocalizationProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
