/**
 * Button Component Unit Tests
 * 
 * Tests the Button atom component including variants, sizes, states,
 * accessibility, and user interactions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<Button>Click me</Button>);
      
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('btn', 'btn-primary', 'btn-medium');
    });

    it('should render with custom text', () => {
      render(<Button>Custom Text</Button>);
      
      const button = screen.getByRole('button', { name: /custom text/i });
      expect(button).toBeInTheDocument();
    });

    it('should render as disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled Button</Button>);
      
      const button = screen.getByRole('button', { name: /disabled button/i });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('btn-disabled');
    });

    it('should render with loading state', () => {
      render(<Button loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('btn-loading');
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('should render primary variant', () => {
      render(<Button variant="primary">Primary</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-primary');
    });

    it('should render secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-secondary');
    });

    it('should render danger variant', () => {
      render(<Button variant="destructive">Danger</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-danger');
    });

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-ghost');
    });
  });

  describe('sizes', () => {
    it('should render small size', () => {
      render(<Button size="sm">Small</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-small');
    });

    it('should render medium size (default)', () => {
      render(<Button size="md">Medium</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-medium');
    });

    it('should render large size', () => {
      render(<Button size="lg">Large</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-large');
    });
  });

  describe('interactions', () => {
    it('should call onClick when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button onClick={handleClick}>Clickable</Button>);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button onClick={handleClick} disabled>Disabled</Button>);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not call onClick when loading', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button onClick={handleClick} loading>Loading</Button>);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should handle keyboard navigation', () => {
      const handleClick = vi.fn();
      
      render(<Button onClick={handleClick}>Keyboard</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
      
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      fireEvent.keyDown(button, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(<Button aria-label="Custom label">Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom label');
    });

    it('should have aria-disabled when disabled', () => {
      render(<Button disabled>Disabled</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('should have aria-busy when loading', () => {
      render(<Button loading>Loading</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('should support custom ARIA attributes', () => {
      render(
        <Button 
          aria-describedby="description"
          aria-expanded={false}
        >
          Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'description');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      render(<Button className="custom-class">Styled</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should merge custom styles with default classes', () => {
      render(
        <Button 
          className="custom-class" 
          variant="secondary" 
          size="lg"
        >
          Styled
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-secondary', 'btn-large', 'custom-class');
    });

    it('should apply custom inline styles', () => {
      render(
        <Button style={{ backgroundColor: 'red', color: 'white' }}>
          Styled
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: 'red',
        color: 'white'
      });
    });
  });

  describe('icon support', () => {
    it('should render with left icon', () => {
      const LeftIcon = () => <span data-testid="left-icon">→</span>;
      
      render(
        <Button leftIcon={<LeftIcon />}>
          With Left Icon
        </Button>
      );
      
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByText('With Left Icon')).toBeInTheDocument();
    });

    it('should render with right icon', () => {
      const RightIcon = () => <span data-testid="right-icon">←</span>;
      
      render(
        <Button rightIcon={<RightIcon />}>
          With Right Icon
        </Button>
      );
      
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
      expect(screen.getByText('With Right Icon')).toBeInTheDocument();
    });

    it('should render with both icons', () => {
      const LeftIcon = () => <span data-testid="left-icon">→</span>;
      const RightIcon = () => <span data-testid="right-icon">←</span>;
      
      render(
        <Button 
          leftIcon={<LeftIcon />} 
          rightIcon={<RightIcon />}
        >
          With Both Icons
        </Button>
      );
      
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
      expect(screen.getByText('With Both Icons')).toBeInTheDocument();
    });

    it('should render icon-only button', () => {
      const Icon = () => <span data-testid="icon">⚙</span>;
      
      render(
        <Button 
          leftIcon={<Icon />}
          aria-label="Settings"
        />
      );
      
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    });
  });

  describe('form integration', () => {
    it('should support type="submit"', () => {
      render(<Button type="submit">Submit</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should support type="reset"', () => {
      render(<Button type="reset">Reset</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'reset');
    });

    it('should default to type="button"', () => {
      render(<Button>Default</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });
});