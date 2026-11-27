import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ErrorPage from '../../src/app/error';
import { providers } from '../copy';

describe('Error boundary page', () => {
  it('speaks the reader’s language and retries (re-fetching) on Try again', async () => {
    const retry = jest.fn();
    const { wrapper } = providers({ locale: 'ar' });
    render(<ErrorPage error={new Error('boom')} retry={retry} />, { wrapper });

    expect(screen.getByText('حدث خطأ ما')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'حاول مجددًا' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
