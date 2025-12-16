import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
const WeeklyThemesPage = lazy(() => import("./pages/WeeklyThemesPage"));
const TimelinePage = lazy(() => import("@/pages/TimelinePage"));
const Themepage = lazy(() => import("@/pages/Themepage"));
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

  render() {
    if (this.state.hasError) {
      return <ErrorPage error={this.state.error} />;
    }
    return this.props.children;
  }
}

import { logger } from "@/lib/logger";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

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
            const elementInfo = target.tagName + (target.id ? `#${target.id}` : '') + (target.className ? `.${target.className.split(' ').join('.')}` : '');
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GlobalLogger />
        <ErrorBoundary>
          <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center">
              <Spinner className="h-12 w-12 text-primary" />
            </div>
          }>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/stories" element={<StoriesPage />} />
              <Route path="/stories/:id" element={<StoryDetailPage />} />
              <Route path="/create" element={<CreateStoryPage />} />
              <Route path="/edit/:id" element={<EditStoryPage />} />
              <Route path="/series-management" element={<SeriesManagementPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/weekly-themes" element={<WeeklyThemesPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/theme" element={<Themepage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
      {process.env.NODE_ENV === 'development' && <Suspense fallback={null}><DebugConsole /></Suspense>}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;