import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ReviewSuggestion } from '@/types/review';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';

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
      const response = await fetch('/api/github/branches');
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

  const renderDiff = (patch: string) => {
    const lines = patch.split('\n');
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded">
          <h4 className="font-semibold mb-2">Original</h4>
          {lines.map((line, i) => (
            line.startsWith('-') && (
              <div key={i} className="text-red-600 dark:text-red-400">
                {line.slice(1)}
              </div>
            )
          ))}
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded">
          <h4 className="font-semibold mb-2">Modified</h4>
          {lines.map((line, i) => (
            line.startsWith('+') && (
              <div key={i} className="text-green-600 dark:text-green-400">
                {line.slice(1)}
              </div>
            )
          ))}
        </div>
      </div>
    );
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
    <Card>
      <CardHeader>
        <CardTitle>Code Review Suggestions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`p-4 rounded-lg border ${
                selectedSuggestion === suggestion.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{suggestion.agent}</h3>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.message}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSuggestion(suggestion.id)}
                >
                  {selectedSuggestion === suggestion.id ? 'Selected' : 'Select'}
                </Button>
              </div>

              {selectedSuggestion === suggestion.id && suggestion.patch && (
                <div className="mt-4">
                  {renderDiff(suggestion.patch)}
                  <div className="mt-4 flex gap-2">
                    <Button onClick={handleApplyPatch}>Apply Changes</Button>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="w-[200px]">
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
                    <Button 
                      onClick={createBranchAndPR}
                      disabled={!selectedBranch}
                    >
                      Create Branch & PR
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}