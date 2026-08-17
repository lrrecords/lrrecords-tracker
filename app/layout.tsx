import type { Metadata } from 'next';
import './globals.css';
import { APP_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    'Weekly task tracker and studio time log for LRRecords work-experience partnership.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
