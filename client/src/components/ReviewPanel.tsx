import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ReviewSuggestion } from '@/types/review';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface ReviewPanelProps {
  suggestions: ReviewSuggestion[];
  sessionId: number;
}

export const ReviewPanel = ({ suggestions, sessionId }: ReviewPanelProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedSuggestions, setExpandedSuggestions] = useState<number[]>([]);

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
    <div className="space-y-4">
      {suggestions.map((suggestion) => {
        const isExpanded = expandedSuggestions.includes(suggestion.id);
        
        return (
          <Card key={suggestion.id} className="p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                      {suggestion.agent}
                    </span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      suggestion.status === 'pending' && "bg-yellow-500/10 text-yellow-600",
                      suggestion.status === 'applied' && "bg-green-500/10 text-green-600",
                      suggestion.status === 'rejected' && "bg-red-500/10 text-red-600"
                    )}>
                      {suggestion.status}
                    </span>
                  </div>
                  <p className="text-sm">{suggestion.message}</p>
                </div>
              </div>

              {suggestion.patch && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedSuggestions(prev => 
                      isExpanded 
                        ? prev.filter(id => id !== suggestion.id)
                        : [...prev, suggestion.id]
                    )}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {isExpanded ? 'Hide diff' : 'Show diff'}
                  </Button>
                  
                  {isExpanded && (
                    <pre className="mt-2 p-2 text-xs bg-muted rounded overflow-x-auto">
                      {suggestion.patch}
                    </pre>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                File: {suggestion.file_path}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};