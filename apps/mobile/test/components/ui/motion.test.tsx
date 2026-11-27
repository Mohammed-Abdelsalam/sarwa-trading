import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { cancelAnimation, useReducedMotion } from 'react-native-reanimated';

import { Sheet } from '../../../src/components/ui/sheet';
import { Skeleton } from '../../../src/components/ui/skeleton';
import { renderScreen } from '../../render';

const reducedMotion = jest.mocked(useReducedMotion);

afterEach(() => {
  reducedMotion.mockReturnValue(false);
});

describe('reduced motion', () => {
  it('fades the sheet in instead of sliding it', async () => {
    reducedMotion.mockReturnValue(true);
    await renderScreen(
      <Sheet visible onClose={jest.fn()}>
        <Text>Body</Text>
      </Sheet>,
    );

    let host = screen.getByText('Body').parent;
    while (host && host.props.animationType === undefined) host = host.parent;

    expect(host?.props.animationType).toBe('fade');
  });

  it('stops the skeleton pulse when reduced motion turns on', async () => {
    await renderScreen(<Skeleton />);
    reducedMotion.mockReturnValue(true);
    await screen.rerender(<Skeleton />);

    expect(cancelAnimation).toHaveBeenCalled();
  });
});
