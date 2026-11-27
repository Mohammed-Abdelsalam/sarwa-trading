import { SignInScreen } from '../../features/auth/sign-in-screen';
import { useSignInScreen } from '../../features/auth/use-sign-in-screen';

export default function SignInRoute() {
  return <SignInScreen view={useSignInScreen()} />;
}
