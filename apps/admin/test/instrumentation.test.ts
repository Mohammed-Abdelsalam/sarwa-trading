/**
 * @jest-environment node
 */
import { forwardClientAddress } from '@sarwa/ui/next-config';

import { register } from '../src/instrumentation';

jest.mock('@sarwa/ui/next-config', () => ({ forwardClientAddress: jest.fn() }));

describe('instrumentation', () => {
  const runtime = (NEXT_RUNTIME: string) => {
    jest.replaceProperty(process, 'env', { ...process.env, NEXT_RUNTIME });
  };

  it('records the real client address on the Node.js server, never in the edge runtime', async () => {
    runtime('edge');
    await register();
    expect(forwardClientAddress).not.toHaveBeenCalled();

    runtime('nodejs');
    await register();
    expect(forwardClientAddress).toHaveBeenCalledTimes(1);
  });
});
