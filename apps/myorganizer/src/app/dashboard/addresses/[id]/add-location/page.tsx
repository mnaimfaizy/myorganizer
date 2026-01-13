import { AddLocationPage } from '@myorganizer/web-pages/addresses';

export default function AddLocationRoute(props: { params: { id: string } }) {
  return <AddLocationPage params={props.params} />;
}
