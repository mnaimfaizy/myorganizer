import { MobileNumberDetailPage } from '@myorganizer/web-pages/mobile-numbers';

export default function Page(props: { params: { id: string } }) {
  return <MobileNumberDetailPage params={props.params} />;
}
