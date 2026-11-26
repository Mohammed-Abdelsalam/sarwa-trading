/**
 * Tailwind v3 preset for the mobile app (NativeWind 4 runs on the Tailwind v3 engine).
 * Web/admin use Tailwind v4 and `@import "@sarwa/tokens/theme.css"` instead.
 * Same class names on every platform: `bg-surface`, `text-fg-2`, `text-pos`, `rounded-lg`…
 *
 *   // apps/mobile/tailwind.config.js
 *   presets: [require('nativewind/preset'), require('@sarwa/tokens/tailwind-preset').default]
 */
import { colorNames, cssVarName, spacingPx } from './css';
import { fontFamily, radius } from './scale';

const preset = {
  content: [] as string[],
  darkMode: 'class' as const,
  theme: {
    extend: {
      colors: Object.fromEntries(colorNames().map((name) => [name, `var(${cssVarName(name)})`])),
      spacing: spacingPx(),
      borderRadius: Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, `${v}px`])),
      fontFamily: {
        // React Native needs the exact loaded font name (expo-font), not a CSS stack.
        sans: ['Inter'],
        display: ['Manrope'],
        mono: ['JetBrainsMono'],
      },
    },
  },
};

/** Exposed for documentation/tests: the full web stacks the mobile names correspond to. */
export const webFontStacks = fontFamily;

export default preset;
