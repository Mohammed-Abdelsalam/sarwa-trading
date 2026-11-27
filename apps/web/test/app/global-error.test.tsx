import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import GlobalError from '../../src/app/global-error';

describe('Global error page', () => {
  afterEach(() => {
    document.cookie = 'sarwa.locale=; max-age=0';
  });

  it('takes the language from the cookie, since the providers failed with the layout', async () => {
    document.cookie = 'sarwa.locale=ar';
    const retry = jest.fn();
    // It renders its own <html>, so it mounts on the document like Next does.
    render(<GlobalError error={new Error('boom')} retry={retry} />, {
      container: document as unknown as HTMLElement,
    });

    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    await userEvent.click(screen.getByRole('button', { name: 'حاول مجددًا' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
