import { ForgotPasswordScreen } from '../../features/auth/forgot-password-screen';
import { useForgotPasswordScreen } from '../../features/auth/use-forgot-password-screen';

export default function ForgotPasswordRoute() {
  return <ForgotPasswordScreen view={useForgotPasswordScreen()} />;
}
