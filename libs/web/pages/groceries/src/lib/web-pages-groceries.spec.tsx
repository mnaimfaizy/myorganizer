import { render } from '@testing-library/react';

import WebPagesGroceries from './web-pages-groceries';

describe('WebPagesGroceries', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<WebPagesGroceries />);
    expect(baseElement).toBeTruthy();
  });
});
