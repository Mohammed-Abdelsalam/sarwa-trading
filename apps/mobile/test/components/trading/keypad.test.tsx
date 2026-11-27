import { fireEvent, screen } from '@testing-library/react-native';

import { Keypad } from '../../../src/components/trading/keypad';
import { layoutDirection, renderScreen } from '../../render';

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

  it('keeps the phone-pad order left to right in Arabic', async () => {
    await renderScreen(<Keypad onKey={jest.fn()} />, { locale: 'ar' });

    for (const key of screen.getAllByRole('keyboardkey')) {
      expect(layoutDirection(key)).toBe('ltr');
    }
  });
});
