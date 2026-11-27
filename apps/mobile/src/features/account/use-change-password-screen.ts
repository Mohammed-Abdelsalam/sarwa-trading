import { useChangePassword } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import { showToast } from '../../lib/toast';
import { authNotice, fieldErrorText, strengthOf, submitModel, useFields } from '../auth/auth-form';
import { type ChangePasswordView } from './change-password-screen';

export function useChangePasswordScreen(): ChangePasswordView {
  const copy = useCopy();
  const { t } = copy;
  const form = useChangePassword({
    onSuccess: () => {
      showToast(t.toasts.passwordUpdated);
      goBack();
    },
  });
  const { values, field } = useFields(['current', 'password', 'confirm'], () => {
    if (!form.isPending) form.reset();
  });
  const errors = form.fieldErrors;

  return {
    current: field('current', fieldErrorText(errors.current, copy)),
    password: field('password', fieldErrorText(errors.next, copy)),
    confirm: field('confirm', fieldErrorText(errors.confirm, copy)),
    strength: strengthOf(values.password),
    matches: values.confirm.length > 0 && values.confirm === values.password,
    notice: authNotice(form, copy),
    submit: submitModel(form, () => {
      form.submit({ current: values.current, next: values.password, confirm: values.confirm });
    }),
    onBack: goBack,
  };
}
