import { readFileSync } from 'node:fs';
import path from 'node:path';

// Browsers ask for /favicon.ico directly whatever the page links, so the app must serve one.
describe('favicon', () => {
  it('ships an .ico in the app root, where Next serves it at /favicon.ico', () => {
    const icon = readFileSync(path.join(__dirname, '../../src/app/favicon.ico'));

    expect([...icon.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    expect(icon.readUInt16LE(4)).toBeGreaterThan(0);
  });
});
