import { useLocalSearchParams } from 'expo-router';

import { AlertsScreen } from '../features/alerts/alerts-screen';

export default function AlertsRoute() {
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  return <AlertsScreen symbol={symbol?.toUpperCase()} />;
}
