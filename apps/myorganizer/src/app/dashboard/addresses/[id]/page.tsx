import { AddressDetailPage } from '@myorganizer/web-pages/addresses';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  return <AddressDetailPage params={params} />;
}
