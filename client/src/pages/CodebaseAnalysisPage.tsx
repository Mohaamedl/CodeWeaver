import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/components/Notification';
import { GitHubRepository } from '@shared/schema';
import RepositoryList from '@/components/RepositoryList';
import DirectoryTree from '@/components/DirectoryTree';
import SuggestionPanel from '@/components/SuggestionPanel';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

const CodebaseAnalysisPage = () => {
  const { isAuthenticated } = useAuth();
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showNotification } = useNotification();
  const [location, setLocation] = useLocation();
  const [repositoryStructure, setRepositoryStructure] = useState<any>(null);

  // Check authentication status
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ['/api/auth/status'],
    retry: false,
  });

  // Handle repository selection
  const handleRepositorySelect = (repository: GitHubRepository) => {
    setIsLoading(true);
    setSelectedRepo(repository);
    
    // Simulate loading time for tree fetching
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  // Handle file selection
  const handleFileSelect = (path: string) => {
    showNotification(`Selected file: ${path}`, 'success');
  };

  // When tree data is loaded, update the repository structure
  const handleTreeLoaded = (data: any) => {
    setRepositoryStructure(data);
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated && !authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Authentication Required</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You need to connect with GitHub to access this feature.
          </p>
          <Button onClick={() => setLocation('/')}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Codebase Analysis</h1>

        {/* Repository List */}
        {!selectedRepo && (
          <RepositoryList onRepositorySelect={handleRepositorySelect} />
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="mt-8 text-center">
            <Loader2 className="animate-spin h-10 w-10 text-primary dark:text-primary-foreground mx-auto" />
            <p className="mt-2 text-gray-500 dark:text-gray-300">Analyzing repository structure...</p>
          </div>
        )}

        {/* Repository Analysis */}
        {selectedRepo && !isLoading && (
          <div className="mt-8">
            <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">{selectedRepo.name}</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-300">{selectedRepo.description || 'No description available'}</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedRepo(null);
                    setRepositoryStructure(null);
                  }}
                >
                  Back to Repositories
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Directory Tree */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Directory Structure</h3>
                  </div>
                  {/* Directory Tree Component */}
                  <div className="px-4 py-5 sm:p-6">
                    <DirectoryTree 
                      owner={selectedRepo.owner.login} 
                      repo={selectedRepo.name} 
                      onFileSelect={handleFileSelect}
                    />
                  </div>
                </div>
              </div>
              
              {/* Suggestions Panel */}
              <div className="lg:col-span-1">
                <SuggestionPanel 
                  repository={selectedRepo}
                  repositoryStructure={repositoryStructure} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodebaseAnalysisPage;
