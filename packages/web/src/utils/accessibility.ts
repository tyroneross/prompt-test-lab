/**
 * Accessibility utilities for WCAG 2.2 AA compliance
 */

/**
 * Generates a unique ID for form elements and labels
 */
export function generateId(prefix: string = 'element'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates proper ARIA attributes for form fields
 */
export function getFieldAriaProps(
  fieldId: string,
  error?: string,
  helpText?: string,
  required?: boolean
) {
  const ariaProps: Record<string, string | boolean> = {
    id: fieldId,
  };

  if (required) {
    ariaProps['aria-required'] = true;
  }

  if (error) {
    ariaProps['aria-invalid'] = true;
    ariaProps['aria-describedby'] = `${fieldId}-error`;
  }

  if (helpText && !error) {
    ariaProps['aria-describedby'] = `${fieldId}-help`;
  }

  if (helpText && error) {
    ariaProps['aria-describedby'] = `${fieldId}-help ${fieldId}-error`;
  }

  return ariaProps;
}

/**
 * Checks if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ];

  return focusableSelectors.some(selector => element.matches(selector));
}

/**
 * Gets all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
}

/**
 * Traps focus within a container (for modals, dropdowns, etc.)
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent) {
  if (event.key !== 'Tab') return;

  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey) {
    // Shift + Tab - moving backwards
    if (document.activeElement === firstElement) {
      lastElement?.focus();
      event.preventDefault();
    }
  } else {
    // Tab - moving forwards
    if (document.activeElement === lastElement) {
      firstElement?.focus();
      event.preventDefault();
    }
  }
}

/**
 * Announces content to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Checks if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Gets the preferred color scheme
 */
export function getPreferredColorScheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Keyboard event handler for Enter and Space keys (button-like behavior)
 */
export function handleKeyboardActivation(
  event: React.KeyboardEvent,
  handler: () => void
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handler();
  }
}

/**
 * Escape key handler for closing modals/dropdowns
 */
export function handleEscapeKey(
  event: React.KeyboardEvent,
  handler: () => void
) {
  if (event.key === 'Escape') {
    event.preventDefault();
    handler();
  }
}

/**
 * Creates a proper skip link component props
 */
export function getSkipLinkProps(targetId: string, label: string = 'Skip to main content') {
  return {
    href: `#${targetId}`,
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-md focus:text-sm',
    children: label,
  };
}