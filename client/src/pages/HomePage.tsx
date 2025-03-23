import { Code, MessageSquare, LayoutTemplate } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { FeatureCard } from '@/components/ui/feature-card';
import { StepCard } from '@/components/ui/step-card';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/components/Notification';

const HomePage = () => {
  const { isAuthenticated, login } = useAuth();
  const { showNotification } = useNotification();

  const handleCodebaseClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      login();
      showNotification('Connecting to GitHub...', 'success');
    }
  };

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
              <span className="block">Design Better</span>
              <span className="block text-primary dark:text-primary-foreground">Software Architecture</span>
            </h1>
            <p className="mt-3 text-base text-gray-500 dark:text-gray-300 sm:mt-5 sm:text-lg">
              Analyze your codebase and get intelligent architectural suggestions with our AI-powered assistant.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button 
                size="lg"
                onClick={handleCodebaseClick}
                asChild={isAuthenticated}
                className="flex items-center"
              >
                {isAuthenticated ? (
                  <Link href="/codebase">
                    <Code className="mr-2 h-5 w-5" />
                    Connect GitHub
                  </Link>
                ) : (
                  <>
                    <Code className="mr-2 h-5 w-5" />
                    Connect GitHub
                  </>
                )}
              </Button>

              <Button 
                variant="outline" 
                size="lg"
                asChild
                className="flex items-center"
              >
                <Link href="/assistant">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Start Assistant
                </Link>
              </Button>
            </div>
          </div>
          <div className="hidden md:block">
            <img 
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&h=600&q=80" 
              alt="Architecture diagram" 
              className="w-full h-auto rounded-lg shadow-md dark:opacity-80" 
            />
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mt-24">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <StepCard
              number={1}
              title="Connect Repository"
              description="Link your GitHub project or start a new one with our assistant."
            />
            <StepCard
              number={2}
              title="Analysis"
              description="AI analyzes your codebase structure and patterns."
            />
            <StepCard
              number={3}
              title="Recommendations"
              description="Get detailed architecture suggestions."
            />
            <StepCard
              number={4}
              title="Implementation"
              description="Apply changes with guided assistance."
            />
          </div>
        </div>
        
        {/* Key Features Section */}
        <div className="mt-24">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Code}
              title="Codebase Analysis"
              description="Get real-time insights about your project structure."
            />
            <FeatureCard
              icon={MessageSquare}
              title="AI Assistant"
              description="Step-by-step guidance for defining your project goals."
            />
            <FeatureCard
              icon={LayoutTemplate}
              title="Customizable Solutions"
              description="Tailor architectural recommendations to your specific needs."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
