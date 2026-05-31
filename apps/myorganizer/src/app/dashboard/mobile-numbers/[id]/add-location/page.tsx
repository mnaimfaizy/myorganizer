import { AddLocationPage } from '@myorganizer/web-pages/mobile-numbers';

export default async function AddLocationRoute(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;

  return <AddLocationPage params={params} />;
}
