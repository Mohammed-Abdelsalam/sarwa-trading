import { SignUpScreen } from '../../features/auth/sign-up-screen';
import { useSignUpScreen } from '../../features/auth/use-sign-up-screen';

export default function SignUpRoute() {
  return <SignUpScreen view={useSignUpScreen()} />;
}
