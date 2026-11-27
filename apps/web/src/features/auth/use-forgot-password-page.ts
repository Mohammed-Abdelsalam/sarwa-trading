import { useState } from 'react';

import { useForgotPassword } from '@sarwa/core';

import { type FieldError, fieldErrors, formStatus, type FormStatus } from './auth-view';

export interface ForgotPasswordView extends FormStatus {
  // The sent step is shown whether or not the email has an account.
  step: 'form' | 'sent';
  email: string;
  error?: FieldError;
  // The resend cooldown as m:ss; null once the link can be sent again.
  resendIn: string | null;
  actions: {
    setEmail: (value: string) => void;
    submit: () => void;
    resend: () => void;
  };
}

export function useForgotPasswordPage(): ForgotPasswordView {
  const form = useForgotPassword();
  const [email, setEmail] = useState('');
  return {
    ...formStatus(form),
    step: form.sentTo ? 'sent' : 'form',
    email: form.sentTo ?? email,
    error: fieldErrors(form.fieldErrors, ['email'] as const).email,
    resendIn: form.resendIn,
    actions: {
      setEmail,
      submit: () => {
        form.submit({ email });
      },
      resend: form.resend,
    },
  };
}
