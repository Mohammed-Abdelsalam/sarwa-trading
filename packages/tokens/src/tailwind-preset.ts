import { colorNames, cssVarName, spacingPx } from './css';
import { fontFamily, radius } from './scale';

const preset = {
  content: [] as string[],
  theme: {
    extend: {
      colors: Object.fromEntries(colorNames().map((name) => [name, `var(${cssVarName(name)})`])),
      spacing: spacingPx(),
      borderRadius: Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, `${v}px`])),
      fontFamily: {
        sans: ['Inter'],
        display: ['Manrope'],
        mono: ['JetBrainsMono'],
      },
    },
  },
};

export const webFontStacks = fontFamily;

export default preset;
