import React from 'react';
import Header from './Header';
import Footer from './Footer';
import useDarkMode from '@/hooks/useDarkMode';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children, className = '' }) => {
  const darkMode = useDarkMode();

  return (
    <div className={`min-h-screen flex flex-col bg-background text-foreground ${darkMode ? 'dark' : ''}`}>
      <Header />
      <main className={`flex-1 container mx-auto px-4 py-8 ${className}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default PageLayout;
