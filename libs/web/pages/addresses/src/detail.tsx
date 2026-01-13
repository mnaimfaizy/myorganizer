import { AddressDetailPageClient } from './components/AddressDetailPageClient';

export default function AddressDetailPage(props: { params: { id: string } }) {
  return <AddressDetailPageClient params={props.params} />;
}
