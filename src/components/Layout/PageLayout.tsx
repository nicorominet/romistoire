import React from 'react';
import Header from './Header';
import Footer from './Footer';
import useDarkMode from '@/hooks/useDarkMode';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  /** Without header and footer (story reading mode) */
  bare?: boolean;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children, className = '', compact = false, bare = false }) => {
  const darkMode = useDarkMode();

  return (
    <div className={`h-screen flex flex-col bg-background text-foreground overflow-hidden relative ${darkMode ? 'dark' : ''}`}>
      {/* Global Premium Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900 -z-10" />

      {/* Fixed Header */}
      {!bare && (
        <div className="flex-none z-50">
          <Header />
        </div>
      )}

      {/* Scrollable Content */}
      <main className={`flex-1 overflow-y-auto scroll-smooth w-full relative ${className}`}>
         {/* Internal wrapper to maintain container behavior if needed, or apply directly to main if it was relying on it. 
             The previous code had 'container mx-auto px-4 py-8' on main. 
             If we keep that on the scrollable container, the scrollbar is at the edge of the window (good).
             But the content is centered.
         */}
         <div className={`mx-auto min-h-full w-full max-w-[1680px] px-4 2xl:px-6 ${compact ? 'flex flex-col py-3 2xl:py-5' : 'py-8'}`}>
            {children}
         </div>
      </main>

      {/* Fixed Footer */}
      {!bare && (
        <div className="flex-none z-50">
          <Footer />
        </div>
      )}
    </div>
  );
};

export default PageLayout;
