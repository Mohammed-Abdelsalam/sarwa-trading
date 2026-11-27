import { act, fireEvent, render, screen } from '@testing-library/react';

import { ToastHost, useToast } from '../../src/components/common/toasts';

function Saver() {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        toast('Invite revoked');
      }}
    >
      Save
    </button>
  );
}

describe('ToastHost', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a toast as a status and hides it after a few seconds', () => {
    jest.useFakeTimers();
    render(
      <ToastHost>
        <Saver />
      </ToastHost>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('status')).toHaveTextContent('Invite revoked');

    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does nothing outside a host', () => {
    render(<Saver />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
