/**
 * Header Component - Top Navigation Organism
 * 
 * Application header with breadcrumbs, search, notifications,
 * and quick actions. Responsive and accessible.
 */

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Icon, Input } from '@/components/atoms';
import { cn } from '@/utils';

// Mock data
const mockNotifications = [
  {
    id: '1',
    type: 'success' as const,
    title: 'Test completed',
    message: 'Your prompt comparison test has finished successfully.',
    timestamp: new Date(),
    read: false,
  },
  {
    id: '2',
    type: 'warning' as const,
    title: 'Cost threshold reached',
    message: 'You have reached 80% of your monthly cost limit.',
    timestamp: new Date(),
    read: false,
  },
];

const getPageTitle = (pathname: string): string => {
  const routes: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/prompts': 'Prompts',
    '/tests': 'Tests',
    '/analytics': 'Analytics',
    '/settings': 'Settings',
  };
  return routes[pathname] || 'Dashboard';
};

export const Header: React.FC = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  
  const pageTitle = getPageTitle(location.pathname);
  const unreadNotifications = mockNotifications.filter(n => !n.read).length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Backend integration required - search functionality needs API
    if (searchQuery.trim()) {
      alert('Search functionality requires backend integration. Coming soon!');
    }
  };

  return (
    <header className="bg-white border-b border-neutral-200 px-6 py-2">
      <div className="flex items-center justify-between">
        {/* Left side - Page title and breadcrumbs */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              {pageTitle}
            </h1>
            <nav aria-label="Breadcrumb" className="mt-0.5">
              <ol className="flex items-center gap-2 text-sm text-neutral-600">
                <li>
                  <a href="/dashboard" className="hover:text-neutral-900 transition-colors">
                    Home
                  </a>
                </li>
                <Icon name="chevron-right" size="xs" className="text-neutral-400" />
                <li className="text-neutral-900 font-medium">
                  {pageTitle}
                </li>
              </ol>
            </nav>
          </div>
        </div>

        {/* Right side - Search, notifications, quick actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:block">
            <Input
              type="search"
              placeholder="Search prompts, tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Icon name="search" size="sm" />}
              className="w-80"
            />
          </form>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
            {/* New Test Button */}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icon name="plus" size="sm" />}
              className="hidden lg:flex"
              disabled={true}
            >
              New Test
            </Button>

            {/* Mobile search */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              aria-label="Search"
              disabled={true}
            >
              <Icon name="search" size="sm" />
            </Button>

            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={`Notifications ${unreadNotifications > 0 ? `(${unreadNotifications} unread)` : ''}`}
                className="relative"
              >
                <Icon name="alert-circle" size="sm" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-error-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Button>

              {/* Notifications dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg z-50">
                  <div className="p-4 border-b border-neutral-200">
                    <h3 className="font-semibold text-neutral-900">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {mockNotifications.length > 0 ? (
                      mockNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            'p-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors',
                            !notification.read && 'bg-primary-50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'w-2 h-2 rounded-full mt-2',
                              notification.type === 'success' && 'bg-success-500',
                              notification.type === 'warning' && 'bg-warning-500',
                              (notification.type as any) === 'error' && 'bg-error-500'
                            )} />
                            <div className="flex-1">
                              <p className="font-medium text-neutral-900 text-sm">
                                {notification.title}
                              </p>
                              <p className="text-neutral-600 text-sm mt-1">
                                {notification.message}
                              </p>
                              <p className="text-neutral-400 text-xs mt-2">
                                {notification.timestamp.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-neutral-500">
                        <Icon name="info" size="lg" className="mx-auto mb-2" />
                        <p>No notifications</p>
                      </div>
                    )}
                  </div>
                  {mockNotifications.length > 0 && (
                    <div className="p-4 border-t border-neutral-200">
                      <Button variant="ghost" size="sm" fullWidth disabled={true}>
                        View all notifications
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Help */}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Help"
              onClick={() => window.open('https://docs.example.com', '_blank')}
            >
              <Icon name="help-circle" size="sm" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

Header.displayName = 'Header';