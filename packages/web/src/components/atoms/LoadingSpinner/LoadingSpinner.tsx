/**
 * LoadingSpinner Component - Atomic Design System
 * 
 * A simple loading spinner with accessibility features.
 */

import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

const spinnerVariants = cva(
  'animate-spin rounded-full border-2 border-current border-t-transparent',
  {
    variants: {
      size: {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
      },
      variant: {
        default: 'text-primary-600',
        neutral: 'text-neutral-600',
        white: 'text-white',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  }
);

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  /** Accessible label for screen readers */
  label?: string;
  /** Whether to center the spinner */
  centered?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  className,
  size,
  variant,
  label = 'Loading...',
  centered = false,
  ...props
}) => {
  const Wrapper = centered ? 'div' : React.Fragment;
  const wrapperProps = centered
    ? { className: 'flex items-center justify-center p-8' }
    : {};

  return (
    <Wrapper {...wrapperProps}>
      <div
        className={cn(spinnerVariants({ size, variant }), className)}
        role="status"
        aria-label={label}
        {...props}
      >
        <span className="sr-only">{label}</span>
      </div>
    </Wrapper>
  );
};

LoadingSpinner.displayName = 'LoadingSpinner';