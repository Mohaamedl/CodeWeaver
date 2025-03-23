import { useMutation } from '@tanstack/react-query';
import { Info, AlertTriangle, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { ArchitecturalSuggestion, GitHubRepository } from '@shared/schema';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SuggestionPanelProps {
  repository?: GitHubRepository;
  repositoryStructure?: any;
}

const SuggestionPanel = ({ repository, repositoryStructure }: SuggestionPanelProps) => {
  const [suggestions, setSuggestions] = useState<ArchitecturalSuggestion[]>([]);
  const { toast } = useToast();

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/analyze', data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
        toast({
          title: 'Analysis complete',
          description: 'Repository structure has been analyzed',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Analysis failed',
        description: 'Failed to analyze repository structure',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (repository && repositoryStructure) {
      setSuggestions([]);
      mutate({
        repositoryStructure,
        repositoryName: repository.name,
        repositoryOwner: repository.owner.login,
      });
    }
  }, [repository, repositoryStructure, mutate]);

  const handleExport = () => {
    // Implementation for exporting the analysis
    toast({
      title: 'Export initiated',
      description: 'Your analysis will be exported',
    });
  };

  const getIconForSuggestionType = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="h-5 w-5 text-secondary-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'improvement':
      default:
        return <Check className="h-5 w-5 text-green-500" />;
    }
  };

  if (!repository) {
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400">
        Select a repository to see architecture suggestions.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Architecture Suggestions</h3>
      </div>
      <div className="px-4 py-5 sm:p-6">
        {isPending && (
          <div className="text-center py-4">
            <div className="animate-spin inline-block h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Analyzing repository structure...</p>
          </div>
        )}

        {isError && (
          <div className="text-center py-4 text-red-500 dark:text-red-400">
            Error analyzing repository. Please try again.
          </div>
        )}

        {!isPending && !isError && suggestions.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">No suggestions yet. Analyzing repository...</p>
        )}

        {suggestions.length > 0 && (
          <ul className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {getIconForSuggestionType(suggestion.type)}
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">{suggestion.title}</h4>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {suggestion.description}
                    </p>
                    <a href="#" className="mt-2 text-sm font-medium text-primary dark:text-primary-foreground hover:text-primary-700 dark:hover:text-primary-300">Learn more</a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        
        {suggestions.length > 0 && (
          <div className="mt-6">
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Analysis
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionPanel;
