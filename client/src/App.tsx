import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { NotificationProvider } from "@/components/Notification";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import AssistantPage from "@/pages/AssistantPage";
import CodebaseAnalysisPage from "@/pages/CodebaseAnalysisPage";
import HomePage from "@/pages/HomePage";
import NotFound from "@/pages/not-found";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/codebase" component={CodebaseAnalysisPage} />
      <Route path="/codebase/:owner/:repo" component={CodebaseAnalysisPage} />
      <Route path="/assistant" component={AssistantPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <div className="min-h-screen flex flex-col bg-background">
              <Header />
              <main className="flex-grow">
                <Router />
              </main>
              <Footer />
            </div>
            <Toaster />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
