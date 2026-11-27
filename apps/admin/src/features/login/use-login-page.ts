import { type Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { LoginRequestSchema } from '@sarwa/contracts';
import { useLiveTicker, useLogin } from '@sarwa/core/admin';

import { safeNext } from '../../lib/browser';

export type LoginFieldError = 'emailInvalid' | 'passwordShort';

const TICKER = ['NVDA', 'AAPL', 'TSLA'];

function validate(email: string, password: string) {
  const result = LoginRequestSchema.safeParse({ email: email.trim(), password });
  const errors: { email?: LoginFieldError; password?: LoginFieldError } = {};
  if (result.success) return errors;
  for (const issue of result.error.issues) {
    if (issue.path[0] === 'email') errors.email = 'emailInvalid';
    if (issue.path[0] === 'password') errors.password = 'passwordShort';
  }
  return errors;
}

export function useLoginPage() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const login = useLogin({
    onSuccess: () => {
      router.replace(next as Route);
    },
  });
  const ticker = useLiveTicker(TICKER);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(email, password) : {};

  return {
    email,
    password,
    remember,
    showPassword,
    errors,
    error: login.error,
    attemptsLeft: login.attemptsLeft,
    cooldownSeconds: login.cooldownSeconds,
    isPending: login.isPending,
    ticker: ticker.rows,
    tickerLoading: ticker.isLoading,
    actions: {
      setEmail,
      setPassword,
      setRemember,
      toggleShowPassword: () => {
        setShowPassword((shown) => !shown);
      },
      submit: () => {
        setSubmitted(true);
        if (Object.keys(validate(email, password)).length > 0) return;
        login.submit({ email: email.trim(), password, remember });
      },
    },
  };
}

export type LoginPageModel = ReturnType<typeof useLoginPage>;
