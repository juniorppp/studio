
import type { Metadata } from 'next';
import './globals.css';
import { siteConfig } from '@/config/site';
import { Toaster } from "@/components/ui/toaster";
import { SiteHeader } from '@/components/site-header';
import { LocalizationProvider } from '@/contexts/localization-context'; // Added import

export const metadata: Metadata = {
  title: {
    default: siteConfig.name, // siteConfig.name is not localized for metadata
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.defaultDescription, // Use a non-localized default for metadata
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LocalizationProvider>
      <HtmlWrapper>
        <body className="font-body antialiased min-h-screen bg-background text-foreground flex flex-col">
          <SiteHeader />
          <main className="flex-1">
            {children}
          </main>
          <Toaster />
        </body>
      </HtmlWrapper>
    </LocalizationProvider>
  );
}

// Client component to set html lang attribute dynamically
function HtmlWrapper({ children }: { children: React.ReactNode }) {
  // This component can be client-side to access localStorage for initial language if needed,
  // but LocalizationProvider already handles setting document.documentElement.lang.
  // For SSR, lang would ideally come from path or headers. Here, it defaults and updates client-side.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      {children}
    </html>
  );
}
