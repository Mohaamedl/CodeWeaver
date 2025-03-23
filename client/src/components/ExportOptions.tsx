import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileDown, FileText, Code, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ExportOptionsProps {
  conversationId: number | null;
}

const ExportOptions = ({ conversationId }: ExportOptionsProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportPdf = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation ID');
      
      const response = await fetch(`/api/assistant/conversations/${conversationId}/export?format=markdown`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to export PDF');
      }
      
      return response.blob();
    },
    onSuccess: (blob) => {
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `architectural-plan-${conversationId}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Export successful',
        description: 'Architectural plan exported as Markdown',
      });
    },
    onError: (error) => {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export architectural plan',
        variant: 'destructive',
      });
    },
  });

  const exportMarkdown = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation ID');
      
      const response = await fetch(`/api/assistant/conversations/${conversationId}/export?format=markdown`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to export Markdown');
      }
      
      return response.blob();
    },
    onSuccess: (blob) => {
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `architectural-plan-${conversationId}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Export successful',
        description: 'Architectural plan exported as Markdown',
      });
    },
    onError: (error) => {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export architectural plan',
        variant: 'destructive',
      });
    },
  });

  const exportJson = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation ID');
      
      const response = await fetch(`/api/assistant/conversations/${conversationId}/export?format=json`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to export JSON');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Create a download link with JSON content
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `architectural-plan-${conversationId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Export successful',
        description: 'Architectural plan exported as JSON',
      });
    },
    onError: (error) => {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export architectural plan',
        variant: 'destructive',
      });
    },
  });

  const handleDownloadStarterKit = () => {
    if (!conversationId) {
      toast({
        title: 'Export failed',
        description: 'No conversation ID available',
        variant: 'destructive',
      });
      return;
    }
    
    toast({
      title: 'Feature coming soon',
      description: 'Starter kit download will be available in a future update',
    });
  };

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Button
        onClick={() => exportPdf.mutate()}
        disabled={exportPdf.isPending || !conversationId}
        className="flex items-center"
      >
        {exportPdf.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="mr-2 h-4 w-4" />
        )}
        Export as PDF
      </Button>

      <Button
        onClick={() => exportMarkdown.mutate()}
        disabled={exportMarkdown.isPending || !conversationId}
        variant="secondary"
        className="flex items-center"
      >
        {exportMarkdown.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Export as Markdown
      </Button>

      <Button
        onClick={() => exportJson.mutate()}
        disabled={exportJson.isPending || !conversationId}
        variant="outline"
        className="flex items-center"
      >
        {exportJson.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Code className="mr-2 h-4 w-4" />
        )}
        Export as JSON
      </Button>

      <Button
        onClick={handleDownloadStarterKit}
        disabled={!conversationId}
        variant="outline"
        className="flex items-center"
      >
        <FileDown className="mr-2 h-4 w-4" />
        Download Starter Kit
      </Button>
    </div>
  );
};

export default ExportOptions;
