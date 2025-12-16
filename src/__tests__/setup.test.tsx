import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Simple component for smoke test
const TestComponent = () => <div>Hello Test World</div>;

describe('Vitest Setup', () => {
  it('should pass basic assertion', () => {
    expect(true).toBe(true);
  });

  it('should render a component', () => {
    render(<TestComponent />);
    expect(screen.getByText('Hello Test World')).toBeInTheDocument();
  });
});
