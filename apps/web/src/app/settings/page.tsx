import { SettingsPage } from '../../features/settings/settings-page';
import { personalMetadata } from '../../lib/seo';

export const generateMetadata = () => personalMetadata('settings');

export default function Page() {
  return <SettingsPage />;
}
