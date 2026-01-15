import { SubscriptionDetailPageClient } from './components/SubscriptionDetailPageClient';

export default function SubscriptionDetailPage(props: {
  params: { id: string };
}) {
  return <SubscriptionDetailPageClient params={props.params} />;
}
