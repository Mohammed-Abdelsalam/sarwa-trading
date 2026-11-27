import { Redirect, useLocalSearchParams } from 'expo-router';

import { ResetPasswordScreen } from '../../features/auth/reset-password-screen';
import { useResetPasswordScreen } from '../../features/auth/use-reset-password-screen';

function ResetPassword({ token }: { token: string }) {
  return <ResetPasswordScreen view={useResetPasswordScreen(token)} />;
}

// Opened from the emailed link (minitrading://reset-password?token=…).
export default function ResetPasswordRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  if (typeof token !== 'string' || token === '') return <Redirect href="/forgot-password" />;
  return <ResetPassword token={token} />;
}
