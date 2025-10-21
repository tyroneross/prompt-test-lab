# Component Hierarchy & Design System

## Component Architecture

### Atomic Design Structure

Following Brad Frost's Atomic Design methodology, organized by complexity and reusability:

```
Design System
├── Tokens (Design foundations)
├── Atoms (Basic building blocks)
├── Molecules (Simple combinations)
├── Organisms (Complex UI sections)
├── Templates (Page-level layouts)
└── Pages (Specific implementations)
```

## Design Tokens

### Color System
```typescript
export const colors = {
  // Primary Scale
  primary: {
    50: '#f0f9ff',   // Light backgrounds, hover states
    100: '#e0f2fe',  // Subtle backgrounds
    500: '#3b82f6',  // Primary actions, links
    600: '#2563eb',  // Primary hover
    700: '#1d4ed8',  // Primary active
    900: '#1e3a8a',  // High contrast text
  },
  
  // Neutral Scale (Primary UI colors)
  neutral: {
    50: '#fafafa',   // Page backgrounds
    100: '#f5f5f5',  // Card backgrounds
    200: '#e5e5e5',  // Subtle borders
    300: '#d4d4d8',  // Default borders
    400: '#a1a1aa',  // Placeholder text
    500: '#71717a',  // Secondary text
    600: '#525252',  // Primary text (light bg)
    700: '#404040',  // Emphasized text
    800: '#262626',  // High contrast text
    900: '#171717',  // Headings, primary text
  },

  // Semantic Colors
  semantic: {
    success: {
      50: '#f0fdf4',
      500: '#10b981',
      700: '#047857',
    },
    warning: {
      50: '#fffbeb',
      500: '#f59e0b',
      700: '#b45309',
    },
    error: {
      50: '#fef2f2',
      500: '#ef4444',
      700: '#c53030',
    },
    info: {
      50: '#eff6ff',
      500: '#3b82f6',
      700: '#1d4ed8',
    }
  }
} as const;
```

### Typography Scale
```typescript
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'monospace'],
  },
  
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  }
} as const;
```

### Spacing Scale
```typescript
export const spacing = {
  0: '0px',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
} as const;
```

### Border Radius
```typescript
export const borderRadius = {
  none: '0px',
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  full: '9999px',
} as const;
```

## Atoms

### Button Component
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}

// Usage examples:
<Button variant="primary" size="md">Run Test</Button>
<Button variant="secondary" icon={<PlayIcon />}>Continue</Button>
<Button variant="ghost" size="sm">Cancel</Button>
```

**Visual Specifications**:
```css
/* Primary Button */
.btn-primary {
  background: var(--primary-500);
  color: white;
  border: 1px solid var(--primary-500);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: all 150ms ease;
}

.btn-primary:hover {
  background: var(--primary-600);
  border-color: var(--primary-600);
}

.btn-primary:focus {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
}

/* Secondary Button */
.btn-secondary {
  background: white;
  color: var(--neutral-700);
  border: 1px solid var(--neutral-300);
}

.btn-secondary:hover {
  background: var(--neutral-50);
  border-color: var(--neutral-400);
}
```

### Input Component
```typescript
interface InputProps {
  type: 'text' | 'email' | 'password' | 'search';
  size: 'sm' | 'md' | 'lg';
  state: 'default' | 'error' | 'success';
  placeholder?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
}
```

### Icon Component
```typescript
interface IconProps {
  name: keyof typeof iconMap;
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

// Icon library: Lucide React for consistency
const iconMap = {
  play: PlayIcon,
  pause: PauseIcon,
  stop: StopSquareIcon,
  edit: EditIcon,
  delete: TrashIcon,
  // ... etc
};
```

### Badge Component
```typescript
interface BadgeProps {
  variant: 'neutral' | 'success' | 'warning' | 'error' | 'info';
  size: 'sm' | 'md';
  children: ReactNode;
}

// Examples:
<Badge variant="success">Completed</Badge>
<Badge variant="warning">Running</Badge>
<Badge variant="error">Failed</Badge>
```

## Molecules

### Form Field
```typescript
interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: ReactNode; // Input, Select, Textarea, etc.
}

