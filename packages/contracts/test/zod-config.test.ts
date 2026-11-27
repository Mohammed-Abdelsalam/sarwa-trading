import type * as Contracts from '../src';

describe('zod config', () => {
  it('turns jitless on before any schema is built, so no eval probe trips a strict CSP', () => {
    const probe = jest.spyOn(globalThis, 'Function');
    jest.isolateModules(() => {
      const { SignInRequestSchema } = jest.requireActual<typeof Contracts>('../src');
      expect(SignInRequestSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
      expect(SignInRequestSchema.safeParse({ email: 'nope' }).success).toBe(false);
    });

    // Coverage instrumentation calls Function too; Zod's probe is the empty one.
    expect(probe).not.toHaveBeenCalledWith('');
  });
});
