import { fireEvent, screen } from '@testing-library/react-native';
import { type ReactNode } from 'react';

import { AlertsScreen } from '../../../src/features/alerts/alerts-screen';
import { useAlertsScreen } from '../../../src/features/alerts/use-alerts-screen';
import { useCreateAlertForm } from '../../../src/features/alerts/use-create-alert';
import { renderScreen } from '../../render';

jest.mock('../../../src/features/alerts/use-alerts-screen');
jest.mock('../../../src/features/alerts/use-create-alert');
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({
    children,
    renderRightActions,
  }: {
    children: ReactNode;
    renderRightActions: () => ReactNode;
  }) => (
    <>
      {children}
      {renderRightActions()}
    </>
  ),
}));

const mockedScreen = jest.mocked(useAlertsScreen);
const mockedForm = jest.mocked(useCreateAlertForm);
type ScreenVm = ReturnType<typeof useAlertsScreen>;
type FormVm = ReturnType<typeof useCreateAlertForm>;

function screenVm(overrides: Partial<ScreenVm> = {}): ScreenVm {
  return {
    count: '2/50',
    rows: [
      {
        id: 'a1',
        symbol: 'AAPL',
        sector: 'tech',
        condition: 'price_above',
        enabled: true,
        rule: 'Price above $235.00',
        detail: 'Now $231.48 · 1.52% away',
        repeat: 'Once',
        state: 'active',
      },
      {
        id: 'a2',
        symbol: 'NVDA',
        sector: 'tech',
        condition: 'move_today',
        enabled: false,
        rule: 'Day change ≥ +5.00%',
        detail: '+3.41% today',
        repeat: 'Recurring',
        state: 'paused',
      },
    ],
    creating: null,
    isLoading: false,
    isError: false,
    actions: {
      retry: jest.fn(),
      closeCreate: jest.fn(),
      newAlert: jest.fn(),
      toggle: jest.fn(),
      remove: jest.fn(),
    },
    ...overrides,
  };
}

function formVm(overrides: Partial<FormVm> = {}): FormVm {
  return {
    title: 'New alert · AAPL',
    now: 'Now $231.48 · +1.24% today',
    condition: 'price_above',
    conditions: [
      { value: 'price_above', label: 'Price above' },
      { value: 'price_below', label: 'Price below' },
      { value: 'move_today', label: '% move today' },
    ],
    fieldLabel: 'Target price',
    prefix: '$',
    signed: false,
    text: '235.00',
    hint: '1.52% above current price',
    error: undefined,
    repeat: 'once',
    repeats: [
      { value: 'once', label: 'Once' },
      { value: 'every', label: 'Every time', a11yLabel: 'Every time (15 min cooldown)' },
    ],
    canSubmit: true,
    submitting: false,
    actions: {
      setCondition: jest.fn(),
      setText: jest.fn(),
      setRepeat: jest.fn(),
      submit: jest.fn(),
    },
    ...overrides,
  };
}

describe('AlertsScreen', () => {
  it('lists alerts with their state, count and row actions', async () => {
    const model = screenVm();
    mockedScreen.mockReturnValue(model);
    await renderScreen(<AlertsScreen />);

    expect(screen.getByText('2/50')).toBeOnTheScreen();
    expect(screen.getByText('Price above $235.00')).toBeOnTheScreen();
    expect(screen.getByText('Now $231.48 · 1.52% away · Once')).toBeOnTheScreen();
    expect(screen.getByText('Paused')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Resume NVDA' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete AAPL' }));
    await fireEvent.press(screen.getByRole('button', { name: 'New alert' }));

    expect(model.actions.toggle).toHaveBeenCalledWith('a2', false);
    expect(model.actions.remove).toHaveBeenCalledWith('a1');
    expect(model.actions.newAlert).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state', async () => {
    mockedScreen.mockReturnValue(screenVm({ rows: [] }));
    await renderScreen(<AlertsScreen />);

    expect(screen.getByText('No alerts yet. Set one from any stock page.')).toBeOnTheScreen();
  });
});

describe('Create alert sheet', () => {
  it('shows the target with its distance hint and creates the alert', async () => {
    const form = formVm();
    mockedScreen.mockReturnValue(screenVm({ creating: 'AAPL' }));
    mockedForm.mockReturnValue(form);
    await renderScreen(<AlertsScreen symbol="AAPL" />);

    expect(screen.getByText('New alert · AAPL')).toBeOnTheScreen();
    expect(screen.getByText('1.52% above current price')).toBeOnTheScreen();
    expect(screen.getByText('Alerts arrive in-app only')).toBeOnTheScreen();
    expect(screen.queryByRole('switch')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Price below' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Every time (15 min cooldown)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create alert' }));

    expect(form.actions.setCondition).toHaveBeenCalledWith('price_below');
    expect(form.actions.setRepeat).toHaveBeenCalledWith('every');
    expect(form.actions.submit).toHaveBeenCalledTimes(1);
  });

  it('shows the direction validation copy instead of the hint', async () => {
    mockedScreen.mockReturnValue(screenVm({ creating: 'AAPL' }));
    mockedForm.mockReturnValue(
      formVm({
        error: '“Above” must be over the current price ($231.48) — did you mean “below”?',
      }),
    );
    await renderScreen(<AlertsScreen symbol="AAPL" />);

    expect(screen.getByText(/did you mean “below”\?/)).toBeOnTheScreen();
    expect(screen.queryByText('1.52% above current price')).not.toBeOnTheScreen();
  });
});
