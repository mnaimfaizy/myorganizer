import { SubscriptionDetailPage } from '@myorganizer/web-pages/subscriptions';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  return <SubscriptionDetailPage params={params} />;
}
