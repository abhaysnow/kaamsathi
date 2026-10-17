import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Devanagari, Noto_Sans_Gurmukhi } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppProvider } from '@/hooks/useApp';
import { AuthProvider } from '@/hooks/useAuth';
import Shell from '@/components/Shell';
import './globals.css';

// Self-hosted by next/font: the browser never contacts Google. The Noto faces only download when a
// page actually contains Devanagari or Gurmukhi characters (unicode-range), so they are not preloaded.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const notoDeva = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '600', '700'],
  variable: '--font-noto-deva',
  display: 'swap',
  preload: false,
});
const notoGuru = Noto_Sans_Gurmukhi({
  subsets: ['gurmukhi'],
  weight: ['400', '600', '700'],
  variable: '--font-noto-guru',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'KaamSaathi AI — Your Work. Your Rights. Your Saathi.',
  description:
    'A multilingual AI companion for gig and informal workers in India. Demo project; not affiliated with any government body.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#176B50' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoDeva.variable} ${notoGuru.variable}`}>
      <body>
        <AuthProvider>
          <AppProvider>
            <Shell>{children}</Shell>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
