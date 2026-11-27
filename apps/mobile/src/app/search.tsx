import { useLocalSearchParams } from 'expo-router';

import { SearchScreen } from '../features/search/search-screen';

export default function SearchRoute() {
  const params = useLocalSearchParams<{ for?: string }>();
  return <SearchScreen purpose={params.for} />;
}
