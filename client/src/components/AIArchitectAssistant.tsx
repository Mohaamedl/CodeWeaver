import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

interface AIArchitectAssistantProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectStructure: any;
  files: any[];
}

export function AIArchitectAssistant({
  isOpen,
  onOpenChange,
  projectStructure,
  files,
}: AIArchitectAssistantProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialAnalysisDone, setInitialAnalysisDone] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Try WebSocket first
      const ws = new WebSocket('ws://localhost:8000/ws/architect');
      
      ws.onopen = () => {
        console.log('WebSocket Connected');
        setSocket(ws);
        // Send initial structure
        ws.send(JSON.stringify({
          type: 'init',
          structure: projectStructure,
          files: files
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, { role: 'assistant', content: data.suggestions }]);
        setIsLoading(false);
      };

      ws.onerror = () => {
        console.log('WebSocket failed, falling back to HTTP');
        getInitialAnalysis(); // Fallback to HTTP
      };

      ws.onclose = () => {
        console.log('WebSocket Disconnected');
        setSocket(null);
      };

      return () => {
        ws.close();
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !initialAnalysisDone) {
      getInitialAnalysis();
    }
  }, [isOpen]);

  const getInitialAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/architecture/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structure: projectStructure,
          files: files,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');
      
      const data = await response.json();
      setMessages([{ role: 'assistant', content: data.suggestions }]);
      setInitialAnalysisDone(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get initial architecture analysis",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'query',
        query: userMessage,
        files: files
      }));
    } else {
      // Fallback to HTTP
      await sendHttpMessage(userMessage);
    }
  };

  const sendHttpMessage = async (message: string) => {
    try {
      const response = await fetch('http://localhost:8000/architecture/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: message,
          structure: projectStructure,
          files: files,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.suggestions }]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get AI response",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI Architecture Assistant</DialogTitle>
          <DialogDescription>
            Discuss your project's architecture and get suggestions for improvements
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4 border rounded-md mb-4">
          {messages.map((message, i) => (
            <div
              key={i}
              className={`mb-4 p-3 rounded-lg ${
                message.role === 'assistant'
                  ? 'bg-muted/50'
                  : 'bg-primary/10'
              }`}
            >
              <div className="font-semibold mb-1">
                {message.role === 'assistant' ? 'AI Assistant' : 'You'}:
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI is thinking...
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            placeholder="Ask about architecture improvements..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <Button onClick={handleSendMessage} disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AIArchitectAssistant;
