import { MobileNumberDetailPageClient } from './components/MobileNumberDetailPageClient';

export default function MobileNumberDetailPage(props: {
  params: { id: string };
}) {
  return <MobileNumberDetailPageClient params={props.params} />;
}
