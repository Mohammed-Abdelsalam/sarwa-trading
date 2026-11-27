import { WatchlistPage } from '../../features/watchlist/watchlist-page';
import { personalMetadata } from '../../lib/seo';

export const generateMetadata = () => personalMetadata('watchlist');

// The watchlist belongs to this browser's device id, so it is fetched on the client.
export default function Page() {
  return <WatchlistPage />;
}
