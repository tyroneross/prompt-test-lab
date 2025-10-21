/**
 * EmptyState Component - Guiding Empty States
 * 
 * Provides clear guidance and actionable next steps when
 * users encounter empty sections or pages in the application.
 */

import React from 'react';
import { Button, Icon } from '@/components/atoms';
import { Card } from '@/components/molecules';
import { cn } from '@/utils';

export interface EmptyStateProps {
  /** The main icon to display */
  icon: React.ReactNode;
  /** Primary heading text */
  title: string;
  /** Descriptive text explaining the empty state */
  description: string;
  /** Primary action button */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Additional help or tips */
  helpText?: string;
  /** Visual variant */
  variant?: 'default' | 'onboarding' | 'error';
  /** Custom className */
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  helpText,
  variant = 'default',
  className
}) => {
  const variantStyles = {
    default: {
      container: 'border-neutral-200',
      icon: 'text-neutral-400',
      iconBg: 'bg-neutral-100',
    },
    onboarding: {
      container: 'border-2 border-dashed border-primary-300 bg-primary-50/50',
      icon: 'text-primary-600',
      iconBg: 'bg-primary-100',
    },
    error: {
      container: 'border-error-200 bg-error-50/50',
      icon: 'text-error-600',
      iconBg: 'bg-error-100',
    }
  };

  const styles = variantStyles[variant];

  return (
    <Card className={cn(
      'text-center py-12 px-8',
      styles.container,
      className
    )}>
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6',
        styles.iconBg
      )}>
        <div className={styles.icon}>
          {icon}
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-neutral-900 mb-3">
        {title}
      </h3>
      
      <p className="text-neutral-600 mb-6 max-w-md mx-auto leading-relaxed">
        {description}
      </p>

      {(primaryAction || secondaryAction) && (
        <div className="flex items-center justify-center gap-3 mb-4">
          {primaryAction && (
            <Button
              variant="primary"
              onClick={primaryAction.onClick}
              leftIcon={primaryAction.icon}
            >
              {primaryAction.label}
            </Button>
          )}
          
          {secondaryAction && (
            <Button
              variant="ghost"
              onClick={secondaryAction.onClick}
              leftIcon={secondaryAction.icon}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}

      {helpText && (
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-500 max-w-sm mx-auto">
            <Icon name="info" size="sm" className="inline mr-2 text-neutral-400" />
            {helpText}
          </p>
        </div>
      )}
    </Card>
  );
};

EmptyState.displayName = 'EmptyState';