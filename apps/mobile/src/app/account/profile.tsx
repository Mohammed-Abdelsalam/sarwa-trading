import { ProfileScreen } from '../../features/account/profile-screen';
import { useProfileScreen } from '../../features/account/use-profile-screen';

export default function Route() {
  return <ProfileScreen view={useProfileScreen()} />;
}
