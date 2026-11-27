import { render, screen } from '@testing-library/react';

import { AppShell } from '../../../src/components/layout/app-shell';
import { providers } from '../../copy';

jest.mock('../../../src/components/layout/top-nav', () => ({ TopNav: () => null }));
jest.mock('../../../src/components/layout/app-banners', () => ({ AppBanners: () => null }));

describe('AppShell', () => {
  it('offers the skip link in the reader’s language, placed at the inline start', () => {
    const { wrapper } = providers({ locale: 'ar' });
    render(<AppShell>content</AppShell>, { wrapper });

    const skip = screen.getByRole('link', { name: 'انتقل إلى المحتوى' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(skip).toHaveClass('focus:start-4');
  });
});
