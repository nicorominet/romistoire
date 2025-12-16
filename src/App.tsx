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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;