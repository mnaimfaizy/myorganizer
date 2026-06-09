import { GroceriesListDetailPage } from '@myorganizer/web-pages/groceries';

export default async function GroceriesDetailPage(props: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await props.params;

  return <GroceriesListDetailPage listId={listId} />;
}
