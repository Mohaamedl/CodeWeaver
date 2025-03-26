import { useMutation } from '@tanstack/react-query';
import { Info, AlertTriangle, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { ArchitecturalSuggestion, GitHubRepository } from '@shared/schema';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

// Define the shape of a single suggestion.
interface Suggestion {
  type: string; // e.g. "info", "warning", "improvement"
  title: string;
  description: string;
}

// Define the expected API response structure.
interface AnalysisResponse {
  overall: Suggestion[];
  files: { [filename: string]: Suggestion[] };
}

interface SuggestionPanelProps {
  repository?: GitHubRepository;
  repositoryStructure?: any;
}

const SuggestionPanel = ({ repository, repositoryStructure }: SuggestionPanelProps) => {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const { toast } = useToast();

  // Mutation to trigger analysis from your backend.
  const { mutate, isPending, isError } = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/analyze', data);
      return response.json();
    },
    onSuccess: (data: AnalysisResponse) => {
      setAnalysis(data);
      toast({
        title: 'Analysis complete',
        description: 'Repository structure has been analyzed',
      });
    },
    onError: () => {
      toast({
        title: 'Analysis failed',
        description: 'Failed to analyze repository structure',
        variant: 'destructive',
      });
    },
  });

  // Trigger the analysis when a repository and its structure are provided.
  useEffect(() => {
    if (repository && repositoryStructure) {
      setAnalysis(null);
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

  // Returns an icon based on the suggestion type.
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

        {/* Show message if analysis is not yet available */}
        {!isPending && !isError && !analysis && (
          <p className="text-gray-500 dark:text-gray-400">No suggestions yet. Analyzing repository...</p>
        )}

        {analysis && (
          <>
            {/* Overall Repository-Wide Suggestions */}
            {analysis.overall.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white">Repository-Wide Suggestions</h4>
                <ul className="space-y-4 mt-2">
                  {analysis.overall.map((suggestion, idx) => (
                    <li key={idx} className="flex">
                      <div className="flex-shrink-0">
                        {getIconForSuggestionType(suggestion.type)}
                      </div>
                      <div className="ml-3">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white">{suggestion.title}</h5>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{suggestion.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* File-Specific Suggestions */}
            {analysis.files && Object.keys(analysis.files).length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white">File-Specific Suggestions</h4>
                {Object.keys(analysis.files).map((filename, idx) => (
                  <div key={idx} className="mb-4">
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white">{filename}</h5>
                    <ul className="space-y-2 ml-4">
                      {analysis.files[filename].map((suggestion, j) => (
                        <li key={j} className="flex">
                          <div className="flex-shrink-0">
                            {getIconForSuggestionType(suggestion.type)}
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              <strong>{suggestion.title}</strong>: {suggestion.description}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {analysis && (
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
