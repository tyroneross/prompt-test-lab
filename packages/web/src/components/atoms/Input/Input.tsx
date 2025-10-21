/**
 * Input Component - Atomic Design System
 * 
 * A flexible input component with multiple types, sizes, and states.
 * Includes accessibility features and validation support.
 */

import React, { forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

const inputVariants = cva(
  [
    'flex w-full rounded-md border bg-white px-3 py-2',
    'text-sm text-neutral-900 placeholder:text-neutral-400',
    'ring-offset-background transition-colors',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'disabled:bg-neutral-50',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-neutral-300',
          'hover:border-neutral-400',
          'focus:border-primary-600',
        ],
        error: [
          'border-error-500 bg-error-50',
          'focus:border-error-600 focus:ring-error-600',
        ],
        success: [
          'border-success-500 bg-success-50',
          'focus:border-success-600 focus:ring-success-600',
        ],
      },
      size: {
        sm: 'h-8 text-xs',
        md: 'h-10 text-sm',
        lg: 'h-12 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Icon to display on the left side */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side */
  rightIcon?: React.ReactNode;
  /** Makes the input full width */
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      type = 'text',
      leftIcon,
      rightIcon,
      fullWidth = true,
      ...props
    },
    ref
  ) => {
    const hasIcons = leftIcon || rightIcon;

    if (hasIcons) {
      return (
        <div className={cn('relative', fullWidth && 'w-full')}>
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {leftIcon}
            </div>
          )}
          
          <input
            type={type}
            className={cn(
              inputVariants({ variant, size }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              fullWidth && 'w-full',
              className
            )}
            ref={ref}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {rightIcon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          inputVariants({ variant, size }),
          fullWidth && 'w-full',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';