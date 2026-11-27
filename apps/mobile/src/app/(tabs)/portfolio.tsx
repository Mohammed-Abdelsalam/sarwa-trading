import { GuestPortfolioTab, MemberOnly } from '../../features/gating/guest-views';
import { PortfolioScreen } from '../../features/portfolio/portfolio-screen';

export default function PortfolioRoute() {
  return (
    <MemberOnly guest={<GuestPortfolioTab />}>
      <PortfolioScreen />
    </MemberOnly>
  );
}
