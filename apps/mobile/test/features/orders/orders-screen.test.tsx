import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { type OrderLine } from '../../../src/features/orders/order-copy';
import { OrderDetailScreen } from '../../../src/features/orders/order-detail-screen';
import { OrdersScreen } from '../../../src/features/orders/orders-screen';
import { useOrderDetailScreen } from '../../../src/features/orders/use-order-detail-screen';
import { useOrdersScreen } from '../../../src/features/orders/use-orders-screen';
import { renderScreen } from '../../render';

jest.mock('../../../src/features/orders/use-orders-screen');
jest.mock('../../../src/features/orders/use-order-detail-screen');
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const mockedList = jest.mocked(useOrdersScreen);
const mockedDetail = jest.mocked(useOrderDetailScreen);
type ListVm = ReturnType<typeof useOrdersScreen>;
type DetailVm = ReturnType<typeof useOrderDetailScreen>;

const line: OrderLine = {
  id: 'o_8f1d',
  symbol: 'TSLA',
  side: 'sell',
  status: 'open',
  typeLine: 'Limit $255.00 · GTC',
  amount: '10 sh',
  note: 'Working · 10 remaining',
  time: '1:58 PM ET',
  a11yLabel: 'Sell, TSLA, 10 sh, Limit $255.00 · GTC, Open, Working · 10 remaining, 1:58 PM ET',
};

function listVm(overrides: Partial<ListVm> = {}): ListVm {
  return {
    tab: 'open',
    tabs: [
      { value: 'open', label: 'Open · 1' },
      { value: 'filled', label: 'Filled' },
      { value: 'all', label: 'All' },
    ],
    rows: [{ line, sector: undefined }],
    isLoading: false,
    isError: false,
    isRefreshing: false,
    isLoadingMore: false,
    actions: { setTab: jest.fn(), refresh: jest.fn(), loadMore: jest.fn() },
    ...overrides,
  };
}

function detailVm(overrides: Partial<DetailVm> = {}): DetailVm {
  return {
    isLoading: false,
    isError: false,
    order: {
      symbol: 'XOM',
      sector: 'energy',
      status: 'partially_filled',
      title: 'Sell XOM · Limit',
      subtitle: '15 sh · Limit $116.50 · Day',
      progress: {
        fraction: 8 / 15,
        filled: '8',
        total: '15',
        label: 'Filled 8 of 15',
        avg: 'Avg $116.52',
      },
      timeline: [
        { key: 'placed', title: 'Order placed', detail: '11:38:02 AM ET · o_8ef3', state: 'done' },
        {
          key: 'f1',
          title: 'Partially filled · 5 @ $116.50',
          detail: '11:40:15 AM ET',
          state: 'done',
        },
        { key: 'working', title: 'Working · 7 remaining', detail: '', state: 'now' },
      ],
      rows: [
        { key: 'notional', label: 'Proceeds so far', value: '$932.15', direction: null },
        { key: 'realized', label: 'Realized P&L', value: '−$19.05', direction: 'down' },
      ],
    },
    outcome: null,
    canModify: true,
    canCancel: true,
    cancelLabel: 'Cancel remaining',
    isCanceling: false,
    cancelFailed: false,
    modify: {
      open: false,
      label: 'Limit price',
      prefix: '$',
      text: '',
      saving: false,
      failed: false,
    },
    actions: {
      retry: jest.fn(),
      cancel: jest.fn(),
      startModify: jest.fn(),
      closeModify: jest.fn(),
      setPriceText: jest.fn(),
      saveModify: jest.fn(),
    },
    ...overrides,
  };
}

describe('OrdersScreen', () => {
  it('lists orders with side, type, amount, status and detail', async () => {
    mockedList.mockReturnValue(listVm());
    await renderScreen(<OrdersScreen />);

    expect(screen.getByRole('tab', { name: 'Open · 1' })).toBeSelected();
    expect(screen.getByText('TSLA')).toBeOnTheScreen();
    expect(screen.getByText('Limit $255.00 · GTC')).toBeOnTheScreen();
    expect(screen.getByText('Working · 10 remaining')).toBeOnTheScreen();
    expect(screen.getByText('Open')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: line.a11yLabel }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/orders/[id]',
      params: { id: 'o_8f1d' },
    });
  });

  it('switches between Open, Filled and All', async () => {
    const model = listVm();
    mockedList.mockReturnValue(model);
    await renderScreen(<OrdersScreen />);

    await fireEvent.press(screen.getByRole('tab', { name: 'All' }));
    expect(model.actions.setTab).toHaveBeenCalledWith('all');
  });

  it('shows the empty state', async () => {
    mockedList.mockReturnValue(listVm({ rows: [] }));
    await renderScreen(<OrdersScreen />);

    expect(screen.getByText('No orders yet')).toBeOnTheScreen();
  });

  it('loads older orders when the list nears its end', async () => {
    const model = listVm();
    mockedList.mockReturnValue(model);
    await renderScreen(<OrdersScreen />);

    await fireEvent(screen.getByTestId('orders-list'), 'endReached');

    expect(model.actions.loadMore).toHaveBeenCalledTimes(1);
  });
});

describe('OrderDetailScreen', () => {
  it('shows fill progress, the timeline, proceeds and realized P&L', async () => {
    mockedDetail.mockReturnValue(detailVm());
    await renderScreen(<OrderDetailScreen id="o_8ef3" />);

    expect(screen.getByText('Sell XOM · Limit')).toBeOnTheScreen();
    expect(screen.getByText('Filled 8 / 15')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Filled 8 of 15' })).toBeOnTheScreen();
    expect(screen.getByText('Partially filled · 5 @ $116.50')).toBeOnTheScreen();
    expect(screen.getByText('Working · 7 remaining')).toBeOnTheScreen();
    expect(screen.getByLabelText('Realized P&L: −$19.05')).toBeOnTheScreen();
  });

  it('cancels the remaining shares and opens modify', async () => {
    const model = detailVm();
    mockedDetail.mockReturnValue(model);
    await renderScreen(<OrderDetailScreen id="o_8ef3" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel remaining' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Modify' }));

    expect(model.actions.cancel).toHaveBeenCalledTimes(1);
    expect(model.actions.startModify).toHaveBeenCalledTimes(1);
  });

  it('reports a cancel that lost to a fill as already filled, not as an error', async () => {
    mockedDetail.mockReturnValue(
      detailVm({ outcome: 'already_filled', canCancel: false, canModify: false }),
    );
    await renderScreen(<OrderDetailScreen id="o_8ef3" />);

    expect(screen.getByText(/Already filled/)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cancel remaining' })).not.toBeOnTheScreen();
  });

  it('saves a new limit price from the modify sheet', async () => {
    const model = detailVm({
      modify: {
        open: true,
        label: 'Limit price',
        prefix: '$',
        text: '117.00',
        saving: false,
        failed: false,
      },
    });
    mockedDetail.mockReturnValue(model);
    await renderScreen(<OrderDetailScreen id="o_8ef3" />);

    await fireEvent.changeText(screen.getByLabelText('Limit price'), '117.50');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(model.actions.setPriceText).toHaveBeenCalledWith('117.50');
    expect(model.actions.saveModify).toHaveBeenCalledTimes(1);
  });
});
