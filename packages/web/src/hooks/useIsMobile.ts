/**
 * useIsMobile Hook
 * 
 * A custom hook for detecting mobile/tablet devices based on screen width.
 * Useful for responsive design decisions in React components.
 */

import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook to determine if the current viewport is mobile-sized
 * 
 * @returns boolean indicating if the screen width is below the mobile breakpoint
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}