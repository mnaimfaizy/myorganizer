import RootAuthRedirect from './components/RootAuthRedirect';
import LandingContent from './components/LandingContent';

export default function HomePage() {
  return (
    <RootAuthRedirect>
      <LandingContent />
    </RootAuthRedirect>
  );
}
