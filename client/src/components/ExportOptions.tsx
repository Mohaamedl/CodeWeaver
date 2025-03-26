import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { Code, FileDown, FileText, Loader2 } from 'lucide-react';

interface ExportOptionsProps {
  conversationId: number | null;
  hasPlan?: boolean;
}

const ExportOptions = ({ conversationId, hasPlan = false }: ExportOptionsProps) => {
  const { toast } = useToast();

  const handleExportError = (error: any, format: string) => {
    console.error(`${format} export error:`, error);
    toast({
      title: 'Export failed',
      description: error.message || `Failed to export as ${format}`,
      variant: 'destructive',
    });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const exportPdf = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation ID');
      
      const response = await fetch(`/api/assistant/conversations/${conversationId}/export?format=pdf`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export PDF');
      }
      
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `architectural-plan-${conversationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: 'Export successful',
        description: 'Plan exported as PDF',
      });
    },
    onError: (error: any) => handleExportError(error, 'PDF')
  });

  const exportMarkdown = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation ID');
      
      const response = await fetch(`/api/assistant/conversations/${conversationId}/export?format=markdown`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export Markdown');
      }
      
      return response.blob();
    },
    onSuccess: (blob) => {
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
        description: 'Plan exported as Markdown',
      });
    },
    onError: (error: any) => handleExportError(error, 'Markdown')
  });

  const exportJson = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation ID');
      
      const response = await fetch(`/api/assistant/conversations/${conversationId}/export`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
        body: JSON.stringify({ format: 'json' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export JSON');
      }

      return response.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      downloadBlob(blob, `architectural-plan-${conversationId}.json`);
      toast({
        title: 'Export successful',
        description: 'Plan exported as JSON',
      });
    },
    onError: (error: any) => handleExportError(error, 'JSON')
  });

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Button
        onClick={() => exportPdf.mutate()}
        disabled={exportPdf.isPending || !conversationId || !hasPlan}
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
        disabled={exportMarkdown.isPending || !conversationId || !hasPlan}
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
        disabled={exportJson.isPending || !conversationId || !hasPlan}
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
    </div>
  );
};

export default ExportOptions;
