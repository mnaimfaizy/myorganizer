import { AddLocationPage } from '@myorganizer/web-pages/mobile-numbers';

export default function AddLocationRoute(props: { params: { id: string } }) {
  return <AddLocationPage params={props.params} />;
}
