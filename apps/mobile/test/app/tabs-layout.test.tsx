import { screen } from '@testing-library/react-native';
import { type ReactNode } from 'react';

import TabsLayout from '../../src/app/(tabs)/_layout';
import { renderScreen } from '../render';

import type { Text } from 'react-native';

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<{ Text: typeof Text }>('react-native');
  const Tabs = ({ children }: { children: ReactNode }) => children;
  Tabs.Screen = function TabScreen({
    name,
    options,
  }: {
    name: string;
    options: { title: string };
  }) {
    return <MockText testID={`tab-${name}`}>{options.title}</MockText>;
  };
  return { Tabs };
});

describe('TabsLayout', () => {
  it('has the five v2 tabs in order', async () => {
    await renderScreen(<TabsLayout />);

    const titles = ['index', 'markets', 'portfolio', 'watchlist', 'account'].map(
      (name) => screen.getByTestId(`tab-${name}`).props.children as string,
    );
    expect(titles).toEqual(['Home', 'Markets', 'Portfolio', 'Watchlist', 'Account']);
  });
});
