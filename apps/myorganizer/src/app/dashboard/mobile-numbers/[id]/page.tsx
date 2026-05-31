import { MobileNumberDetailPage } from '@myorganizer/web-pages/mobile-numbers';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  return <MobileNumberDetailPage params={params} />;
}
