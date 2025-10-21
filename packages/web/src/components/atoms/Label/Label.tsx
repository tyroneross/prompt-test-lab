/**
 * Label Component - Atomic Design System
 * 
 * A semantic label component for form fields and UI elements.
 * Includes accessibility features and required field indicators.
 */

import React, { forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

const labelVariants = cva(
  [
    'text-sm font-medium leading-none',
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  ],
  {
    variants: {
      variant: {
        default: 'text-neutral-700',
        error: 'text-error-700',
        success: 'text-success-700',
        muted: 'text-neutral-500',
      },
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {
  /** Indicates the field is required */
  required?: boolean;
  /** Custom required indicator */
  requiredIndicator?: React.ReactNode;
  /** Hide the required indicator visually but keep for screen readers */
  hideRequiredIndicator?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  (
    {
      className,
      variant,
      size,
      required = false,
      requiredIndicator = '*',
      hideRequiredIndicator = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <label
        ref={ref}
        className={cn(labelVariants({ variant, size }), className)}
        {...props}
      >
        {children}
        {required && (
          <span
            className={cn(
              'ml-1 text-error-500',
              hideRequiredIndicator && 'sr-only'
            )}
            aria-label="required"
          >
            {hideRequiredIndicator ? ' (required)' : requiredIndicator}
          </span>
        )}
      </label>
    );
  }
);

Label.displayName = 'Label';