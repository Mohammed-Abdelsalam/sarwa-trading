import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { CommandPalette, type CommandGroup } from '../src/primitives/command-palette';
import {
  Drawer,
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  Sheet,
} from '../src/primitives/overlay';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  };
});

describe('Drawer', () => {
  it('is a titled dialog that traps focus and closes on Esc', async () => {
    const onOpenChange = jest.fn();
    render(
      <>
        <button type="button">Outside</button>
        <Drawer open onOpenChange={onOpenChange} title="Sell XOM · Limit" closeLabel="Close">
          <button type="button">Cancel remaining</button>
        </Drawer>
      </>,
    );
    expect(screen.getByRole('dialog', { name: 'Sell XOM · Limit' })).toBeInTheDocument();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancel remaining' })).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes from its labelled close button', async () => {
    const onOpenChange = jest.fn();
    render(<Drawer open onOpenChange={onOpenChange} title="Order" closeLabel="Close order" />);
    await userEvent.click(screen.getByRole('button', { name: 'Close order' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Drawer side', () => {
  it('sits on the inline end, so it opens from the left in Arabic', () => {
    render(<Drawer open onOpenChange={jest.fn()} title="Order" closeLabel="Close" />);

    expect(screen.getByRole('dialog')).toHaveClass('end-0', 'border-s');
  });
});

describe('Sheet', () => {
  it('keeps an accessible name when the title is visually hidden', () => {
    render(<Sheet open onOpenChange={jest.fn()} title="Buy AAPL" hideTitle />);
    expect(screen.getByRole('dialog', { name: 'Buy AAPL' })).toBeInTheDocument();
  });
});

describe('CommandPalette', () => {
  function Harness({ onBuy, onOrders }: { onBuy: () => void; onOrders: () => void }) {
    const [open, setOpen] = useState(true);
    const [query, setQuery] = useState('');
    const groups: CommandGroup[] = [
      {
        group: 'Actions',
        items: [{ id: 'buy', label: 'Buy NVDA', shortcut: '↵', onSelect: onBuy }],
      },
      { group: 'Navigate', items: [{ id: 'orders', label: 'Orders', onSelect: onOrders }] },
    ];
    return (
      <>
        <span>{open ? 'open' : 'closed'}</span>
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          label="Command palette"
          query={query}
          onQueryChange={setQuery}
          groups={groups}
          hints={[{ keys: '↑↓', label: 'move' }]}
        />
      </>
    );
  }

  it('moves through results with arrows and runs the active one with Enter', async () => {
    const onBuy = jest.fn();
    const onOrders = jest.fn();
    render(<Harness onBuy={onBuy} onOrders={onOrders} />);

    const input = screen.getByRole('combobox', { name: 'Command palette' });
    expect(input).toHaveFocus();
    expect(screen.getByRole('option', { name: /Buy NVDA/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('group', { name: 'Actions' })).toBeInTheDocument();

    await userEvent.keyboard('{ArrowDown}');
    const orders = screen.getByRole('option', { name: 'Orders' });
    expect(orders).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', orders.id);

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /Buy NVDA/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(onOrders).toHaveBeenCalledTimes(1);
    expect(onBuy).not.toHaveBeenCalled();
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('closes on Esc', async () => {
    render(<Harness onBuy={jest.fn()} onOrders={jest.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'nv');
    expect(screen.getByRole('combobox')).toHaveValue('nv');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('closed')).toBeInTheDocument();
  });
});

describe('Menu', () => {
  it('opens from its trigger and runs an item', async () => {
    const onSelect = jest.fn();
    render(
      <Menu>
        <MenuTrigger asChild>
          <button type="button">Alert actions</button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onSelect}>Pause</MenuItem>
          <MenuItem danger>Delete</MenuItem>
        </MenuContent>
      </Menu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Alert actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Pause' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers radio items that report the checked value', async () => {
    const onValueChange = jest.fn();
    render(
      <Menu>
        <MenuTrigger asChild>
          <button type="button">Language</button>
        </MenuTrigger>
        <MenuContent>
          <MenuRadioGroup value="en" onValueChange={onValueChange}>
            <MenuRadioItem value="en">English</MenuRadioItem>
            <MenuRadioItem value="ar">العربية</MenuRadioItem>
          </MenuRadioGroup>
        </MenuContent>
      </Menu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Language' }));

    expect(screen.getByRole('menuitemradio', { name: 'English' })).toBeChecked();
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'العربية' }));
    expect(onValueChange).toHaveBeenCalledWith('ar');
  });
});
