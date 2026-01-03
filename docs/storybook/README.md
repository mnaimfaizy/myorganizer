# Storybook and Chromatic Setup

This project uses [Storybook](https://storybook.js.org/) for developing and showcasing UI components in isolation, and [Chromatic](https://www.chromatic.com/) for visual testing and review.

## Local Development

### Running Storybook

To start the Storybook development server:

```bash
yarn storybook
```

This will start Storybook on `http://localhost:4400` (default port may vary).

Alternatively, you can use the Nx command directly:

```bash
npx nx storybook web-ui
```

### Building Storybook

To build a static version of Storybook:

```bash
yarn build-storybook
```

The static files will be generated in `libs/web-ui/storybook-static/`.

## Writing Stories

Stories are located alongside components in the `libs/web-ui/src/lib/components/` directory.

### Example Story Structure

Create a file with the `.stories.tsx` extension next to your component:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { YourComponent } from './YourComponent';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  title: 'Components/YourComponent',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof YourComponent>;

export const Default: Story = {
  args: {
    // component props
  },
};
```

See `libs/web-ui/src/lib/components/Button/Button.stories.tsx` for a complete example.

## Chromatic Integration

Chromatic is configured for visual regression testing. Currently, the setup is local-only and does not sync with Chromatic's cloud service.

### Running Chromatic Locally

To run Chromatic in local mode (no cloud upload):

```bash
yarn chromatic
```

**Note:** To connect to Chromatic's cloud service in the future, you'll need to:

1. Create a project at [chromatic.com](https://www.chromatic.com/)
2. Get your project token
3. Update the `chromatic` script in `package.json` with your token:
   ```json
   "chromatic": "npx chromatic --project-token=YOUR_PROJECT_TOKEN"
   ```

## Project Structure

```
libs/web-ui/
├── .storybook/
│   ├── main.ts              # Storybook configuration
│   ├── preview.ts           # Global decorators and parameters
│   └── preview-styles.css   # Global styles (Tailwind CSS)
├── src/
│   └── lib/
│       └── components/
│           └── Button/
│               ├── Button.tsx
│               └── Button.stories.tsx
├── tailwind.config.js       # Tailwind configuration
└── postcss.config.js        # PostCSS configuration
```

## Available Storybook Addons

The following addons are pre-configured:

- **@storybook/addon-essentials**: Essential addons including:

  - Controls: Dynamic component prop editing
  - Actions: UI feedback for component events
  - Docs: Auto-generated documentation
  - Viewport: Responsive design testing
  - Backgrounds: Background color testing
  - Toolbars: Custom toolbar buttons
  - Measure & Outline: Layout debugging

- **@storybook/addon-interactions**: Testing user interactions

## Next Steps

1. Add stories for more components in `libs/web-ui/src/lib/components/`
2. Configure Chromatic cloud integration (optional)
3. Set up CI/CD integration for automated visual testing

## Useful Commands

| Command                          | Description                |
| -------------------------------- | -------------------------- |
| `yarn storybook`                 | Start Storybook dev server |
| `yarn build-storybook`           | Build static Storybook     |
| `npx nx test-storybook web-ui`   | Run interaction tests      |
| `npx nx static-storybook web-ui` | Serve built Storybook      |

## Troubleshooting

### Styles not loading

Make sure Tailwind CSS is configured properly:

- Check `libs/web-ui/tailwind.config.js` includes Storybook paths
- Verify `libs/web-ui/.storybook/preview-styles.css` is imported in `preview.ts`

### Component not rendering

- Ensure the component is exported from `libs/web-ui/src/index.ts`
- Check that the story file follows the `*.stories.tsx` naming convention
- Verify the story file is in the `libs/web-ui/src/lib/` directory

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Chromatic Documentation](https://www.chromatic.com/docs/)
- [Nx Storybook Plugin](https://nx.dev/recipes/storybook)
