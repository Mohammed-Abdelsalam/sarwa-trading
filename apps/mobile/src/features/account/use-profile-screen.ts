import { useEffect, useState } from 'react';

import { useResendVerification, useSession, useUpdateProfile } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import { showToast } from '../../lib/toast';
import { authNotice, fieldErrorText, submitModel } from '../auth/auth-form';
import { type ProfileView } from './profile-screen';

export function useProfileScreen(): ProfileView {
  const copy = useCopy();
  const { t, f } = copy;
  const { user } = useSession();
  const form = useUpdateProfile({
    onSuccess: () => {
      showToast(t.toasts.profileSaved);
      goBack();
    },
  });
  const resend = useResendVerification();
  const [name, setName] = useState(user?.name ?? '');

  useEffect(() => {
    if (resend.sent) showToast(t.toasts.verificationSent);
  }, [resend.sent, t]);

  return {
    name: {
      value: name,
      onChange: (text) => {
        setName(text);
        if (!form.isPending) form.reset();
      },
      error: fieldErrorText(form.fieldErrors.name, copy),
    },
    email: user?.email ?? '',
    emailVerified: user?.emailVerified ?? false,
    handle: user?.account.handle ?? '',
    memberSince: user ? t.account.profile.memberSince({ date: f.date(user.createdAt) }) : '',
    resend:
      user && !user.emailVerified
        ? {
            label: resend.resendIn
              ? t.auth.forgot.resendInShort({ time: resend.resendIn })
              : t.account.profile.resend,
            disabled: !resend.canResend,
            onPress: () => {
              resend.resend();
            },
          }
        : undefined,
    notice: authNotice(form, copy),
    submit: submitModel(form, () => {
      form.submit({ name });
    }),
    onBack: goBack,
  };
}
