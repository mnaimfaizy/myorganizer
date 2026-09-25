import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Calendar } from './Calendar';

describe('Calendar', () => {
  const fixedMonth = new Date(2025, 4, 1); // May 2025

  it('renders previous and next month buttons with accessible names', () => {
    render(<Calendar month={fixedMonth} />);

    const prevButton = screen.getByRole('button', { name: /previous/i });
    const nextButton = screen.getByRole('button', { name: /next/i });

    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
    expect(prevButton.tagName).toBe('BUTTON');
    expect(nextButton.tagName).toBe('BUTTON');
  });

  it('enforces positioning invariant for react-day-picker v9 layout', () => {
    const { container } = render(<Calendar month={fixedMonth} />);

    const prevButton = screen.getByRole('button', { name: /previous/i });
    const nextButton = screen.getByRole('button', { name: /next/i });
    const nav = prevButton.closest('nav') || prevButton.parentElement;
    expect(nav).not.toBeNull();

    const months = container.querySelector('.rdp-months') || nav?.parentElement;
    expect(months).not.toBeNull();

    // nav must be a direct child of months element
    expect(nav?.parentElement).toBe(months);

    // months class must include relative
    expect(months?.className).toContain('relative');

    // nav class must contain absolute layout positioning and pointer-events-none
    expect(nav?.className).toContain('absolute');
    expect(nav?.className).toContain('top-1');
    expect(nav?.className).toContain('left-1');
    expect(nav?.className).toContain('right-1');
    expect(nav?.className).toContain('justify-between');
    expect(nav?.className).toContain('pointer-events-none');

    // prev and next buttons must have pointer-events-auto and not be independently absolute
    expect(prevButton.className).toContain('pointer-events-auto');
    expect(nextButton.className).toContain('pointer-events-auto');
    expect(prevButton.className).not.toContain('absolute');
    expect(nextButton.className).not.toContain('absolute');
  });

  it('renders v9 day grid structure with custom v9 class names', () => {
    const { container } = render(<Calendar mode="single" month={fixedMonth} />);

    const monthGrid =
      container.querySelector('table') ||
      container.querySelector('.rdp-month_grid');
    expect(monthGrid).not.toBeNull();
    expect(monthGrid?.className).toContain('w-full');
    expect(monthGrid?.className).toContain('border-collapse');

    const weekday =
      container.querySelector('th') || container.querySelector('.rdp-weekday');
    expect(weekday).not.toBeNull();
    expect(weekday?.className).toContain('w-9');

    const dayCells = container.querySelectorAll('td');
    expect(dayCells.length).toBeGreaterThan(0);
    expect(dayCells[0].className).toContain('h-9');
    expect(dayCells[0].className).toContain('w-9');

    const dayButtons = screen.getAllByRole('button', { name: /\d+/ });
    expect(dayButtons.length).toBeGreaterThan(0);
    expect(dayButtons[0].className).toContain('h-9');
    expect(dayButtons[0].className).toContain('w-9');
  });

  it('allows consumer classNames to override default classes', () => {
    const { container } = render(
      <Calendar
        month={fixedMonth}
        classNames={{
          months: 'custom-months-override',
          nav: 'custom-nav-override',
        }}
      />,
    );

    const prevButton = screen.getByRole('button', { name: /previous/i });
    const nav = prevButton.closest('nav') || prevButton.parentElement;
    expect(nav?.className).toContain('custom-nav-override');

    const months =
      container.querySelector('.custom-months-override') || nav?.parentElement;
    expect(months?.className).toContain('custom-months-override');
  });
});
