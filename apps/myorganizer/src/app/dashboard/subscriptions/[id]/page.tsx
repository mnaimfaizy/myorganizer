import { SubscriptionDetailPage } from '@myorganizer/web-pages/subscriptions';

export default function Page(props: { params: { id: string } }) {
  return <SubscriptionDetailPage params={props.params} />;
}
