import Image from 'next/image';

// LRR circle text logo (navy circle, orange LRR monogram).
// Source: /public/logo.png — 512px with a transparent background outside the circle.
export function CircleLogo({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="LRRecords logo"
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      priority
    />
  );
}
