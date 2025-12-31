import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - MyOrganizer',
  description: 'Create your MyOrganizer account',
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
