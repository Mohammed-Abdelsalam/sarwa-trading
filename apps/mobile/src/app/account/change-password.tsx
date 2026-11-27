import { ChangePasswordScreen } from '../../features/account/change-password-screen';
import { useChangePasswordScreen } from '../../features/account/use-change-password-screen';

export default function Route() {
  return <ChangePasswordScreen view={useChangePasswordScreen()} />;
}
