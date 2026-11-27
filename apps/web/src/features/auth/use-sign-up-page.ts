import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';

import { useSignUp } from '@sarwa/core';

import { useAuthToasts } from '../gating/use-auth-toasts';
import {
  AUTH_ROUTES,
  type FieldError,
  fieldErrors,
  formStatus,
  type FormStatus,
  type PasswordCheck,
  passwordCheck,
} from './auth-view';

const FIELDS = ['name', 'email', 'password', 'terms'] as const;

export interface SignUpView extends FormStatus {
  values: { name: string; email: string; password: string; terms: boolean };
  errors: Partial<Record<(typeof FIELDS)[number], FieldError>>;
  password: PasswordCheck;
  actions: {
    setName: (value: string) => void;
    setEmail: (value: string) => void;
    setPassword: (value: string) => void;
    setTerms: (value: boolean) => void;
    submit: () => void;
  };
}

// The page lands on Home with a greeting; the gate stays where the guest was, for the intent.
export function useSignUpPage({ inGate = false }: { inGate?: boolean } = {}): SignUpView {
  const form = useSignUp();
  const toasts = useAuthToasts();
  const router = useRouter();
  const [values, setValues] = useState({ name: '', email: '', password: '', terms: false });
  const session = form.data;

  const signedUp = useEffectEvent((created: NonNullable<typeof session>) => {
    toasts.signedUp(created, { greet: !inGate });
    if (!inGate) router.replace(AUTH_ROUTES.home);
  });
  useEffect(() => {
    if (session) signedUp(session);
  }, [session]);

  const set = (patch: Partial<typeof values>) => {
    setValues((current) => ({ ...current, ...patch }));
  };
  return {
    ...formStatus(form),
    values,
    errors: fieldErrors(form.fieldErrors, FIELDS),
    password: passwordCheck(values.password),
    actions: {
      setName: (name) => {
        set({ name });
      },
      setEmail: (email) => {
        set({ email });
      },
      setPassword: (password) => {
        set({ password });
      },
      setTerms: (terms) => {
        set({ terms });
      },
      // A new account on this browser stays signed in, as the board has no checkbox to ask.
      submit: () => {
        // The schema refuses an unticked box with TERMS_REQUIRED.
        form.submit({ ...values, terms: values.terms as true, keepSignedIn: true });
      },
    },
  };
}
