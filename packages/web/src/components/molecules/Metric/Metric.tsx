/**
 * Metric Component - Molecular Design System
 * 
 * Displays a key metric with optional change indicator and trend visualization.
 * Perfect for dashboard analytics and status displays.
 */

import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';
import { Icon } from '@/components/atoms';

const metricVariants = cva(
  'rounded-lg border bg-white p-6',
  {
    variants: {
      variant: {
        default: 'border-neutral-200',
        success: 'border-success-200 bg-success-50',
        warning: 'border-warning-200 bg-warning-50',
        error: 'border-error-200 bg-error-50',
        info: 'border-info-200 bg-info-50',
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface MetricProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof metricVariants> {
  /** Metric label */
  label: string;
  /** Metric value */
  value: string | number;
  /** Unit or suffix for the value */
  unit?: string;
  /** Change information */
  change?: {
    value: number;
    direction: 'up' | 'down';
    positive: boolean;
    timeframe?: string;
  };
  /** Icon to display */
  icon?: React.ReactNode;
  /** Trend data for sparkline (array of numbers) */
  trend?: number[];
  /** Additional description */
  description?: string;
  /** Loading state */
  loading?: boolean;
}

export const Metric: React.FC<MetricProps> = ({
  className,
  variant,
  size,
  label,
  value,
  unit,
  change,
  icon,
  trend,
  description,
  loading = false,
  ...props
}) => {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      // Format large numbers with K, M suffixes
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toLocaleString();
    }
    return val;
  };

  const getChangeIcon = () => {
    if (!change) return null;
    return change.direction === 'up' ? 'arrow-up' : 'arrow-down';
  };

  const getChangeColor = () => {
    if (!change) return '';
    if (change.positive) {
      return change.direction === 'up' ? 'text-success-600' : 'text-error-600';
    } else {
      return change.direction === 'up' ? 'text-error-600' : 'text-success-600';
    }
  };

  if (loading) {
    return (
      <div className={cn(metricVariants({ variant, size }), className)} {...props}>
        <div className="animate-pulse">
          <div className="h-4 bg-neutral-200 rounded w-1/3 mb-2"></div>
          <div className="h-8 bg-neutral-200 rounded w-2/3 mb-1"></div>
          <div className="h-3 bg-neutral-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(metricVariants({ variant, size }), className)} {...props}>
      {/* Header with label and icon */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-neutral-600">{label}</p>
        {icon && (
          <div className="text-neutral-400">
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2 mb-1">
        <p className="text-2xl font-bold text-neutral-900">
          {formatValue(value)}
          {unit && <span className="text-lg font-normal text-neutral-600">{unit}</span>}
        </p>

        {/* Change indicator */}
        {change && (
          <div className={cn('flex items-center gap-1 text-sm font-medium', getChangeColor())}>
            <Icon name={getChangeIcon()!} size="xs" decorative />
            <span>{Math.abs(change.value)}%</span>
          </div>
        )}
      </div>

      {/* Description or change timeframe */}
      {(description || change?.timeframe) && (
        <p className="text-xs text-neutral-500">
          {description || (change?.timeframe && `vs ${change.timeframe}`)}
        </p>
      )}

      {/* Trend sparkline (simplified) */}
      {trend && trend.length > 0 && (
        <div className="mt-4 h-8 flex items-end justify-between">
          {trend.map((point, index) => {
            const maxValue = Math.max(...trend);
            const height = (point / maxValue) * 100;
            return (
              <div
                key={index}
                className="bg-primary-200 w-1 rounded-t"
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

Metric.displayName = 'Metric';