/**
 * FormField Component Unit Tests
 * 
 * Tests the FormField molecule component including label, input,
 * validation, error states, and accessibility features.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormField } from '../FormField';

describe('FormField', () => {
  describe('rendering', () => {
    it('should render with label and input', () => {
      render(
        <FormField
          id="test-field"
          label="Test Label"
          name="test"
          type="text"
        />
      );

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(
        <FormField
          id="test-field"
          label="Test Label"
          name="test"
          type="text"
          placeholder="Enter text here"
        />
      );

      expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument();
    });

    it('should render with help text', () => {
      render(
        <FormField
          id="test-field"
          label="Test Label"
          name="test"
          type="text"
          helpText="This is help text"
        />
      );

      expect(screen.getByText('This is help text')).toBeInTheDocument();
    });

    it('should render with required indicator', () => {
      render(
        <FormField
          id="test-field"
          label="Test Label"
          name="test"
          type="text"
          required
        />
      );

      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeRequired();
    });
  });

  describe('input types', () => {
    it('should render text input', () => {
      render(
        <FormField
          id="text-field"
          label="Text"
          name="text"
          type="text"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render email input', () => {
      render(
        <FormField
          id="email-field"
          label="Email"
          name="email"
          type="email"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('should render password input', () => {
      render(
        <FormField
          id="password-field"
          label="Password"
          name="password"
          type="password"
        />
      );

      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('should render textarea', () => {
      render(
        <FormField
          id="textarea-field"
          label="Description"
          name="description"
          type="textarea"
          rows={4}
        />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea).toHaveAttribute('rows', '4');
    });

    it('should render select dropdown', () => {
      const options = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' }
      ];

      render(
        <FormField
          id="select-field"
          label="Select Option"
          name="select"
          type="select"
          options={options}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument();
    });
  });

  describe('error states', () => {
    it('should display error message', () => {
      render(
        <FormField
          id="error-field"
          label="Test Field"
          name="test"
          type="text"
          error="This field is required"
        />
      );

      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveClass('input-error');
    });

    it('should have aria-invalid when error exists', () => {
      render(
        <FormField
          id="error-field"
          label="Test Field"
          name="test"
          type="text"
          error="Invalid input"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'error-field-error');
    });

    it('should not show error styling without error', () => {
      render(
        <FormField
          id="normal-field"
          label="Normal Field"
          name="normal"
          type="text"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveClass('input-error');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('validation', () => {
    it('should show validation error on blur with invalid input', async () => {
      const user = userEvent.setup();
      
      render(
        <FormField
          id="email-field"
          label="Email"
          name="email"
          type="email"
          required
          validation={{
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please enter a valid email'
          }}
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'invalid-email');
      await user.tab(); // Trigger blur

      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    });

    it('should clear validation error when input becomes valid', async () => {
      const user = userEvent.setup();
      
      render(
        <FormField
          id="email-field"
          label="Email"
          name="email"
          type="email"
          required
          validation={{
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please enter a valid email'
          }}
        />
      );

      const input = screen.getByRole('textbox');
      
      // Enter invalid email
      await user.type(input, 'invalid-email');
      await user.tab();
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();

      // Clear and enter valid email
      await user.clear(input);
      await user.type(input, 'valid@example.com');
      await user.tab();
      
      expect(screen.queryByText('Please enter a valid email')).not.toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onChange when input value changes', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();
      
      render(
        <FormField
          id="test-field"
          label="Test Field"
          name="test"
          type="text"
          onChange={handleChange}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello');

      expect(handleChange).toHaveBeenCalledTimes(5); // Once per character
      expect(input).toHaveValue('Hello');
    });

    it('should call onBlur when input loses focus', async () => {
      const handleBlur = vi.fn();
      const user = userEvent.setup();
      
      render(
        <FormField
          id="test-field"
          label="Test Field"
          name="test"
          type="text"
          onBlur={handleBlur}
        />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.tab();

      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('should call onFocus when input receives focus', async () => {
      const handleFocus = vi.fn();
      const user = userEvent.setup();
      
      render(
        <FormField
          id="test-field"
          label="Test Field"
          name="test"
          type="text"
          onFocus={handleFocus}
        />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(handleFocus).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have proper label association', () => {
      render(
        <FormField
          id="accessible-field"
          label="Accessible Field"
          name="accessible"
          type="text"
        />
      );

      const input = screen.getByRole('textbox');
      const label = screen.getByText('Accessible Field');
      
      expect(input).toHaveAttribute('id', 'accessible-field');
      expect(label).toHaveAttribute('for', 'accessible-field');
    });

    it('should have aria-describedby for help text', () => {
      render(
        <FormField
          id="help-field"
          label="Field with Help"
          name="help"
          type="text"
          helpText="This is helpful information"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'help-field-help');
    });

    it('should have aria-describedby for error message', () => {
      render(
        <FormField
          id="error-field"
          label="Field with Error"
          name="error"
          type="text"
          error="This field has an error"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'error-field-error');
    });

    it('should combine aria-describedby for both help text and error', () => {
      render(
        <FormField
          id="combined-field"
          label="Combined Field"
          name="combined"
          type="text"
          helpText="Help text"
          error="Error message"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute(
        'aria-describedby', 
        'combined-field-help combined-field-error'
      );
    });
  });

  describe('disabled state', () => {
    it('should render as disabled', () => {
      render(
        <FormField
          id="disabled-field"
          label="Disabled Field"
          name="disabled"
          type="text"
          disabled
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('input-disabled');
    });

    it('should not call event handlers when disabled', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();
      
      render(
        <FormField
          id="disabled-field"
          label="Disabled Field"
          name="disabled"
          type="text"
          disabled
          onChange={handleChange}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      expect(handleChange).not.toHaveBeenCalled();
      expect(input).toHaveValue('');
    });
  });
});