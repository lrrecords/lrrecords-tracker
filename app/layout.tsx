import type { Metadata } from 'next';
import './globals.css';
import { APP_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: `${APP_NAME} by LRRecords`,
  description:
    'Do tasks for LRRecords and earn studio time (recording, mixing and mastering) or LRR Coin credit.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
