import { ResetAccountScreen } from '../../features/account/danger-screens';
import { useResetAccountScreen } from '../../features/account/use-danger-screens';

export default function Route() {
  return <ResetAccountScreen view={useResetAccountScreen()} />;
}
