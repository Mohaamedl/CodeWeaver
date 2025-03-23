import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import CodebaseAnalysisPage from "@/pages/CodebaseAnalysisPage";
import AssistantPage from "@/pages/AssistantPage";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationProvider } from "@/components/Notification";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/codebase" component={CodebaseAnalysisPage} />
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
