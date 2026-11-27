import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Banner } from '../../../src/components/ui/banner';
import { Snackbar } from '../../../src/components/ui/snackbar';
import { renderScreen } from '../../render';

describe('dismiss buttons', () => {
  it('labels the banner dismiss button in the app language', async () => {
    await renderScreen(
      <Banner tone="info" onDismiss={jest.fn()}>
        <Text>Hi</Text>
      </Banner>,
      { locale: 'ar' },
    );

    expect(screen.getByRole('button', { name: 'إخفاء' })).toBeOnTheScreen();
  });

  it('labels the snackbar dismiss button in the app language', async () => {
    await renderScreen(
      <Snackbar message="Removed" actionLabel="Undo" onAction={jest.fn()} onDismiss={jest.fn()} />,
      { locale: 'ar' },
    );

    expect(screen.getByRole('button', { name: 'إخفاء' })).toBeOnTheScreen();
  });
});
