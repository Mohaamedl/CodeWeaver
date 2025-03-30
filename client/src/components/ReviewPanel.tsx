import { DiffViewer } from '@/components/DiffViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ReviewSuggestion } from '@/types/review';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface ReviewPanelProps {
  suggestions: ReviewSuggestion[];
  sessionId: number;
}

export function ReviewPanel({ suggestions, sessionId }: ReviewPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedSuggestions, setExpandedSuggestions] = useState<number[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branches, setBranches] = useState<string[]>([]);

  // Fetch available branches when component mounts
  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const selectedRepo = localStorage.getItem('selectedRepo');
      if (!selectedRepo) {
        throw new Error('No repository selected');
      }
      const { owner, repo } = JSON.parse(selectedRepo);
      
      const response = await fetch(`/api/github/branches?owner=${owner}&repo=${repo}`);
      if (!response.ok) throw new Error('Failed to fetch branches');
      const data = await response.json();
      setBranches(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive",
      });
    }
  };

  const handleApplyPatch = async () => {
    if (!selectedSuggestion) return;
    
    try {
      const response = await fetch('/api/review/apply-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion_id: selectedSuggestion }),
      });

      if (!response.ok) throw new Error('Failed to apply patch');
      
      toast({
        title: "Success",
        description: "Patch applied successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply patch",
        variant: "destructive",
      });
    }
  };

  const createBranchAndPR = async () => {
    if (!selectedSuggestion || !selectedBranch) return;

    try {
      // Create a new branch
      const branchResponse = await fetch('/api/github/create-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseBranch: selectedBranch,
          suggestionId: selectedSuggestion,
        }),
      });

      if (!branchResponse.ok) throw new Error('Failed to create branch');

      // Create PR
      const prResponse = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId: selectedSuggestion,
        }),
      });

      if (!prResponse.ok) throw new Error('Failed to create PR');

      toast({
        title: "Success",
        description: "Branch created and PR opened",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create branch and PR",
        variant: "destructive",
      });
    }
  };

  const handleSuggestionSelect = (suggestionId: number) => {
    console.log('Selected suggestion:', suggestionId);
    console.log('Previous selected:', selectedSuggestion);
    setSelectedSuggestion(selectedSuggestion === suggestionId ? null : suggestionId);
    setSelectedBranch('');
  };

  // Debug log when suggestions change
  useEffect(() => {
    console.log('Suggestions received:', suggestions);
  }, [suggestions]);

  // Debug log when selection changes
  useEffect(() => {
    if (selectedSuggestion) {
      const selected = suggestions.find(s => s.id === selectedSuggestion);
      console.log('Currently selected suggestion:', selected);
      console.log('Has patch:', selected?.patch ? 'Yes' : 'No');
    }
  }, [selectedSuggestion, suggestions]);

  if (!suggestions || suggestions.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-center text-muted-foreground">
          No suggestions found for this repository
        </p>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="sticky top-0 z-10 bg-background border-b">
        <CardTitle className="flex items-center justify-between">
          <span>Code Review Suggestions ({suggestions.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {suggestions.map((suggestion) => (
            <Card 
              key={`suggestion-${suggestion.id}-${suggestion.file_path}`}
              className={cn(
                "transition-colors",
                selectedSuggestion === suggestion.id && "border-primary bg-primary/5"
              )}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-4">
                  {/* Suggestion Header */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1.5">
                      <div className="font-semibold text-primary">
                        {suggestion.agent}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.message}
                      </p>
                      {suggestion.file_path && (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {suggestion.file_path}
                        </code>
                      )}
                    </div>
                    <Button
                      variant={selectedSuggestion === suggestion.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSuggestionSelect(suggestion.id)}
                    >
                      {selectedSuggestion === suggestion.id ? 'Close' : 'View'}
                    </Button>
                  </div>

                  {/* Expanded Content */}
                  {selectedSuggestion === suggestion.id && suggestion.patch && (
                    <div className="space-y-4 pt-4 border-t">
                      {/* Code Comparison */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Original</h4>
                          <div className="rounded-md border bg-muted/10 p-4">
                            <DiffViewer 
                              patch={suggestion.patch}
                              mode="original"
                              className="max-h-[300px] overflow-auto"
                            />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">Modified</h4>
                          <div className="rounded-md border bg-muted/10 p-4">
                            <DiffViewer 
                              patch={suggestion.patch}
                              mode="modified"
                              className="max-h-[300px] overflow-auto"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button onClick={handleApplyPatch}>
                          Apply Changes
                        </Button>
                        <div className="flex-1">
                          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.map((branch) => (
                                <SelectItem 
                                  key={`branch-${suggestion.id}-${branch}`} 
                                  value={branch}
                                >
                                  {branch}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          onClick={createBranchAndPR}
                          disabled={!selectedBranch}
                        >
                          Create PR
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}