import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface DiffViewerProps {
  patch: string;
  className?: string;
  mode?: 'original' | 'modified' | 'unified';
}

export const DiffViewer = ({ patch, className, mode = 'unified' }: DiffViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lineNumbers, setLineNumbers] = useState({ oldStart: 1, newStart: 1 });

  // Parse header line for line numbers
  useEffect(() => {
    const headerLine = patch.split('\n').find(line => line.startsWith('@@'));
    if (headerLine) {
      const match = headerLine.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match) {
        setLineNumbers({
          oldStart: parseInt(match[1]),
          newStart: parseInt(match[3])
        });
      }
    }
  }, [patch]);

  // Get language for syntax highlighting based on file extension
  const getLanguage = () => {
    const fileExtMatch = patch.match(/\+\+\+ b\/.*\.([a-z]+)/i);
    if (fileExtMatch) {
      const ext = fileExtMatch[1].toLowerCase();
      const langMap: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'cs': 'csharp',
        'go': 'go',
        'rb': 'ruby',
        'php': 'php',
        'rs': 'rust',
      };
      return langMap[ext] || 'plaintext';
    }
    return 'plaintext';
  };

  console.log('DiffViewer render:', { mode, patchLength: patch?.length });
  
  // Parse the patch
  const lines = patch.split('\n');
  console.log('Parsed lines:', lines.length);
  
  // Skip the diff headers (first two lines with --- and +++)
  const headerEndIndex = lines.findIndex(line => line.startsWith('@@'));
  const contentLines = headerEndIndex > 0 ? lines.slice(headerEndIndex) : lines;

  return (
    <div className={cn("rounded-lg border bg-[#1E1E1E]", className)}>
      {/* Single scroll container */}
      <div ref={containerRef} className="overflow-auto custom-scrollbar">
        <div className="inline-flex min-w-full">
          {/* Original code */}
          <div className="flex-1 border-r border-[#313131]">
            <div className="sticky top-0 z-10 bg-[#2d2d2d] px-4 py-2 text-sm text-gray-400">
              Original
            </div>
            <div className="p-4">
              {contentLines.map((line, idx) => {
                if (line.startsWith('+')) return null;
                const lineNumber = line.startsWith('-') ? lineNumbers.oldStart + idx : null;
                return (
                  <div 
                    key={`original-${idx}`}
                    className={cn(
                      "font-mono text-sm whitespace-pre leading-6",
                      line.startsWith('-') && "bg-red-950/20 hover:bg-red-950/30"
                    )}
                  >
                    <div className="flex items-start">
                      <span className="w-12 text-right text-gray-500 pr-4 select-none flex-none">
                        {lineNumber}
                      </span>
                      <SyntaxHighlighter
                        language={getLanguage()}
                        style={vscDarkPlus}
                        customStyle={{
                          background: 'transparent',
                          margin: 0,
                          padding: 0,
                          display: 'inline',
                        }}
                      >
                        {line.startsWith('-') ? line.slice(1) : line}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modified code */}
          <div className="flex-1">
            <div className="sticky top-0 z-10 bg-[#2d2d2d] px-4 py-2 text-sm text-gray-400">
              Modified
            </div>
            <div className="p-4">
              {contentLines.map((line, idx) => {
                if (line.startsWith('-')) return null;
                const lineNumber = line.startsWith('+') ? lineNumbers.newStart + idx : null;
                return (
                  <div 
                    key={`modified-${idx}`}
                    className={cn(
                      "font-mono text-sm whitespace-pre leading-6",
                      line.startsWith('+') && "bg-green-950/20 hover:bg-green-950/30"
                    )}
                  >
                    <div className="flex items-start">
                      <span className="w-12 text-right text-gray-500 pr-4 select-none flex-none">
                        {lineNumber}
                      </span>
                      <SyntaxHighlighter
                        language={getLanguage()}
                        style={vscDarkPlus}
                        customStyle={{
                          background: 'transparent',
                          margin: 0,
                          padding: 0,
                          display: 'inline',
                        }}
                      >
                        {line.startsWith('+') ? line.slice(1) : line}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
