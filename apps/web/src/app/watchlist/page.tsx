import { WatchlistPage } from '../../features/watchlist/watchlist-page';
import { personalMetadata } from '../../lib/seo';

export const generateMetadata = () => personalMetadata('watchlist');

// Guests star too, on a device account the browser identifies, so the list loads after hydration.
export default function Page() {
  return <WatchlistPage />;
}
