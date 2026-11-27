import { fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';

import { OrderTicketScreen } from '../../../src/features/order-ticket/order-ticket-screen';
import { useOrderTicketScreen } from '../../../src/features/order-ticket/use-order-ticket-screen';
import { renderScreen } from '../../render';
import { ticketVm } from './fixtures';

jest.mock('../../../src/features/order-ticket/use-order-ticket-screen');
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  usePanGesture: () => ({}),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }));

const mockedHook = jest.mocked(useOrderTicketScreen);

async function mountTicket(vm = ticketVm()) {
  mockedHook.mockReturnValue(vm);
  await renderScreen(<OrderTicketScreen symbol="AAPL" side="buy" />);
  return vm;
}

describe('OrderTicketScreen · entry', () => {
  it('shows the side, quote line, amount and live estimate', async () => {
    await mountTicket();

    expect(screen.getByRole('header', { name: 'Buy AAPL' })).toBeOnTheScreen();
    expect(screen.getByText('Live')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Sell · 42 sh' })).toBeOnTheScreen();
    expect(screen.getByText('Bid $231.46 × 300')).toBeOnTheScreen();
    expect(screen.getByText('Spread 0.02%')).toBeOnTheScreen();
    expect(screen.getByText('≈ 2.159827 shares at ask $231.50')).toBeOnTheScreen();
    expect(screen.getByLabelText('Est. fees: $0.00')).toBeOnTheScreen();
  });

  it('types on the keypad with labelled decimal and delete keys', async () => {
    const vm = await mountTicket();

    await fireEvent.press(screen.getByRole('keyboardkey', { name: '5' }));
    await fireEvent.press(screen.getByRole('keyboardkey', { name: 'Decimal point' }));
    await fireEvent.press(screen.getByRole('keyboardkey', { name: 'Delete' }));

    expect(vm.actions.key).toHaveBeenNthCalledWith(1, '5');
    expect(vm.actions.key).toHaveBeenNthCalledWith(2, '.');
    expect(vm.actions.key).toHaveBeenNthCalledWith(3, 'backspace');
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('applies quick amounts including Max', async () => {
    const vm = await mountTicket();

    expect(screen.getByRole('radio', { name: '$500' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Max' }));

    expect(vm.actions.chooseQuickAmount).toHaveBeenCalledWith({ key: 'max', cents: 4_000_000 });
  });

  it('switches side, order type and size mode', async () => {
    const vm = await mountTicket();

    await fireEvent.press(screen.getByRole('radio', { name: 'Sell · 42 sh' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Limit' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Shares' }));

    expect(vm.actions.setSide).toHaveBeenCalledWith('sell');
    expect(vm.actions.setType).toHaveBeenCalledWith('limit');
    expect(vm.actions.setSizeMode).toHaveBeenCalledWith('shares');
  });

  it('opens the review from the button', async () => {
    const vm = await mountTicket();

    await fireEvent.press(screen.getByRole('button', { name: 'Review order' }));

    expect(vm.actions.review).toHaveBeenCalledTimes(1);
  });

  it('blocks with the reason on the button, the gate callouts and inline field errors', async () => {
    const vm = await mountTicket(
      ticketVm({
        header: { title: 'Sell TSLA' },
        entry: {
          side: 'sell',
          type: 'limit',
          showTif: true,
          price: {
            label: 'Limit price',
            value: '285.00',
            focused: false,
            error: 'Price too far from market (collar: $223.52 – $273.19).',
            hint: undefined,
          },
          sizeError: 'You can sell up to 25 sh.',
          gates: [
            {
              key: 'SYMBOL_HALTED',
              tone: 'neg',
              icon: 'pause',
              title: 'Trading paused — TSLA halted',
              body: 'TSLA is halted.',
            },
          ],
          button: {
            label: 'Trading paused — TSLA halted',
            blocked: true,
            queued: false,
            disabled: true,
          },
        },
      }),
    );

    const button = screen.getByRole('button', { name: 'Trading paused — TSLA halted' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(vm.actions.review).not.toHaveBeenCalled();
    expect(screen.getByText(/TSLA is halted./)).toBeOnTheScreen();
    expect(
      screen.getByText('Price too far from market (collar: $223.52 – $273.19).'),
    ).toBeOnTheScreen();
    expect(screen.getByText('You can sell up to 25 sh.')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'GTC' })).toBeOnTheScreen();
  });

  it('explains a closed market and queues the order for the open', async () => {
    await mountTicket(
      ticketVm({
        header: { pill: { state: 'closed', label: 'Closed · opens Mon', short: 'Closed' } },
        entry: {
          gates: [
            {
              key: 'closed',
              tone: 'warn',
              icon: 'clock',
              title: 'Market is closed.',
              body: 'A market order will be queued and placed at the open.',
            },
          ],
          rows: [{ key: 'reserved', label: 'Reserved incl. 5.00% buffer', value: '$1,500.14' }],
          bufferNote: 'We reserve a 5.00% buffer for market orders queued while closed.',
          button: { label: 'Queue order for open', blocked: false, queued: true, disabled: false },
        },
      }),
    );

    expect(screen.getByText('Closed')).toBeOnTheScreen();
    expect(screen.getByText(/Market is closed./)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Queue order for open' })).toBeOnTheScreen();
    expect(
      screen.getByText('We reserve a 5.00% buffer for market orders queued while closed.'),
    ).toBeOnTheScreen();
  });
});

describe('OrderTicketScreen · review', () => {
  it('shows the summary and the quote countdown', async () => {
    await mountTicket(ticketVm({ step: 'review' }));

    expect(screen.getByText('Buy $500.00 of AAPL')).toBeOnTheScreen();
    expect(screen.getByText('Quote valid for 7 s')).toBeOnTheScreen();
    expect(screen.getByLabelText('Est. total: $500.00')).toBeOnTheScreen();
    expect(
      screen.getByText('Screen reader: double-tap the “Buy AAPL” button instead'),
    ).toBeOnTheScreen();
  });

  it('confirms from the slider for screen readers via its activate action', async () => {
    const vm = await mountTicket(ticketVm({ step: 'review' }));

    await fireEvent(screen.getByRole('button', { name: 'Buy AAPL' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(vm.actions.submit).toHaveBeenCalledTimes(1);
  });

  it('uses a plain button when reduced motion or a screen reader is on', async () => {
    const vm = ticketVm({ step: 'review' });
    vm.review.confirm.plain = true;
    await mountTicket(vm);

    expect(screen.queryByText('Slide to buy')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Buy AAPL' }));

    expect(vm.actions.submit).toHaveBeenCalledTimes(1);
  });

  it('asks for an extra confirmation on a large order', async () => {
    const vm = ticketVm({ step: 'review' });
    vm.review.large = {
      body: "This order is 40.00% of your account equity. Make sure that's what you meant.",
      confirmed: false,
      toggleLabel: 'I understand, this is a large order',
    };
    vm.review.confirm.disabled = true;
    vm.review.confirm.plain = true;
    await mountTicket(vm);

    expect(screen.getByText(/Large order/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Buy AAPL' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox'));

    expect(vm.actions.toggleLargeConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows Sending… and locks the confirm until the server answers', async () => {
    const vm = ticketVm({ step: 'review' });
    vm.review.confirm = { ...vm.review.confirm, sending: true, disabled: true };
    await mountTicket(vm);

    expect(screen.getByText('Sending…')).toBeOnTheScreen();
    await fireEvent(screen.getByRole('button', { name: 'Buy AAPL' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(vm.actions.submit).not.toHaveBeenCalled();
  });

  it('offers a retry when the order could not be sent', async () => {
    const vm = ticketVm({
      step: 'review',
      review: { error: { title: "Couldn't send the order", body: 'Nothing was placed.' } },
    });
    await mountTicket(vm);

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(vm.actions.retry).toHaveBeenCalledTimes(1);
  });

  it('retries with the same order instead of placing a new one after a send error', async () => {
    const vm = ticketVm({
      step: 'review',
      review: { error: { title: "Couldn't send the order", body: 'Nothing was placed.' } },
    });
    await mountTicket(vm);

    await fireEvent(screen.getByRole('button', { name: 'Buy AAPL' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(vm.actions.retry).toHaveBeenCalledTimes(1);
    expect(vm.actions.submit).not.toHaveBeenCalled();
  });
});

describe('OrderTicketScreen · result', () => {
  it('shows the fill, the new position and the follow-up actions', async () => {
    const vm = await mountTicket(
      ticketVm({
        step: 'result',
        result: {
          tone: 'pos',
          title: 'Order filled',
          body: 'You bought 2.159827 AAPL for $500.00',
          status: 'filled',
          rows: [
            { key: 'avg', label: 'Avg fill price', value: '$231.52' },
            { key: 'slip', label: 'vs quote', value: '+$0.02 slippage' },
            { key: 'id', label: 'Order ID', value: 'o_8f21' },
          ],
          position: [
            { key: 'shares', label: 'New position', value: '44.159827 sh' },
            { key: 'avg', label: 'Avg cost', value: '$200.02' },
            { key: 'weight', label: 'Weight', value: '9.30%' },
          ],
        },
      }),
    );

    expect(screen.getByRole('header', { name: 'Order filled' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Avg fill price: $231.52')).toBeOnTheScreen();
    expect(screen.getByText('44.159827 sh')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'View position' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Set alert' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(vm.actions.viewPosition).toHaveBeenCalledTimes(1);
    expect(vm.actions.setAlert).toHaveBeenCalledTimes(1);
    expect(vm.actions.close).toHaveBeenCalledTimes(1);
  });

  it('explains a rejected order without offering to view a position', async () => {
    await mountTicket(
      ticketVm({
        step: 'result',
        result: {
          tone: 'neg',
          title: 'Order rejected',
          body: 'This order needs $500.00 but you have $10.00 of buying power.',
          status: 'rejected',
          rows: [{ key: 'id', label: 'Order ID', value: 'o_1' }],
          position: null,
        },
      }),
    );

    expect(screen.getByText('Order rejected')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'View position' })).not.toBeOnTheScreen();
  });
});
