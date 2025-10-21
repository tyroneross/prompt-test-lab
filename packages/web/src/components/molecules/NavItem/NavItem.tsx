/**
 * NavItem Component - Molecular Design System
 * 
 * A navigation item component for sidebars and navigation menus.
 * Supports active states, icons, badges, and accessibility features.
 */

import React, { forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

const navItemVariants = cva(
  [
    'flex items-center gap-3 rounded-md px-3 py-2',
    'text-sm font-medium transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: [
          'text-neutral-700 hover:text-neutral-900',
          'hover:bg-neutral-100',
        ],
        primary: [
          'text-primary-700 hover:text-primary-900',
          'hover:bg-primary-50',
        ],
        ghost: [
          'text-neutral-600 hover:text-neutral-900',
          'hover:bg-neutral-50',
        ],
      },
      active: {
        true: 'bg-primary-100 text-primary-900 font-semibold',
        false: '',
      },
      size: {
        sm: 'px-2 py-1.5 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      active: false,
      size: 'md',
    },
  }
);

interface BaseNavItemProps extends VariantProps<typeof navItemVariants> {
  /** Icon to display before text */
  icon?: React.ReactNode;
  /** Badge or count to display after text */
  badge?: React.ReactNode;
  /** Whether this item is currently active */
  active?: boolean;
}

interface LinkNavItemProps extends BaseNavItemProps, Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'> {
  /** External link href (renders as anchor) */
  href: string;
  /** Click handler */
  onClick?: never;
}

interface ButtonNavItemProps extends BaseNavItemProps, React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** External link href (renders as anchor) */
  href?: never;
  /** Click handler */
  onClick?: () => void;
}

export type NavItemProps = LinkNavItemProps | ButtonNavItemProps;

export const NavItem = forwardRef<HTMLButtonElement | HTMLAnchorElement, NavItemProps>(
  (
    {
      className,
      variant,
      active,
      size,
      children,
      icon,
      badge,
      href,
      onClick,
      ...props
    },
    ref
  ) => {
    if (href) {
      // Render as anchor for links
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={cn(navItemVariants({ variant, active, size }), className)}
          href={href}
          role="link"
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {/* Icon */}
          {icon && (
            <span className="flex-shrink-0" aria-hidden="true">
              {icon}
            </span>
          )}

          {/* Text */}
          <span className="flex-1 truncate">
            {children}
          </span>

          {/* Badge */}
          {badge && (
            <span className="flex-shrink-0 ml-auto">
              {badge}
            </span>
          )}
        </a>
      );
    }

    // Render as button for actions
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={cn(navItemVariants({ variant, active, size }), className)}
        type="button"
        onClick={onClick}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {/* Icon */}
        {icon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Text content */}
        <span className="flex-1 text-left truncate">
          {children}
        </span>

        {/* Badge */}
        {badge && (
          <span className="flex-shrink-0">
            {badge}
          </span>
        )}
      </button>
    );
  }
);

NavItem.displayName = 'NavItem';