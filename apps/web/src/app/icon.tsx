import { ImageResponse } from 'next/og';

import { themes } from '@sarwa/tokens';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// The logo mark (W-Global) drawn from the brand token, so the tab icon follows the palette.
export default function Icon() {
  const { brand, 'on-brand': onBrand } = themes.dark;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: brand,
        borderRadius: 8,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={onBrand}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
        <path d="M16 7h6v6" />
      </svg>
    </div>,
    size,
  );
}
