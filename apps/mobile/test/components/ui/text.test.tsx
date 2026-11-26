import { render, screen } from '@testing-library/react-native';

import { hasTextColor, Text } from '../../../src/components/ui/text';

describe('hasTextColor', () => {
  it('detects design-system text colours, including dark: variants', () => {
    expect(hasTextColor('text-bg')).toBe(true);
    expect(hasTextColor('mt-2 dark:text-fg-2')).toBe(true);
    expect(hasTextColor('text-white')).toBe(true);
  });

  it('ignores alignment and size utilities that also start with text-', () => {
    expect(hasTextColor('text-center text-[15px]')).toBe(false);
    expect(hasTextColor(undefined)).toBe(false);
  });
});

describe('Text', () => {
  it('uses the given colour instead of stacking it on the default (active chip label)', async () => {
    await render(<Text className="text-bg">All</Text>);
    const className = (screen.getByText('All').props as { className?: string }).className ?? '';
    expect(className).not.toContain('text-fg');
  });
});
