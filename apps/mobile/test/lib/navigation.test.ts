import { router } from 'expo-router';

import { goBack, parseSymbol, stockWebUrl } from '../../src/lib/navigation';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const canGoBack = jest.mocked(router.canGoBack);

describe('goBack', () => {
  it('pops the stack when there is somewhere to go back to', () => {
    canGoBack.mockReturnValue(true);
    goBack();

    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('lands on the tabs when a deep link opened the screen with no history', () => {
    canGoBack.mockReturnValue(false);
    goBack();

    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });
});

describe('parseSymbol', () => {
  it.each([
    ['aapl', 'AAPL'],
    ['BRK.B', 'BRK.B'],
  ])('accepts %s as %s', (param, symbol) => {
    expect(parseSymbol(param)).toBe(symbol);
  });

  it.each([undefined, '', ['AAPL', 'MSFT'], '1ABC', 'AAPL/../orders', 'TOOLONGSYMBOL'])(
    'rejects %j',
    (param) => {
      expect(parseSymbol(param)).toBeNull();
    },
  );
});

describe('stockWebUrl', () => {
  it('shares an https-capable web link instead of the app scheme', () => {
    expect(stockWebUrl('AAPL')).toBe('http://localhost:3000/stocks/AAPL');
  });
});
