import { SuspendedScreen } from '../features/account/session-ended';
import { useSuspendedScreen } from '../features/account/use-suspended-screen';

export default function SuspendedRoute() {
  return <SuspendedScreen view={useSuspendedScreen()} />;
}
