import { fireEvent, screen } from '@testing-library/react-native';

import { Keypad } from '../../../src/components/trading/keypad';
import { renderScreen } from '../../render';

describe('Keypad', () => {
  it('shows a dot on the decimal key and keeps the spoken name for screen readers', async () => {
    const onKey = jest.fn();
    await renderScreen(<Keypad onKey={onKey} />);

    const decimal = screen.getByRole('keyboardkey', { name: 'Decimal point' });
    expect(decimal).toHaveTextContent('.');
    expect(screen.queryByText('Decimal point')).toBeNull();

    await fireEvent.press(decimal);
    expect(onKey).toHaveBeenCalledWith('.');
  });
});
