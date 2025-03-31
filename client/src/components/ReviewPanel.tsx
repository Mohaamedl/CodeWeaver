import { DiffViewer } from '@/components/DiffViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
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
  const { githubAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSuggestions, setSelectedSuggestions] = useState<number[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branches, setBranches] = useState<string[]>([]);
  const [isCompareDialogOpen, setIsCompareDialogOpen] = useState(false);

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

  const handleApplyPatch = async (suggestionId: number) => {
    if (!githubAccessToken) {
      toast({
        title: "Error",
        description: "GitHub token not found. Please log in.",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedRepo = localStorage.getItem('selectedRepo');
      if (!selectedRepo) {
        throw new Error('No repository selected');
      }
      const { owner, repo } = JSON.parse(selectedRepo);

      const response = await fetch('/api/github/apply-patch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${githubAccessToken}`
        },
        body: JSON.stringify({
          suggestion_id: suggestionId,
          owner,
          repo
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.detail || 'Failed to apply patch');
      }
      
      toast({
        title: "Success",
        description: "Patch applied successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to apply patch",
        variant: "destructive",
      });
    }
  };

  const createBranchAndPR = async () => {
    if (selectedSuggestions.length === 0 || !selectedBranch || !githubAccessToken) {
      toast({
        title: "Error",
        description: "Please select a branch and make sure you're logged in",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedRepo = localStorage.getItem('selectedRepo');
      if (!selectedRepo) {
        throw new Error('No repository selected');
      }
      const { owner, repo } = JSON.parse(selectedRepo);
      
      // Create a new branch
      const branchResponse = await fetch('/api/github/create-branch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${githubAccessToken}`
        },
        body: JSON.stringify({
          owner,
          repo,
          baseBranch: selectedBranch,
          suggestionId: selectedSuggestions[0], // For now, use first suggestion
        }),
      });

      if (!branchResponse.ok) {
        const error = await branchResponse.json();
        throw new Error(error.message || error.detail || 'Failed to create branch');
      }

      const branchData = await branchResponse.json();

      // Create PR
      const prResponse = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${githubAccessToken}`
        },
        body: JSON.stringify({
          owner,
          repo,
          baseBranch: selectedBranch,
          suggestionId: selectedSuggestions[0], // For now, use first suggestion
        }),
      });

      if (!prResponse.ok) {
        const error = await prResponse.json();
        throw new Error(error.message || error.detail || 'Failed to create PR');
      }

      const prData = await prResponse.json();

      toast({
        title: "Success",
        description: "Branch created and PR opened",
      });

      // Open PR in new tab
      if (prData.pr_url) {
        window.open(prData.pr_url, '_blank');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create branch and PR",
        variant: "destructive",
      });
    }
  };

  const handleSuggestionSelect = (suggestionId: number) => {
    setSelectedSuggestions(prev => {
      const isSelected = prev.includes(suggestionId);
      if (isSelected) {
        return prev.filter(id => id !== suggestionId);
      } else {
        return [...prev, suggestionId];
      }
    });
  };

  const getSelectedSuggestions = () => {
    return suggestions.filter(s => selectedSuggestions.includes(s.id));
  };

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
    <>
      <Card className="h-full overflow-auto">
        <CardHeader className="sticky top-0 z-10 bg-background border-b">
          <CardTitle className="flex items-center justify-between">
            <span>Code Review Suggestions ({suggestions.length})</span>
            {selectedSuggestions.length > 0 && (
              <Button onClick={() => setIsCompareDialogOpen(true)}>
                Compare Selected ({selectedSuggestions.length})
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {suggestions.map((suggestion) => (
              <Card 
                key={`suggestion-${suggestion.id}-${suggestion.file_path}`}
                className={cn(
                  "transition-colors",
                  selectedSuggestions.includes(suggestion.id) && "border-primary bg-primary/5"
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
                        variant={selectedSuggestions.includes(suggestion.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSuggestionSelect(suggestion.id)}
                      >
                        {selectedSuggestions.includes(suggestion.id) ? 'Selected' : 'Select'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Dialog */}
      <Dialog open={isCompareDialogOpen} onOpenChange={setIsCompareDialogOpen}>
        <DialogContent className="max-w-7xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Compare Selected Changes</DialogTitle>
            <DialogDescription>
              Review the selected changes and create a pull request to apply them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-8 overflow-auto pr-4">
            {getSelectedSuggestions().map((suggestion) => (
              <div key={suggestion.id} className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">{suggestion.agent}</h3>
                    <p className="text-sm text-muted-foreground">{suggestion.message}</p>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {suggestion.file_path}
                    </code>
                  </div>
                  <Button onClick={() => handleApplyPatch(suggestion.id)}>
                    Apply Changes
                  </Button>
                </div>
                {suggestion.patch && (
                  <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/5">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Original</h4>
                      <div className="rounded-md border bg-background p-4 overflow-auto max-h-[500px]">
                        <DiffViewer 
                          patch={suggestion.patch}
                          mode="original"
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Modified</h4>
                      <div className="rounded-md border bg-background p-4 overflow-auto max-h-[500px]">
                        <DiffViewer 
                          patch={suggestion.patch}
                          mode="modified"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {selectedSuggestions.length > 0 && (
              <div className="sticky bottom-0 bg-background p-4 border-t flex items-center gap-4">
                <div className="flex-1">
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select base branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={createBranchAndPR}
                  disabled={!selectedBranch || !githubAccessToken}
                >
                  Create PR with Selected Changes
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}