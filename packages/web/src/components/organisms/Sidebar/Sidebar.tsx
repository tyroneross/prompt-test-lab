/**
 * Sidebar Component - Navigation Organism
 * 
 * Main navigation sidebar with project switcher, navigation items,
 * and user profile section. Supports collapsible states and accessibility.
 */

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '@/components/atoms';
import { NavItem } from '@/components/molecules';
import { cn } from '@/utils';

// Mock data - replace with actual data from API
const mockProject = {
  id: '1',
  name: 'AI Research Project',
  role: 'owner' as const,
};

const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  avatar: null,
};

const navigationItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: <Icon name="grid" size="sm" />,
  },
  {
    id: 'prompts',
    label: 'Prompts',
    href: '/prompts',
    icon: <Icon name="file-text" size="sm" />,
  },
  {
    id: 'tests',
    label: 'Tests',
    href: '/tests',
    icon: <Icon name="play" size="sm" />,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    icon: <Icon name="zap" size="sm" />,
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: <Icon name="settings" size="sm" />,
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActiveRoute = (href: string) => {
    return location.pathname === href;
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-white border-r border-neutral-200 transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Icon name="zap" size="sm" className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">
                Prompt Lab
              </h1>
            </div>
          </div>
        )}
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-md hover:bg-neutral-100 transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon
            name={isCollapsed ? 'chevron-right' : 'chevron-left'}
            size="sm"
            className="text-neutral-600"
          />
        </button>
      </div>

      {/* Project Switcher */}
      {!isCollapsed && (
        <div className="p-4 border-b border-neutral-200">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <Icon name="folder" size="sm" className="text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">
                {mockProject.name}
              </p>
              <p className="text-xs text-neutral-600 capitalize">
                {mockProject.role}
              </p>
            </div>
            <Icon name="chevron-down" size="sm" className="text-neutral-400" />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" role="navigation">
        {navigationItems.map((item) => (
          <NavItem
            key={item.id}
            href={item.href}
            icon={item.icon}
            active={isActiveRoute(item.href)}
            className={cn(isCollapsed && 'justify-center')}
          >
            {!isCollapsed && item.label}
          </NavItem>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-neutral-200">
        {isCollapsed ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 bg-neutral-300 rounded-full flex items-center justify-center">
              <Icon name="user" size="sm" className="text-neutral-600" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="w-8 h-8 bg-neutral-300 rounded-full flex items-center justify-center">
              {mockUser.avatar ? (
                <img
                  src={mockUser.avatar}
                  alt={mockUser.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <Icon name="user" size="sm" className="text-neutral-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">
                {mockUser.name}
              </p>
              <p className="text-xs text-neutral-600 truncate">
                {mockUser.email}
              </p>
            </div>
            <Icon name="more-horizontal" size="sm" className="text-neutral-400" />
          </div>
        )}
      </div>
    </aside>
  );
};

Sidebar.displayName = 'Sidebar';