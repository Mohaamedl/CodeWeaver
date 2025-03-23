import { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AssistantChat from '@/components/AssistantChat';
import { useAuth } from '@/hooks/useAuth';

const AssistantPage = () => {
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const { isAuthenticated, isLoading, login } = useAuth();
  const [, setLocation] = useLocation();

  const handleAssistantComplete = (plan: any) => {
    setGeneratedPlan(plan);
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show login prompt for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Authentication Required</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              You need to sign in with GitHub to access the assistant feature.
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={login}>
                Sign in with GitHub
              </Button>
              <Button variant="outline" onClick={() => setLocation('/')}>
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Interactive Assistant</h1>
        
        <AssistantChat onComplete={handleAssistantComplete} />
      </div>
    </div>
  );
};

export default AssistantPage;
