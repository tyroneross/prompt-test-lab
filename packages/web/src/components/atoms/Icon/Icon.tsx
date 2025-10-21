/**
 * Icon Component - Atomic Design System
 * 
 * A centralized icon component using Lucide React icons.
 * Provides consistent sizing and accessibility features.
 */

import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

// Import commonly used icons from Lucide React
import {
  Play,
  Pause,
  Square,
  Plus,
  Minus,
  Edit,
  Trash2,
  Download,
  Upload,
  Search,
  Filter,
  Settings,
  User,
  Users,
  Mail,
  Phone,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Home,
  FileText,
  Folder,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Star,
  Heart,
  Bookmark,
  Share,
  MoreHorizontal,
  MoreVertical,
  Menu,
  Grid,
  List,
  Calendar,
  Clock,
  MapPin,
  Globe,
  Zap,
  Cpu,
  Database,
  Server,
  Code,
  Terminal,
  Bug,
  GitBranch,
  Github,
  Twitter,
  Linkedin,
  type LucideIcon,
} from 'lucide-react';

// Icon mapping for easy access
export const iconMap = {
  // Actions
  play: Play,
  pause: Pause,
  stop: Square,
  plus: Plus,
  minus: Minus,
  edit: Edit,
  delete: Trash2,
  download: Download,
  upload: Upload,
  search: Search,
  filter: Filter,
  settings: Settings,
  copy: Copy,
  check: Check,
  close: X,
  
  // Navigation
  home: Home,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'external-link': ExternalLink,
  
  // User & Auth
  user: User,
  users: Users,
  mail: Mail,
  phone: Phone,
  lock: Lock,
  unlock: Unlock,
  eye: Eye,
  'eye-off': EyeOff,
  
  // Content
  'file-text': FileText,
  folder: Folder,
  
  // Status & Feedback
  info: Info,
  'alert-circle': AlertCircle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'help-circle': HelpCircle,
  
  // Interactive
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  share: Share,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  menu: Menu,
  
  // Layout
  grid: Grid,
  list: List,
  
  // Time & Location
  calendar: Calendar,
  clock: Clock,
  'map-pin': MapPin,
  globe: Globe,
  
  // Tech
  zap: Zap,
  cpu: Cpu,
  database: Database,
  server: Server,
  code: Code,
  terminal: Terminal,
  bug: Bug,
  'git-branch': GitBranch,
  
  // Social
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
} as const;

export type IconName = keyof typeof iconMap;

const iconVariants = cva('flex-shrink-0', {
  variants: {
    size: {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-8 w-8',
      '2xl': 'h-10 w-10',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface IconProps
  extends React.SVGAttributes<SVGElement>,
    VariantProps<typeof iconVariants> {
  /** Name of the icon to display */
  name: IconName;
  /** Custom icon component (overrides name) */
  icon?: LucideIcon;
  /** Accessible label for screen readers */
  label?: string;
  /** Whether the icon is decorative (hides from screen readers) */
  decorative?: boolean;
}

export const Icon: React.FC<IconProps> = ({
  name,
  icon: CustomIcon,
  size,
  label,
  decorative = false,
  className,
  ...props
}) => {
  const IconComponent = CustomIcon || iconMap[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in icon map`);
    return null;
  }

  const accessibilityProps = decorative
    ? { 'aria-hidden': true }
    : { 'aria-label': label || name, role: 'img' };

  return (
    <IconComponent
      className={cn(iconVariants({ size }), className)}
      {...accessibilityProps}
      {...props}
    />
  );
};

Icon.displayName = 'Icon';