/**
 * FormField Component - Molecular Design System
 * 
 * A complete form field combining label, input, help text, and error message.
 * Provides proper accessibility and semantic structure.
 */

import React, { forwardRef } from 'react';
import { cn, generateId, getFieldAriaProps } from '@/utils';
import { Label } from '@/components/atoms';

export interface FormFieldProps {
  /** Field label */
  label: string;
  /** Field name/id */
  name: string;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Help text to display below the field */
  helpText?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** The input component to render */
  children: React.ReactElement;
}

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      label,
      name,
      required = false,
      error,
      helpText,
      disabled = false,
      className,
      children,
    },
    ref
  ) => {
    const fieldId = generateId(name);
    const errorId = `${fieldId}-error`;
    const helpId = `${fieldId}-help`;

    // Get ARIA props for the input
    const ariaProps = getFieldAriaProps(fieldId, error, helpText, required);

    // Clone the child element and add necessary props
    const inputElement = React.cloneElement(children, {
      ...ariaProps,
      disabled,
      variant: error ? 'error' : children.props.variant,
    });

    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        {/* Label */}
        <Label
          htmlFor={fieldId}
          required={required}
          variant={error ? 'error' : 'default'}
        >
          {label}
        </Label>

        {/* Input */}
        {inputElement}

        {/* Help text and error message */}
        <div className="space-y-1">
          {helpText && !error && (
            <p
              id={helpId}
              className="text-sm text-neutral-600"
            >
              {helpText}
            </p>
          )}
          
          {error && (
            <p
              id={errorId}
              className="text-sm text-error-600"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }
);

FormField.displayName = 'FormField';