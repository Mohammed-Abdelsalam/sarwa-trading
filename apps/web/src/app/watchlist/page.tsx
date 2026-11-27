import { type Metadata } from 'next';

import { WatchlistPage } from '../../features/watchlist/watchlist-page';

export const metadata: Metadata = { title: 'Watchlist' };

// The watchlist belongs to this browser's device id, so it is fetched on the client.
export default function Page() {
  return <WatchlistPage />;
}
