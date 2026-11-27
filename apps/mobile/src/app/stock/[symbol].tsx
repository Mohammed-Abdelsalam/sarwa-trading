import { Redirect, useLocalSearchParams } from 'expo-router';

// Old links and the search screen still use /stock; they land on the canonical /stocks route.
export default function LegacyStockRoute() {
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  return <Redirect href={{ pathname: '/stocks/[symbol]', params: { symbol: symbol ?? '' } }} />;
}
