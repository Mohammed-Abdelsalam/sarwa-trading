import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ErrorFallback, NotFoundScreen } from '../../../src/components/layout/route-fallbacks';
import { savedLocale } from '../../../src/providers/app-providers';
import { renderScreen } from '../../render';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../../../src/providers/app-providers', () => ({ savedLocale: jest.fn(() => 'en') }));

describe('ErrorFallback', () => {
  it('retries the crashed route when the user taps Try again', async () => {
    const retry = jest.fn(() => Promise.resolve());
    await render(<ErrorFallback error={new Error('boom')} retry={retry} />);

    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('speaks the language the user picked', async () => {
    jest.mocked(savedLocale).mockReturnValue('ar');
    await render(<ErrorFallback error={new Error('boom')} retry={jest.fn()} />);

    expect(screen.getByText('حدث خطأ ما')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'حاول مجددًا' })).toBeOnTheScreen();
  });
});

describe('NotFoundScreen', () => {
  it('sends an unknown link back to markets', async () => {
    await renderScreen(<NotFoundScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back to Markets' }));
    expect(router.replace).toHaveBeenCalledWith('/markets');
  });

  it('follows the Arabic locale', async () => {
    await renderScreen(<NotFoundScreen />, { locale: 'ar' });

    expect(screen.getByRole('button', { name: 'العودة إلى الأسواق' })).toBeOnTheScreen();
    expect(screen.queryByText('Page not found')).not.toBeOnTheScreen();
  });
});
