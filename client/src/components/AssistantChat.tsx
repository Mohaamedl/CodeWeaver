import React, { useState, useRef, useEffect, ReactElement } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  Send, Bot, User, Loader2, CheckCircle, RefreshCw, Download, 
  Code as CodeIcon, Copy, MessageSquare, FileText, Folder,
  Lightbulb, FileType
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import ExportOptions from '@/components/ExportOptions';
import { AssistantMessageFormat, ExperienceLevel } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AssistantChatProps {
  onComplete?: (plan: any) => void;
}

const AssistantChat = ({ onComplete }: AssistantChatProps) => {
  const [messages, setMessages] = useState<AssistantMessageFormat[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [architecturalPlan, setArchitecturalPlan] = useState('');
  const [starterKit, setStarterKit] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Start conversation mutation
  const startConversation = useMutation({
    mutationFn: async (level: ExperienceLevel) => {
      const response = await apiRequest('POST', '/api/assistant/conversations', { experienceLevel: level });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.conversationId && data.message) {
        setConversationId(data.conversationId);
        setMessages([{ role: 'assistant', content: data.message }]);
      }
    },
    onError: (error) => {
      toast({
        title: 'Failed to start conversation',
        description: 'Please try again later',
        variant: 'destructive',
      });
    },
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ message, convoId }: { message: string; convoId: number }) => {
      const response = await apiRequest('POST', `/api/assistant/conversations/${convoId}/messages`, { message });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.message) {
        setIsTyping(false);
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
        
        // Check if we should generate plan (typically after 10+ messages)
        if (messages.length >= 20) {
          generatePlan.mutate(conversationId as number);
        }
      }
    },
    onError: (error) => {
      setIsTyping(false);
      toast({
        title: 'Failed to send message',
        description: 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // Generate plan mutation
  const generatePlan = useMutation({
    mutationFn: async (convoId: number) => {
      const response = await apiRequest('POST', `/api/assistant/conversations/${convoId}/generate-plan`, {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.architecturalPlan && data.starterKit) {
        setArchitecturalPlan(data.architecturalPlan);
        setStarterKit(data.starterKit);
        setShowResult(true);
        
        if (onComplete) {
          onComplete({
            architecturalPlan: data.architecturalPlan,
            starterKit: data.starterKit,
          });
        }
        
        // Add a final message
        setMessages((prev) => [
          ...prev, 
          { 
            role: 'assistant', 
            content: 'Based on our conversation, I\'ve prepared an architectural plan and initial codebase kit for your project. You can view and export it below.'
          }
        ]);
      }
    },
    onError: (error) => {
      toast({
        title: 'Failed to generate plan',
        description: 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleExperienceSelect = (level: ExperienceLevel) => {
    setExperienceLevel(level);
    startConversation.mutate(level);
  };

  const handleSendMessage = () => {
    if (!userInput.trim() || !conversationId) return;
    
    // Add user message to the list
    setMessages((prev) => [...prev, { role: 'user', content: userInput }]);
    
    // Show typing indicator
    setIsTyping(true);
    
    // Send message to the server
    sendMessage.mutate({ message: userInput, convoId: conversationId });
    
    // Clear input
    setUserInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Function to handle copying code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied!",
      description: "The code has been copied to your clipboard",
    });
  };

  const handleGeneratePlan = () => {
    if (!conversationId) return;
    generatePlan.mutate(conversationId);
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        {/* Introduction */}
        {messages.length === 0 && !experienceLevel && (
          <div className="py-8 max-w-3xl mx-auto">
            <div className="flex justify-center mb-6">
              <Avatar className="h-20 w-20 bg-primary/10">
                <Bot className="h-10 w-10 text-primary" />
              </Avatar>
            </div>
            
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-4">
              CodeWeaver AI Assistant
            </h2>
            
            <p className="text-center text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-8">
              I'll guide you through your software project journey — from architecture planning to implementation details, helping you build better software.
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 text-center">
                Select your experience level to get started
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 cursor-pointer hover:shadow-md transition-all border-2 hover:border-primary"
                  onClick={() => handleExperienceSelect('beginner')}>
                  <div className="text-center">
                    <div className="rounded-full bg-primary/10 h-12 w-12 flex items-center justify-center mx-auto mb-3">
                      <span className="text-primary text-lg font-bold">B</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Beginner</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      New to software development, looking for guidance with basics.
                    </p>
                  </div>
                </Card>
                
                <Card className="p-4 cursor-pointer hover:shadow-md transition-all border-2 hover:border-primary"
                  onClick={() => handleExperienceSelect('intermediate')}>
                  <div className="text-center">
                    <div className="rounded-full bg-primary/10 h-12 w-12 flex items-center justify-center mx-auto mb-3">
                      <span className="text-primary text-lg font-bold">I</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Intermediate</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Familiar with development but seeking to improve architecture skills.
                    </p>
                  </div>
                </Card>
                
                <Card className="p-4 cursor-pointer hover:shadow-md transition-all border-2 hover:border-primary"
                  onClick={() => handleExperienceSelect('advanced')}>
                  <div className="text-center">
                    <div className="rounded-full bg-primary/10 h-12 w-12 flex items-center justify-center mx-auto mb-3">
                      <span className="text-primary text-lg font-bold">A</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Advanced</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Experienced developer looking for expert-level architectural guidance.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
            
            <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
              <p>Just describe your project idea, and I'll help you build it with best practices.</p>
            </div>
          </div>
        )}
        
        {/* Chat History */}
        {messages.length > 0 && (
          <div className="space-y-6 max-h-[400px] overflow-y-auto mb-6 p-1">
            {messages.map((message, index) => {
              // Simple code block detection for rendering
              const hasCodeBlock = message.content.includes('```');
              let formattedContent: string | ReactElement = message.content;
              
              // Process code blocks if present
              if (hasCodeBlock) {
                const parts: ReactElement[] = [];
                let isInCodeBlock = false;
                let language = '';
                
                // Split the message by code block markers
                const segments = message.content.split('```');
                
                segments.forEach((segment, i) => {
                  if (i === 0 && segment) {
                    // Text before the first code block
                    parts.push(<p key={`text-${i}`} className="mb-2">{segment}</p>);
                  } else if (isInCodeBlock) {
                    // This is the content of a code block
                    parts.push(
                      <div key={`code-${i}`} className="relative mb-3 mt-2 font-mono text-sm bg-gray-800 text-gray-200 dark:bg-gray-900 p-3 rounded-md overflow-auto">
                        <div className="absolute right-2 top-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0" 
                            onClick={() => handleCopyCode(segment)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <pre className="whitespace-pre-wrap">{segment}</pre>
                      </div>
                    );
                    isInCodeBlock = false;
                  } else {
                    // Check if there's a language specifier
                    const firstLine = segment.split('\n')[0];
                    language = firstLine ? firstLine.trim() : '';
                    
                    // If there's more content after the language specifier
                    if (segment.includes('\n')) {
                      const codeContent = segment.substring(segment.indexOf('\n')+1);
                      
                      if (i < segments.length - 1) {
                        // We're entering a code block
                        isInCodeBlock = true;
                        
                        // Only add non-empty text parts
                        if (firstLine && firstLine !== language) {
                          parts.push(<p key={`text-${i}`} className="mb-2">{firstLine}</p>);
                        }
                      } else {
                        // Last segment (text after the last code block)
                        parts.push(<p key={`text-${i}`} className="mb-0">{segment}</p>);
                      }
                    } else if (i < segments.length - 1) {
                      isInCodeBlock = true;
                    } else {
                      // Last segment with no newlines
                      parts.push(<p key={`text-${i}`} className="mb-0">{segment}</p>);
                    }
                  }
                });
                
                formattedContent = <>{parts}</>;
              }
              
              return (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 mt-0.5">
                      <Bot className="h-4 w-4" />
                    </Avatar>
                  )}
                  
                  <div
                    className={`
                      px-4 py-3 rounded-xl max-w-[85%] sm:max-w-md
                      ${message.role === 'user' 
                        ? 'bg-primary/10 text-primary-foreground' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm'}
                    `}
                  >
                    {message.role === 'assistant' && (
                      <Badge variant="outline" className="mb-2 bg-primary/5 text-primary text-xs">CodeWeaver AI</Badge>
                    )}
                    
                    <div className="text-sm space-y-2">
                      {hasCodeBlock ? formattedContent : <p className="whitespace-pre-wrap">{message.content}</p>}
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 mt-0.5 bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </Avatar>
                  )}
                </div>
              );
            })}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 mt-0.5">
                  <Bot className="h-4 w-4" />
                </Avatar>
                <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl px-4 py-3 shadow-sm">
                  <Badge variant="outline" className="mb-2 bg-primary/5 text-primary text-xs">CodeWeaver AI</Badge>
                  <div className="flex items-center h-6">
                    <div className="flex space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-500 animate-pulse"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Input area - only show if not displaying results yet */}
        {experienceLevel && !showResult && (
          <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-800">
            <div className="p-3">
              <Textarea
                placeholder="Type your message... (Press Shift+Enter for a new line)"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping || startConversation.isPending || sendMessage.isPending}
                className="min-h-[80px] border-0 focus-visible:ring-0 focus-visible:ring-transparent p-0 resize-none"
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/5 text-primary text-xs">
                  {experienceLevel === 'beginner' && 'Beginner Mode'}
                  {experienceLevel === 'intermediate' && 'Intermediate Mode'}
                  {experienceLevel === 'advanced' && 'Advanced Mode'}
                </Badge>
                {messages.length > 0 && (
                  <Badge variant="outline" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {messages.length} messages
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-gray-500"
                  disabled={isTyping || startConversation.isPending || sendMessage.isPending}
                  onClick={() => setUserInput('')}
                >
                  Clear
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isTyping || startConversation.isPending || sendMessage.isPending}
                  size="sm"
                  className="h-8 px-3"
                >
                  {isTyping || startConversation.isPending || sendMessage.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Show manual generate plan button after enough messages */}
        {experienceLevel && messages.length >= 10 && !showResult && !generatePlan.isPending && (
          <div className="mt-8 mb-2">
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-primary">
                    Ready to generate your architecture plan
                  </h3>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <p>
                      Based on our conversation, I have enough information to generate a detailed architectural plan 
                      and project structure for your application.
                    </p>
                  </div>
                  <div className="mt-4">
                    <Button onClick={handleGeneratePlan} size="sm" className="gap-2">
                      <FileType className="h-4 w-4" />
                      Generate Architecture Plan
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Generate plan loading indicator */}
        {generatePlan.isPending && (
          <div className="mt-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin inline-block" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Generating your architectural plan...
            </p>
          </div>
        )}
        
        {/* Results */}
        {showResult && (
          <div className="mt-8">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 mb-8">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                    Success! Your architectural plan is ready
                  </h3>
                  <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                    <p>
                      We've created a detailed architectural plan and folder structure based on your requirements.
                      You can view everything below or export it in various formats.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Architectural Plan */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Architectural Plan</h3>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0" 
                      onClick={() => {
                        navigator.clipboard.writeText(architecturalPlan || '');
                        toast({
                          title: "Plan copied!",
                          description: "The architectural plan has been copied to your clipboard",
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <ScrollArea className="h-[400px] pr-3">
                    <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {architecturalPlan}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              
              {/* Initial Kit */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <Folder className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Project Structure</h3>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <ScrollArea className="h-[400px]">
                    <div className="pl-2 font-mono text-sm text-gray-800 dark:text-gray-200">
                      {starterKit ? (
                        <div className="space-y-1">
                          {renderFolderStructure(starterKit.folderStructure)}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-40">
                          <p className="text-gray-500 dark:text-gray-400">No folder structure available</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
            
            {/* Export Options */}
            <div className="mt-8">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium flex items-center">
                    <Download className="h-5 w-5 mr-2 text-primary" /> 
                    Export Your Plan
                  </CardTitle>
                  <CardDescription>
                    Save your architectural plan in different formats for future reference
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExportOptions conversationId={conversationId} />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to recursively render folder structure
function renderFolderStructure(structure: any[], indentLevel = 0) {
  if (!structure || !Array.isArray(structure)) return null;
  
  return (
    <div className="pl-4">
      {structure.map((item, index) => (
        <div key={index}>
          <div style={{ marginLeft: `${indentLevel * 6}px` }}>
            {item.type === 'directory' ? (
              <>
                <span>📁 {item.name}/</span>
                {item.children && renderFolderStructure(item.children, indentLevel + 1)}
              </>
            ) : (
              <span>📄 {item.name}{item.description ? ` - ${item.description}` : ''}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AssistantChat;
