/**
 * Progress Component - Atomic Design System
 * 
 * A progress indicator component showing completion status.
 * Supports different variants and accessibility features.
 */

import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

const progressVariants = cva(
  'relative overflow-hidden rounded-full bg-neutral-200',
  {
    variants: {
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
        xl: 'h-4',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const progressBarVariants = cva(
  [
    'h-full transition-all duration-300 ease-out',
    'rounded-full relative overflow-hidden',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary-600',
        success: 'bg-success-600',
        warning: 'bg-warning-600',
        error: 'bg-error-600',
        info: 'bg-info-600',
      },
      animated: {
        true: 'animate-pulse-soft',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      animated: false,
    },
  }
);

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof progressBarVariants> {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value (defaults to 100) */
  max?: number;
  /** Accessible label for screen readers */
  label?: string;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Show value/max text */
  showValue?: boolean;
  /** Custom text to display */
  text?: string;
  /** Indeterminate loading state */
  indeterminate?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
  className,
  size,
  variant,
  animated,
  value,
  max = 100,
  label,
  showPercentage = false,
  showValue = false,
  text,
  indeterminate = false,
  ...props
}) => {
  // Normalize value to percentage
  const normalizedValue = Math.min(Math.max(value, 0), max);
  const percentage = (normalizedValue / max) * 100;

  // Format display text
  const displayText = text || 
    (showPercentage ? `${Math.round(percentage)}%` : '') ||
    (showValue ? `${normalizedValue}/${max}` : '');

  return (
    <div className="w-full space-y-1">
      {/* Label and text */}
      {(label || displayText) && (
        <div className="flex justify-between items-center text-sm">
          {label && (
            <span className="text-neutral-700 font-medium">{label}</span>
          )}
          {displayText && (
            <span className="text-neutral-600">{displayText}</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div
        className={cn(progressVariants({ size }), className)}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : normalizedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        {...props}
      >
        {indeterminate ? (
          // Indeterminate progress
          <div className="h-full bg-primary-600 rounded-full animate-pulse" />
        ) : (
          // Determinate progress
          <div
            className={cn(progressBarVariants({ variant, animated }))}
            style={{
              width: `${percentage}%`,
              transition: 'width 300ms ease-out',
            }}
          >
            {/* Optional shimmer effect for animated variant */}
            {animated && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

Progress.displayName = 'Progress';