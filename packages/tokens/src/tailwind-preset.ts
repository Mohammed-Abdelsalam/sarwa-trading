import { colorNames, cssVarName, radiusPx, spacingPx } from './css';
import { fontFamily } from './scale';

const preset = {
  content: [] as string[],
  theme: {
    extend: {
      colors: Object.fromEntries(colorNames().map((name) => [name, `var(${cssVarName(name)})`])),
      spacing: spacingPx(),
      borderRadius: radiusPx(),
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
