// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';

expect.extend(matchers);

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