// Combines: Label + Input + Error Message + Help Text
<FormField 
  label="Prompt Name" 
  required 
  error="Name is required"
  helpText="Choose a descriptive name for your prompt"
>
  <Input placeholder="Enter prompt name..." />
</FormField>
```

### Card Component
```typescript
interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

<Card 
  title="Test Results" 
  actions={<Button variant="ghost">Export</Button>}
>
  <ResultsTable data={results} />
</Card>
```

### Navigation Item
```typescript
interface NavItemProps {
  href?: string;
  active?: boolean;
  icon?: ReactNode;
  badge?: string | number;
  children: ReactNode;
  onClick?: () => void;
}
```

### Progress Indicator
```typescript
interface ProgressProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
}

<Progress 
  value={75} 
  label="Test Progress" 
  showPercentage 
  variant="default" 
/>
```

### Metric Display
```typescript
interface MetricProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    direction: 'up' | 'down';
    positive: boolean;
  };
  trend?: number[]; // For sparkline
  size?: 'sm' | 'md' | 'lg';
}

<Metric 
  label="Success Rate" 
  value="89%" 
  change={{ value: 5, direction: 'up', positive: true }}
/>
```

## Organisms

### Navigation Sidebar
```typescript
interface SidebarProps {
  currentProject?: Project;
  projects: Project[];
  user: User;
  onProjectChange: (project: Project) => void;
}

// Structure:
// - User Profile (Avatar + Name + Role)
// - Project Switcher
// - Main Navigation (Prompts, Tests, Analytics, Settings)
// - Recent Activity
// - Help/Support Links
```

### Test Configuration Panel
```typescript
interface TestConfigPanelProps {
  prompts: PromptTemplate[];
  selectedPrompts: string[];
  availableModels: ModelConfig[];
  selectedModels: string[];
  testContent: ContentData[];
  onConfigChange: (config: TestConfiguration) => void;
}

// Combines:
// - Prompt Selection (multi-select with search)
// - Model Selection (grid with capabilities)
// - Content Upload/Selection
// - Parameter Configuration (collapsible)
// - Cost/Time Estimation
// - Action Buttons (Cancel, Run Test)
```

### Results Comparison Table
```typescript
interface ResultsTableProps {
  results: TestExecution[];
  compareMode?: boolean;
  sortBy?: keyof TestExecution;
  sortDirection?: 'asc' | 'desc';
  filters?: ResultsFilters;
  onSort: (field: keyof TestExecution) => void;
  onFilter: (filters: ResultsFilters) => void;
  onCompare: (results: TestExecution[]) => void;
}

// Features:
// - Sortable columns (Success Rate, Time, Tokens, Cost)
// - Filterable by status, model, date range
// - Multi-select for comparison
// - Expandable rows for detailed output
// - Export functionality
```

### Real-time Test Monitor
```typescript
interface TestMonitorProps {
  session: TestSession;
  onPause: () => void;
  onStop: () => void;
  onRetry: (testId: string) => void;
}

// Components:
// - Overall Progress Bar
// - Current Test Indicator
// - Queue Status
// - Error List with Retry Options
// - Real-time Results Stream
```

### Analytics Dashboard
```typescript
interface DashboardProps {
  dateRange: DateRange;
  metrics: AnalyticsData[];
  onDateRangeChange: (range: DateRange) => void;
}

// Layout:
// - Key Metrics (4 cards across top)
// - Usage Trends (line chart)
// - Model Performance (bar chart)
// - Cost Breakdown (pie chart)
// - Recent Activity (list)
```

## Templates

### Main Layout Template
```typescript
interface MainLayoutProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

// Structure:
// ┌─────────────────────────────────────┐
// │ Header (Project, Search, Profile)   │
// ├─────────┬───────────────────────────┤
// │ Sidebar │ Main Content Area         │
// │         │                           │
// │         │                           │
// └─────────┴───────────────────────────┘
```

### Modal Template
```typescript
interface ModalProps {
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}
```

### Empty State Template
```typescript
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

