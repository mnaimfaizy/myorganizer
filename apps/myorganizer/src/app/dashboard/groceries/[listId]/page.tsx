import { GroceriesListDetailPage } from '@myorganizer/web-pages/groceries';

interface GroceriesDetailPageProps {
  params: Promise<{ listId: string }>;
}

export default async function GroceriesDetailPage({
  params,
}: GroceriesDetailPageProps) {
  const { listId } = await params;
  return <GroceriesListDetailPage listId={listId} />;
}
