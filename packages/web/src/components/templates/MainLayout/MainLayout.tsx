/**
 * MainLayout Template - Primary Application Layout
 * 
 * The main layout template that provides the overall structure for the application.
 * Includes sidebar navigation, header, and main content area.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/organisms/Sidebar';
import { Header } from '@/components/organisms/Header';

export const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-md focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Main layout structure */}
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header />

          {/* Main content */}
          <main
            id="main-content"
            className="flex-1 overflow-auto bg-white"
            role="main"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

MainLayout.displayName = 'MainLayout';