## Responsive Behavior

### Breakpoint System
```typescript
const breakpoints = {
  sm: '640px',   // Small tablets
  md: '768px',   // Tablets
  lg: '1024px',  // Small desktops
  xl: '1280px',  // Large desktops
  '2xl': '1536px' // Extra large screens
} as const;
```

### Component Adaptations

**Navigation Sidebar**:
- Desktop (lg+): Persistent sidebar, full navigation
- Tablet (md-lg): Collapsible sidebar, icon + text
- Mobile (sm): Bottom tab bar, hamburger menu

**Test Configuration Panel**:
- Desktop: Side-by-side prompt/model selection
- Tablet: Stacked sections with clear separation
- Mobile: Wizard-style step-by-step flow

**Results Table**:
- Desktop: Full table with all columns
- Tablet: Hide less important columns, horizontal scroll
- Mobile: Card-based layout, essential info only

## Accessibility Implementation

### Focus Management
```typescript
// Custom hook for focus trap in modals
export const useFocusTrap = (isActive: boolean) => {
  const firstElementRef = useRef<HTMLElement>(null);
  const lastElementRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    if (isActive && firstElementRef.current) {
      firstElementRef.current.focus();
    }
  }, [isActive]);
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElementRef.current) {
        e.preventDefault();
        lastElementRef.current?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElementRef.current) {
        e.preventDefault();
        firstElementRef.current?.focus();
      }
    }
  };
  
  return { firstElementRef, lastElementRef, handleKeyDown };
};
```

### Screen Reader Support
```typescript
// Live region for dynamic updates
export const LiveRegion: React.FC<{ 
  message: string; 
  level: 'polite' | 'assertive' 
}> = ({ message, level }) => (
  <div
    aria-live={level}
    aria-atomic="true"
    className="sr-only"
  >
    {message}
  </div>
);

// Usage for test progress updates
<LiveRegion 
  message={`Test ${currentTest} of ${totalTests} completed`}
  level="polite"
/>
```

### Keyboard Navigation
```typescript
// Keyboard shortcut handler
export const useKeyboardShortcuts = (shortcuts: Record<string, () => void>) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = `${e.ctrlKey ? 'ctrl+' : ''}${e.metaKey ? 'cmd+' : ''}${e.key.toLowerCase()}`;
      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Usage in main app
useKeyboardShortcuts({
  'ctrl+n': () => createNewPrompt(),
  'ctrl+t': () => startNewTest(),
  'space': () => toggleTestExecution(),
  'escape': () => closeModal(),
});
```

## Implementation Guidelines

### File Structure
```
src/
├── components/
│   ├── atoms/
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Icon/
│   │   └── Badge/
│   ├── molecules/
│   │   ├── FormField/
│   │   ├── Card/
│   │   ├── NavItem/
│   │   └── Progress/
│   ├── organisms/
│   │   ├── Sidebar/
│   │   ├── TestConfigPanel/
│   │   ├── ResultsTable/
│   │   └── Dashboard/
│   └── templates/
│       ├── MainLayout/
│       ├── Modal/
│       └── EmptyState/
├── tokens/
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   └── index.ts
├── hooks/
│   ├── useFocusTrap.ts
│   ├── useKeyboardShortcuts.ts
│   └── useResponsive.ts
└── utils/
    ├── accessibility.ts
    └── classNames.ts
```

### Naming Conventions
- Components: PascalCase (`Button`, `FormField`)
- Props interfaces: ComponentName + Props (`ButtonProps`)
- CSS classes: kebab-case with BEM methodology
- Design tokens: camelCase with semantic naming

### Testing Strategy
- Unit tests for all atoms and molecules
- Integration tests for organisms
- Accessibility tests using @testing-library/jest-dom
- Visual regression tests for key components
- E2E tests for complete user workflows

This component hierarchy provides a scalable foundation for the Prompt Testing Lab interface while maintaining consistency, accessibility, and performance across all user interactions.