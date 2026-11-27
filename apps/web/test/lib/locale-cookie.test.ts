/**
 * @jest-environment-options {"url": "https://mini-trading.example/"}
 */
import { writePreferenceCookie } from '../../src/lib/locale-cookie';

describe('preference cookie', () => {
  it('is marked secure when the site is served over https', () => {
    const set = jest.spyOn(document, 'cookie', 'set');

    writePreferenceCookie('sarwa.locale', 'ar');

    expect(set).toHaveBeenCalledWith(expect.stringMatching(/^sarwa\.locale=ar; .*; secure$/));
  });
});
