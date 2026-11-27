import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { POLICY, useSignUp } from '@sarwa/core';

import { deviceModel } from '../../lib/device';
import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import { showToast } from '../../lib/toast';
import { authNotice, fieldErrorText, strengthOf, submitModel, useFields } from './auth-form';
import { type SignUpView } from './sign-up-screen';

export function useSignUpScreen(): SignUpView {
  const copy = useCopy();
  const { t, f } = copy;
  const form = useSignUp();
  const [terms, setTerms] = useState(false);
  const clear = () => {
    if (!form.isPending) form.reset();
  };
  const { values, field } = useFields(['name', 'email', 'password'], clear);
  const errors = form.fieldErrors;
  const claimed = form.data?.claimed;
  const name = form.data?.user.name;

  useEffect(() => {
    if (!name) return;
    showToast(
      claimed && claimed.positions + claimed.openOrders > 0
        ? t.toasts.claimedTitleMobile
        : t.toasts.readyBodyMobile({ name }),
    );
    goBack();
  }, [name, claimed, t]);

  const submit = () => {
    // An unticked box is sent through the schema so it answers with TERMS_REQUIRED.
    form.submit({
      ...values,
      terms: terms as true,
      keepSignedIn: true,
      deviceModel: deviceModel(),
    });
  };

  return {
    startingCash: f.money(POLICY.startingCashCents, { whole: true }),
    name: field('name', fieldErrorText(errors.name, copy)),
    email: field('email', fieldErrorText(errors.email, copy)),
    password: field('password', fieldErrorText(errors.password, copy)),
    strength: strengthOf(values.password),
    terms: {
      checked: terms,
      onChange: (checked) => {
        setTerms(checked);
        clear();
      },
      error: fieldErrorText(errors.terms, copy),
    },
    notice: authNotice(form, copy),
    submit: submitModel(form, submit),
    onSignIn: () => {
      router.replace('/sign-in');
    },
    onClose: goBack,
  };
}
