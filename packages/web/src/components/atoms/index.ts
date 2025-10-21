/**
 * Atomic Components - Design System Building Blocks
 * 
 * Export all atomic components for easy importing
 */

export { Button, type ButtonProps } from './Button';
export { Input, type InputProps } from './Input';
export { Icon, iconMap, type IconProps, type IconName } from './Icon';
export { Badge, type BadgeProps } from './Badge';
export { Label, type LabelProps } from './Label';
export { Progress, type ProgressProps } from './Progress';
export { LoadingSpinner, type LoadingSpinnerProps } from './LoadingSpinner';

// Enhanced components from v0 integration
export { 
  Select, 
  SelectGroup, 
  SelectValue, 
  SelectTrigger, 
  SelectContent, 
  SelectLabel, 
  SelectItem, 
  SelectSeparator,
  type SelectProps,
  type SelectTriggerProps,
  type SelectContentProps,
  type SelectItemProps,
  type SelectLabelProps,
  type SelectSeparatorProps 
} from './Select';

export { Separator, type SeparatorProps } from './Separator';

export { 
  Alert, 
  AlertTitle, 
  AlertDescription, 
  type AlertProps, 
  type AlertTitleProps, 
  type AlertDescriptionProps 
} from './Alert';