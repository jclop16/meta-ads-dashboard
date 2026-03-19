import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CplTargetProvider } from "./contexts/CplTargetContext";

const Home = lazy(() => import("./pages/Home"));
const SnapshotHistory = lazy(() => import("./pages/SnapshotHistory"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/history"} component={SnapshotHistory} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <CplTargetProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense
              fallback={
                <div
                  className="min-h-screen flex items-center justify-center text-sm font-mono"
                  style={{ background: "#0D0F14", color: "#64748B" }}
                >
                  Loading dashboard…
                </div>
              }
            >
              <Router />
            </Suspense>
          </TooltipProvider>
        </CplTargetProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
