import type { Meta, StoryObj } from '@storybook/react';

import { Avatar, AvatarFallback, AvatarImage } from './Avatar';

const AVATAR_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23e2e8f0"/><circle cx="20" cy="16" r="7" fill="%2394a3b8"/><ellipse cx="20" cy="34" rx="12" ry="8" fill="%2394a3b8"/></svg>',
  );

function AvatarFallbackExample() {
  return (
    <Avatar>
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  );
}

function AvatarWithImageExample() {
  return (
    <Avatar>
      <AvatarImage src={AVATAR_DATA_URI} alt="Jane Doe profile photo" />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  );
}

const meta: Meta<typeof AvatarFallbackExample> = {
  component: AvatarFallbackExample,
  title: 'Components/Avatar',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AvatarFallbackExample>;

export const FallbackOnly: Story = {};

export const WithImage: Story = {
  render: function Render() {
    return <AvatarWithImageExample />;
  },
};
