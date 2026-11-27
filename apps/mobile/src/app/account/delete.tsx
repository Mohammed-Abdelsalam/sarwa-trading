import { DeleteAccountScreen } from '../../features/account/danger-screens';
import { useDeleteAccountScreen } from '../../features/account/use-danger-screens';

export default function Route() {
  return <DeleteAccountScreen view={useDeleteAccountScreen()} />;
}
