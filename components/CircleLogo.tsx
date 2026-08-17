// Placeholder circular "LRRECORDS" badge logo, drawn in brand navy + orange.
// Swap this out for your real logo whenever you're ready:
//   1. Drop your logo file at /public/logo.svg (or .png)
//   2. Replace the <svg>...</svg> below with:
//        <img src="/logo.svg" alt="LRRecords" width={size} height={size} className={className} />
export function CircleLogo({ size = 44, className = '' }: { size?: number; className?: string }) {
  const id = 'lrrecords-circle-path';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="LRRecords logo"
    >
      <circle cx="50" cy="50" r="48" fill="#0B1E3D" stroke="#F5820D" strokeWidth="2" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#F5820D" strokeWidth="1.25" opacity="0.5" />
      <circle cx="50" cy="50" r="8" fill="#F5820D" />
      <defs>
        <path id={id} d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
      </defs>
      <text fill="#FFFFFF" fontSize="10.5" fontWeight="700" letterSpacing="3">
        <textPath href={`#${id}`} startOffset="2%">
          LRRECORDS &#8226; LRRECORDS &#8226;
        </textPath>
      </text>
    </svg>
  );
}
