/**
 * Card Component - Molecular Design System
 * 
 * A flexible card container with optional header, content, and footer sections.
 * Supports different variants and interactive states.
 */

import React, { forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

const cardVariants = cva(
  [
    'rounded-lg border bg-white text-neutral-900',
    'transition-all duration-200',
  ],
  {
    variants: {
      variant: {
        default: 'border-neutral-200 shadow-sm',
        elevated: 'border-neutral-200 shadow-md',
        outlined: 'border-neutral-300 shadow-none',
        filled: 'border-neutral-100 bg-neutral-50',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
      interactive: {
        true: 'cursor-pointer hover:shadow-md hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
      interactive: false,
    },
  }
);

interface BaseCardProps extends VariantProps<typeof cardVariants> {
  /** Card title */
  title?: string;
  /** Card subtitle */
  subtitle?: string;
  /** Actions to display in the header */
  actions?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Content of the card */
  children?: React.ReactNode;
  /** Custom className */
  className?: string;
}

interface ClickableCardProps extends BaseCardProps {
  /** Makes the card clickable */
  onClick: () => void;
}

interface NonClickableCardProps extends BaseCardProps, React.HTMLAttributes<HTMLDivElement> {
  /** Makes the card clickable */
  onClick?: never;
}

export type CardProps = ClickableCardProps | NonClickableCardProps;

export const Card = forwardRef<HTMLDivElement | HTMLButtonElement, CardProps>(
  (
    {
      className,
      variant,
      padding,
      interactive,
      title,
      subtitle,
      actions,
      footer,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    const isInteractive = interactive || !!onClick;
    const hasHeader = title || subtitle || actions;

    if (onClick) {
      // Render as button for clickable cards
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          className={cn(cardVariants({ variant, padding, interactive: isInteractive }), className)}
          onClick={onClick}
          type="button"
        >
          {/* Header */}
          {hasHeader && (
            <div className={cn(
              'flex items-start justify-between',
              padding !== 'none' && 'mb-4',
              padding === 'none' && 'p-6 pb-0'
            )}>
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="text-lg font-semibold text-neutral-900 truncate">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-sm text-neutral-600 mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
              {actions && (
                <div className="flex items-center space-x-2 ml-4">
                  {actions}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          {children && (
            <div className={cn(
              'text-left',
              padding === 'none' && hasHeader && 'px-6',
              padding === 'none' && !hasHeader && 'p-6',
              padding === 'none' && footer && 'pb-0'
            )}>
              {children}
            </div>
          )}

          {/* Footer */}
          {footer && (
            <div className={cn(
              'mt-4 pt-4 border-t border-neutral-200',
              padding === 'none' && 'mx-6 mb-6'
            )}>
              {footer}
            </div>
          )}
        </button>
      );
    }

    // Render as div for non-clickable cards
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(cardVariants({ variant, padding, interactive: isInteractive }), className)}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {/* Header */}
        {hasHeader && (
          <div className={cn(
            'flex items-start justify-between',
            padding !== 'none' && 'mb-4',
            padding === 'none' && 'p-6 pb-0'
          )}>
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-lg font-semibold text-neutral-900 truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-neutral-600 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex-shrink-0 ml-4">
                {actions}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {children && (
          <div className={cn(
            padding === 'none' && hasHeader && 'px-6',
            padding === 'none' && !hasHeader && 'p-6',
            padding === 'none' && footer && 'pb-0'
          )}>
            {children}
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className={cn(
            'border-t border-neutral-200 mt-4 pt-4',
            padding === 'none' && 'mx-6 mb-6'
          )}>
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';