import { SecurityScreen } from '../../features/account/security-screen';
import { useSecurityScreen } from '../../features/account/use-security-screen';

export default function Route() {
  return <SecurityScreen view={useSecurityScreen()} />;
}
