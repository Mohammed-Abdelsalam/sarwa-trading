import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';

import { type GuestDataCounts } from '@sarwa/contracts';
import { useSignIn } from '@sarwa/core';

import { useAuthToasts } from '../gating/use-auth-toasts';
import {
  AUTH_ROUTES,
  type FieldError,
  fieldErrors,
  formStatus,
  type FormStatus,
} from './auth-view';

const FIELDS = ['email', 'password'] as const;

export interface SignInView extends FormStatus {
  values: { email: string; password: string; keepSignedIn: boolean };
  errors: Partial<Record<(typeof FIELDS)[number], FieldError>>;
  // A 409 GUEST_DATA_PRESENT: this device's guest data, waiting for "Sign in anyway".
  guestData: GuestDataCounts | null;
  actions: {
    setEmail: (value: string) => void;
    setPassword: (value: string) => void;
    setKeepSignedIn: (value: boolean) => void;
    submit: () => void;
    confirmDiscard: () => void;
    cancelDiscard: () => void;
  };
}

// A suspension needs nothing here: the session turns suspended and the app routes to /suspended.
export function useSignInPage({ inGate = false }: { inGate?: boolean } = {}): SignInView {
  const form = useSignIn();
  const toasts = useAuthToasts();
  const router = useRouter();
  const [values, setValues] = useState({ email: '', password: '', keepSignedIn: false });
  const session = form.data;

  const signedIn = useEffectEvent((started: NonNullable<typeof session>) => {
    toasts.signedIn(started);
    if (!inGate) router.replace(AUTH_ROUTES.home);
  });
  useEffect(() => {
    if (session) signedIn(session);
  }, [session]);

  const set = (patch: Partial<typeof values>) => {
    setValues((current) => ({ ...current, ...patch }));
  };
  return {
    ...formStatus(form),
    values,
    errors: fieldErrors(form.fieldErrors, FIELDS),
    guestData: form.counts,
    actions: {
      setEmail: (email) => {
        set({ email });
      },
      setPassword: (password) => {
        set({ password });
      },
      setKeepSignedIn: (keepSignedIn) => {
        set({ keepSignedIn });
      },
      submit: () => {
        form.submit(values);
      },
      confirmDiscard: form.confirm,
      cancelDiscard: form.cancel,
    },
  };
}
