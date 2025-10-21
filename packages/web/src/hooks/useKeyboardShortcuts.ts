/**
 * Keyboard Shortcuts Hook
 * 
 * Custom hook for handling keyboard shortcuts with proper cleanup
 * and modifier key support.
 */

import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      
      // Skip if user is typing in an input field
      if (
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.hasAttribute('contenteditable')
      ) {
        return;
      }

      // Find matching shortcut
      const matchingShortcut = shortcutsRef.current.find(shortcut => {
        return (
          shortcut.key.toLowerCase() === event.key.toLowerCase() &&
          (shortcut.ctrlKey ?? false) === event.ctrlKey &&
          (shortcut.metaKey ?? false) === event.metaKey &&
          (shortcut.shiftKey ?? false) === event.shiftKey &&
          (shortcut.altKey ?? false) === event.altKey
        );
      });

      if (matchingShortcut) {
        if (matchingShortcut.preventDefault !== false) {
          event.preventDefault();
        }
        matchingShortcut.handler(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}

// Convenience hook for common shortcuts
export function useCommonShortcuts(handlers: {
  onNew?: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [];

  if (handlers.onNew) {
    shortcuts.push({
      key: 'n',
      ctrlKey: true,
      metaKey: true,
      handler: handlers.onNew,
    });
  }

  if (handlers.onSave) {
    shortcuts.push({
      key: 's',
      ctrlKey: true,
      metaKey: true,
      handler: handlers.onSave,
    });
  }

  if (handlers.onCopy) {
    shortcuts.push({
      key: 'c',
      ctrlKey: true,
      metaKey: true,
      handler: handlers.onCopy,
    });
  }

  if (handlers.onPaste) {
    shortcuts.push({
      key: 'v',
      ctrlKey: true,
      metaKey: true,
      handler: handlers.onPaste,
    });
  }

  if (handlers.onUndo) {
    shortcuts.push({
      key: 'z',
      ctrlKey: true,
      metaKey: true,
      handler: handlers.onUndo,
    });
  }

  if (handlers.onRedo) {
    shortcuts.push({
      key: 'z',
      ctrlKey: true,
      metaKey: true,
      shiftKey: true,
      handler: handlers.onRedo,
    });
  }

  if (handlers.onSearch) {
    shortcuts.push({
      key: 'f',
      ctrlKey: true,
      metaKey: true,
      handler: handlers.onSearch,
    });
    shortcuts.push({
      key: 'k',
      ctrlKey: true,
      metaKey: true,
      handler: handlers.onSearch,
    });
  }

  if (handlers.onEscape) {
    shortcuts.push({
      key: 'Escape',
      handler: handlers.onEscape,
    });
  }

  useKeyboardShortcuts(shortcuts);
}