import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AcceptInviteRequestSchema } from '@sarwa/contracts';
import { NAME_MAX_LENGTH, PASSWORD_POLICY, passwordStrength } from '@sarwa/core';
import { useAcceptInvite, useInviteInfo } from '@sarwa/core/admin';

import { type InviteView } from './invite-page';

type InviteErrors = InviteView['errors'];
type InviteFieldError = NonNullable<InviteErrors['name']>;
const FIELD_ERRORS: readonly string[] = [
  'NAME_REQUIRED',
  'NAME_TOO_LONG',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'PASSWORD_COMMON',
] satisfies InviteFieldError[];
const isFieldError = (code: string): code is InviteFieldError => FIELD_ERRORS.includes(code);

function validate(token: string, name: string, password: string) {
  const parsed = AcceptInviteRequestSchema.safeParse({ token, name, password });
  const errors: InviteErrors = {};
  if (parsed.success) return { body: parsed.data, errors };
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if ((field === 'name' || field === 'password') && isFieldError(issue.message)) {
      errors[field] ??= issue.message;
    }
  }
  return { body: null, errors };
}

// Public: an unknown or expired link shows its own state and never sends anyone to sign in.
export function useInvitePage(token: string): InviteView {
  const router = useRouter();
  const info = useInviteInfo(token);
  const accept = useAcceptInvite({
    onSuccess: () => {
      router.replace('/overview');
    },
  });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { body, errors } = validate(token, name, password);

  return {
    status: info.isError ? 'invalid' : info.isPending ? 'loading' : 'ready',
    info: info.data ?? null,
    name,
    password,
    showPassword,
    strength: passwordStrength(password),
    errors: submitted ? errors : {},
    limits: {
      nameMax: NAME_MAX_LENGTH,
      passwordMin: PASSWORD_POLICY.minLength,
      passwordMax: PASSWORD_POLICY.maxLength,
    },
    isSubmitting: accept.isPending,
    failed: accept.isError,
    actions: {
      setName,
      setPassword,
      toggleShowPassword: () => {
        setShowPassword((shown) => !shown);
      },
      submit: () => {
        setSubmitted(true);
        if (body) accept.mutate(body);
      },
    },
  };
}
