import { render, screen } from '@testing-library/react';

import NotFound, { generateMetadata } from '../../src/app/not-found';

jest.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (name === 'sarwa.locale' ? { value: 'ar' } : undefined),
    }),
}));

describe('Not found page', () => {
  it('uses the language from the cookie for the copy and the title', async () => {
    render(await NotFound());

    expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'العودة إلى الأسواق' })).toHaveAttribute(
      'href',
      '/markets',
    );
    await expect(generateMetadata()).resolves.toEqual({ title: 'غير موجودة' });
  });
});
