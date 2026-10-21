import type { Metadata, Viewport } from 'next';
import { getMessages, LOCALE } from '@/i18n';
import './globals.css';

const m = getMessages();

export const metadata: Metadata = {
  title: m.app.title,
  description: m.app.description,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#101316' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={LOCALE}>
      <body>{children}</body>
    </html>
  );
}
