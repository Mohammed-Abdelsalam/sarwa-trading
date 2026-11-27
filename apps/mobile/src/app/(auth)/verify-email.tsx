import { Redirect, useLocalSearchParams } from 'expo-router';

import { useVerifyEmailScreen } from '../../features/auth/use-verify-email-screen';
import { VerifyEmailScreen } from '../../features/auth/verify-email-screen';

function VerifyEmail({ token }: { token: string }) {
  return <VerifyEmailScreen view={useVerifyEmailScreen(token)} />;
}

export default function VerifyEmailRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  if (typeof token !== 'string' || token === '') return <Redirect href="/(tabs)" />;
  return <VerifyEmail token={token} />;
}
