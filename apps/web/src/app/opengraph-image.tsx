import { appMessages } from '../lib/messages';
import { OG_SIZE, ogCard } from '../lib/og-card';

const { seo } = appMessages.en;

export const alt = seo.siteName;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ title: seo.siteName, subtitle: seo.description });
}
