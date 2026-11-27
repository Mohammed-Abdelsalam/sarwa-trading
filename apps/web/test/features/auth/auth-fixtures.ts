import { type PasswordCheck } from '../../../src/features/auth/auth-view';
import { type ForgotPasswordView } from '../../../src/features/auth/use-forgot-password-page';
import { type ResetPasswordView } from '../../../src/features/auth/use-reset-password-page';
import { type SignInView } from '../../../src/features/auth/use-sign-in-page';
import { type SignUpView } from '../../../src/features/auth/use-sign-up-page';
import { type VerifyEmailView } from '../../../src/features/auth/use-verify-email-page';

export const goodPassword: PasswordCheck = {
  strength: 3,
  minLength: 8,
  longEnough: true,
  notCommon: true,
  hasNumberOrSymbol: false,
};

export function signUpView(overrides: Partial<SignUpView> = {}): SignUpView {
  return {
    values: {
      name: 'Sara Hassan',
      email: 'sara.h@example.com',
      password: 'Tradingisfun',
      terms: true,
    },
    errors: {},
    password: goodPassword,
    problem: null,
    retryIn: null,
    retryReady: false,
    isPending: false,
    actions: {
      setName: jest.fn(),
      setEmail: jest.fn(),
      setPassword: jest.fn(),
      setTerms: jest.fn(),
      submit: jest.fn(),
    },
    ...overrides,
  };
}

export function signInView(overrides: Partial<SignInView> = {}): SignInView {
  return {
    values: { email: 'sara.h@example.com', password: 'hunter2hunter2', keepSignedIn: true },
    errors: {},
    problem: null,
    retryIn: null,
    retryReady: false,
    isPending: false,
    guestData: null,
    actions: {
      setEmail: jest.fn(),
      setPassword: jest.fn(),
      setKeepSignedIn: jest.fn(),
      submit: jest.fn(),
      confirmDiscard: jest.fn(),
      cancelDiscard: jest.fn(),
    },
    ...overrides,
  };
}

export function forgotView(overrides: Partial<ForgotPasswordView> = {}): ForgotPasswordView {
  return {
    step: 'form',
    email: 'sara.h@example.com',
    problem: null,
    retryIn: null,
    retryReady: false,
    isPending: false,
    resendIn: null,
    actions: { setEmail: jest.fn(), submit: jest.fn(), resend: jest.fn() },
    ...overrides,
  };
}

export function resetView(overrides: Partial<ResetPasswordView> = {}): ResetPasswordView {
  return {
    status: 'form',
    email: 'sara.h@example.com',
    values: { password: 'Tr4ding!sFun2026', confirm: 'Tr4ding!sFun2026' },
    errors: {},
    password: { ...goodPassword, strength: 4, hasNumberOrSymbol: true },
    matches: true,
    problem: null,
    retryIn: null,
    retryReady: false,
    isPending: false,
    sessionsRevoked: 0,
    actions: { setPassword: jest.fn(), setConfirm: jest.fn(), submit: jest.fn() },
    ...overrides,
  };
}

export function verifyView(overrides: Partial<VerifyEmailView> = {}): VerifyEmailView {
  return {
    status: 'ok',
    email: 'sara.h@example.com',
    resend: 'idle',
    actions: { resend: jest.fn() },
    ...overrides,
  };
}
