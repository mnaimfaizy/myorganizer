import { AddressDetailPage } from '@myorganizer/web-pages/addresses';

export default function Page(props: { params: { id: string } }) {
  return <AddressDetailPage params={props.params} />;
}
