import AIArchitectAssistant from '@/components/AIArchitectAssistant';
import DirectoryTree from '@/components/DirectoryTree';
import RepositoryList from '@/components/RepositoryList';
import { ReviewPanel } from '@/components/ReviewPanel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { GitHubRepository } from '@/types/github';
import { ReviewSession } from '@/types/review';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Brain, Code, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const CodebaseAnalysisPage = () => {
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [repositoryStructure, setRepositoryStructure] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<ReviewSession | null>(null);
  const { isAuthenticated, login } = useAuth();
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [githubToken, setGithubToken] = useState<string | null>(null);

  useEffect(() => {
    // Handle auth token from URL (after GitHub OAuth)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('github_token', token);
      // Clean token from URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Handle repo from URL path
    const paths = window.location.pathname.split('/');
    const ownerParam = paths[2];
    const repoParam = paths[3];
    
    if (ownerParam && repoParam) {
      const repository = {
        name: repoParam,
        owner: {
          login: ownerParam
        },
        description: '',
        private: false,
        fork: false,
        html_url: `https://github.com/${ownerParam}/${repoParam}`
      };
      
      setSelectedRepo(repository);
      // Don't update localStorage here to avoid overwriting user selection
      fetchRepoStructure(ownerParam, repoParam);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('github_token');
      if (token) {
        setGithubToken(token);
      }
    }
  }, [isAuthenticated]);

  const fetchRepoStructure = async (owner: string, repo: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/repository/${owner}/${repo}/tree`,
        { credentials: 'include' }
      );

      if (!response.ok) throw new Error('Failed to fetch repository structure');

      const data = await response.json();
      setRepositoryStructure(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load repository',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const { data: treeData } = useQuery({
    queryKey: ['repositoryTree', selectedRepo?.owner.login, selectedRepo?.name],
    queryFn: async () => {
      if (!selectedRepo) return null;
      
      const response = await fetch(
        `/api/repository/${selectedRepo.owner.login}/${selectedRepo.name}/tree`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch repository structure');
      }

      const data = await response.json();
      setRepositoryStructure(data); // Store the structure
      return data;
    },
    enabled: !!selectedRepo,
  });

  const startReview = useMutation({
    mutationFn: async () => {
      if (!selectedRepo || !repositoryStructure) {
        throw new Error('Repository structure not loaded');
      }

      const token = localStorage.getItem('github_token');
      if (!token) {
        throw new Error('GitHub authentication required');
      }

      const response = await fetch('http://localhost:8000/review', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          structure: repositoryStructure,
          github_token: token
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start review');
      }

      const data = await response.json();
      if (!data || !data.suggestions) {
        throw new Error('Invalid response format');
      }

      return data;
    },
    onSuccess: (data) => {
      if (!data.suggestions || data.suggestions.length === 0) {
        toast({
          title: 'Review completed',
          description: 'No suggestions found for this repository',
        });
      } else {
        console.log(`Found ${data.suggestions.length} suggestions`);
        setCurrentSession(data);
        toast({
          title: 'Review completed',
          description: `Found ${data.suggestions.length} suggestions`,
        });
      }
    },
    onError: (error: Error) => {
      console.error('Review error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleRepositorySelect = async (repository: GitHubRepository) => {
    setIsLoading(true);
    setSelectedRepo(repository);
    setCurrentSession(null);
    
    try {
      // Update URL cleanly
      const newUrl = `/codebase/${repository.owner.login}/${repository.name}`;
      window.history.pushState(null, '', newUrl);
      
      // Store repo info
      localStorage.setItem('selectedRepo', JSON.stringify({
        owner: repository.owner.login,
        repo: repository.name
      }));
      
      await fetchRepoStructure(repository.owner.login, repository.name);
      
    } catch (error) {
      setSelectedRepo(null);
      window.history.pushState(null, '', '/codebase');
    }
  };

  const renderRepositoryHeader = () => (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg mb-6">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            {selectedRepo?.name}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-300">
            {selectedRepo?.description || 'No description available'}
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setIsAIAssistantOpen(true)}
            className="flex items-center gap-2"
            disabled={!repositoryStructure}
          >
            <Brain className="h-4 w-4" />
            AI Architect
          </Button>
          <Button
            onClick={() => startReview.mutate()}
            disabled={startReview.isPending || !repositoryStructure || !githubToken}
            className="flex items-center gap-2"
          >
            {startReview.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : !githubToken ? (
              <>
                <Code className="h-4 w-4" />
                Login Required
              </>
            ) : (
              <>
                <Code className="h-4 w-4" />
                Start Review
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              setSelectedRepo(null);
              setRepositoryStructure(null);
              setCurrentSession(null);
            }}
          >
            Back to Repositories
          </Button>
        </div>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 text-xs">
          <p>Repository Structure Loaded: {repositoryStructure ? 'Yes' : 'No'}</p>
          <p>Review Session: {currentSession ? `ID: ${currentSession.session_id}` : 'None'}</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Codebase Analysis
          </h1>

          {!selectedRepo && (
            <RepositoryList onRepositorySelect={handleRepositorySelect} />
          )}

          {isLoading && (
            <div className="mt-8 text-center">
              <Loader2 className="animate-spin h-10 w-10 text-primary mx-auto" />
              <p className="mt-2 text-gray-500 dark:text-gray-300">
                Loading repository structure...
              </p>
            </div>
          )}

          {selectedRepo && !isLoading && (
            <div className="mt-8">
              {renderRepositoryHeader()}
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  {repositoryStructure && (
                    <DirectoryTree 
                      owner={selectedRepo.owner.login} 
                      repo={selectedRepo.name}
                      structure={repositoryStructure}
                    />
                  )}
                </div>
                <div className="lg:col-span-1">
                  {currentSession ? (
                    <ReviewPanel
                      suggestions={currentSession.suggestions}
                      sessionId={currentSession.session_id}
                      structure={repositoryStructure}
                      files={currentSession.files}
                    />
                  ) : (
                    <div className="text-center p-4 bg-white dark:bg-gray-800 shadow sm:rounded-lg">
                      <p className="text-muted-foreground">
                        Select a repository and click "Start Review" to begin analysis
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <AIArchitectAssistant
        isOpen={isAIAssistantOpen}
        onOpenChange={setIsAIAssistantOpen}
        projectStructure={repositoryStructure || {}}
        files={currentSession?.files || []}
      />
    </>
  );
};

export default CodebaseAnalysisPage;
