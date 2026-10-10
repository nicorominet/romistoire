import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from "react-router-dom";
import React, { Suspense, lazy } from "react";
import Spinner from "@/components/ui/Spinner";
import ErrorPage from "@/components/Error/ErrorPage";

// Lazy load pages
const Index = lazy(() => import("./pages/Index"));
const StoriesPage = lazy(() => import("./pages/StoriesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const StoryDetailPage = lazy(() => import("./pages/StoryDetailPage"));
const CreateStoryPage = lazy(() => import("./pages/CreateStoryPage"));
const EditStoryPage = lazy(() => import("./pages/EditStoryPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const GenerationPage = lazy(() => import("@/pages/GenerationPage"));
const TimelinePage = lazy(() => import("@/pages/TimelinePage"));
const ThemesPage = lazy(() => import("@/pages/ThemesPage"));
const WeeklyTopicsPage = lazy(() => import("@/pages/WeeklyTopicsPage"));
const IllustrationsPage = lazy(() => import("@/pages/IllustrationsPage"));
const SeriesManagementPage = lazy(() => import("@/pages/SeriesManagementPage"));
const DebugConsole = lazy(() => import("@/components/Debug/DebugConsole"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

class ErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorPage error={this.state.error} resetErrorBoundary={this.resetErrorBoundary} />;
    }
    return this.props.children;
  }
}

import { logger } from "@/lib/logger";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useLocale } from "@/lib/i18n";

const GlobalLogger = () => {
    const location = useLocation();
    const lastClickRef = useRef<{ time: number, target: EventTarget | null }>({ time: 0, target: null });
    const clickCountRef = useRef(0);

    // Track Route Changes
    useEffect(() => {
        logger.info('ROUTE_CHANGE', `Navigated to ${location.pathname}`, {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash
        });
    }, [location]);

    // Track Global Clicks & Rage Clicks
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const now = Date.now();
            
            // Basic Interaction Log
            // getAttribute: on an SVG icon, className is not a string
            const classes = target.getAttribute?.('class') ?? '';
            const elementInfo = target.tagName + (target.id ? `#${target.id}` : '') + (classes ? `.${classes.split(' ').join('.')}` : '');
            logger.info('UI_INTERACTION', `Click on ${elementInfo}`, {
                x: e.clientX,
                y: e.clientY,
                text: target.innerText?.substring(0, 20)
            });

            // Rage Click Detection (< 300ms between clicks on same target)
            if (lastClickRef.current.target === target && (now - lastClickRef.current.time) < 300) {
                clickCountRef.current++;
                if (clickCountRef.current >= 3) {
                     logger.warn('UI_INTERACTION', 'Rage Click Detected', {
                        element: elementInfo,
                        count: clickCountRef.current
                    });
                    clickCountRef.current = 0; // Reset after logging
                }
            } else {
                clickCountRef.current = 1;
            }

            lastClickRef.current = { time: now, target };
        };

        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return null;
};

// Root layout: everything that needs the router context (logger, error boundary, lazy pages)
const RootLayout = () => {
  // Route elements are created once: remount the page so every text is translated again
  const locale = useLocale();
  return (
  <>
    <GlobalLogger />
    <ErrorBoundary key={locale}>
      <Suspense fallback={
        <div className="flex h-screen w-full items-center justify-center">
          <Spinner className="h-12 w-12 text-primary" />
        </div>
      }>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  </>
  );
};

// Data router: required by useBlocker (unsaved changes guard on create/edit pages)
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <Index /> },
      { path: "/stories", element: <StoriesPage /> },
      { path: "/stories/:id", element: <StoryDetailPage /> },
      { path: "/create", element: <CreateStoryPage /> },
      { path: "/edit/:id", element: <EditStoryPage /> },
      { path: "/series-management", element: <SeriesManagementPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/generation", element: <GenerationPage /> },
      // Old URL of the themes page
      { path: "/theme", element: <Navigate to="/themes" replace /> },
      { path: "/weekly-themes", element: <WeeklyTopicsPage /> },
      { path: "/illustrations", element: <IllustrationsPage /> },
      { path: "/timeline", element: <TimelinePage /> },
      { path: "/themes", element: <ThemesPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <RouterProvider router={router} />
      {import.meta.env.DEV && <Suspense fallback={null}><DebugConsole /></Suspense>}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
