/**
 * Badge Component - Atomic Design System
 * 
 * A small status indicator or label component with semantic color variants.
 * Supports different sizes and interactive states.
 */

import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

const badgeVariants = cva(
  [
    'inline-flex items-center justify-center gap-1',
    'rounded-full px-2.5 py-0.5',
    'text-xs font-medium',
    'ring-1 ring-inset',
    'transition-colors',
  ],
  {
    variants: {
      variant: {
        neutral: [
          'bg-neutral-50 text-neutral-700 ring-neutral-200',
        ],
        primary: [
          'bg-primary-50 text-primary-700 ring-primary-200',
        ],
        success: [
          'bg-success-50 text-success-700 ring-success-200',
        ],
        warning: [
          'bg-warning-50 text-warning-700 ring-warning-200',
        ],
        error: [
          'bg-error-50 text-error-700 ring-error-200',
        ],
        info: [
          'bg-info-50 text-info-700 ring-info-200',
        ],
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
      interactive: {
        true: 'cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
      interactive: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Icon to display before text */
  leftIcon?: React.ReactNode;
  /** Icon to display after text */
  rightIcon?: React.ReactNode;
  /** Makes the badge clickable */
  onClick?: () => void;
  /** Badge content */
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant,
  size,
  interactive,
  leftIcon,
  rightIcon,
  onClick,
  children,
  ...props
}) => {
  const isInteractive = interactive || !!onClick;
  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      className={cn(badgeVariants({ variant, size, interactive: isInteractive }), className)}
      onClick={onClick}
      {...props}
    >
      {leftIcon && (
        <span className="flex-shrink-0" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      
      <span>{children}</span>
      
      {rightIcon && (
        <span className="flex-shrink-0" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </Component>
  );
};

Badge.displayName = 'Badge';