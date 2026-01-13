import { AddLocationPageClient } from './components/AddLocationPageClient';

export default function AddLocationPage(props: { params: { id: string } }) {
  return <AddLocationPageClient params={props.params} />;
}
