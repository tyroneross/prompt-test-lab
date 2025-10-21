/**
 * Alert Component - Atomic Design System
 * 
 * Used for displaying important messages, warnings, and notifications.
 * Based on the Alert pattern from the v0 folder.
 */

import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../../utils/cn';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-gray-950 dark:[&>svg]:text-gray-50',
  {
    variants: {
      variant: {
        default: 'bg-white text-gray-950 border-gray-200 dark:bg-gray-950 dark:text-gray-50 dark:border-gray-800',
        destructive:
          'border-red-500/50 text-red-900 dark:border-red-500/50 dark:text-red-50 [&>svg]:text-red-900 dark:[&>svg]:text-red-50 bg-red-50 dark:bg-red-900/20',
        warning:
          'border-yellow-500/50 text-yellow-900 dark:border-yellow-500/50 dark:text-yellow-50 [&>svg]:text-yellow-900 dark:[&>svg]:text-yellow-50 bg-yellow-50 dark:bg-yellow-900/20',
        success:
          'border-green-500/50 text-green-900 dark:border-green-500/50 dark:text-green-50 [&>svg]:text-green-900 dark:[&>svg]:text-green-50 bg-green-50 dark:bg-green-900/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  className?: string;
}

interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
}

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, AlertTitleProps>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-sm [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
export type { AlertProps, AlertTitleProps, AlertDescriptionProps };