import { ImageResponse } from 'next/og';

import { themes } from '@sarwa/tokens';

export const OG_SIZE = { width: 1200, height: 630 };

// One social card layout for the site and every stock, drawn from the dark theme tokens.
export function ogCard({ title, subtitle }: { title: string; subtitle: string }) {
  const c = themes.dark;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: c.bg,
        color: c.fg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: c.brand,
            borderRadius: 16,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke={c['on-brand']}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
            <path d="M16 7h6v6" />
          </svg>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>{title}</span>
        <span style={{ fontSize: 34, lineHeight: 1.3, color: c['fg-2'] }}>{subtitle}</span>
      </div>
    </div>,
    OG_SIZE,
  );
}
