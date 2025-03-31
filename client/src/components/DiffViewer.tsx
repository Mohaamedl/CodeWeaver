import { cn } from "@/lib/utils";

interface DiffViewerProps {
  patch: string;
  className?: string;
  mode?: 'original' | 'modified' | 'unified';
}

export const DiffViewer = ({ patch, className, mode = 'unified' }: DiffViewerProps) => {
  console.log('DiffViewer render:', { mode, patchLength: patch?.length });
  
  // Parse the patch
  const lines = patch.split('\n');
  console.log('Parsed lines:', lines.length);
  
  // Skip the diff headers (first two lines with --- and +++)
  const headerEndIndex = lines.findIndex(line => line.startsWith('@@'));
  const contentLines = headerEndIndex > 0 ? lines.slice(headerEndIndex) : lines;
  
  // Filter lines based on mode
  const displayLines = contentLines.filter(line => {
    if (mode === 'unified') return true;
    if (mode === 'original' && !line.startsWith('+')) return true;
    if (mode === 'modified' && !line.startsWith('-')) return true;
    return false;
  }).map(line => {
    // For non-unified mode, remove the first character (+ or -) for cleaner display
    if (mode !== 'unified') {
      if (line.startsWith('+') || line.startsWith('-')) {
        return line.slice(1);
      }
    }
    return line;
  });

  // Logging stats for debugging
  console.log('Display lines:', {
    total: displayLines.length,
    additions: contentLines.filter(l => l.startsWith('+')).length,
    deletions: contentLines.filter(l => l.startsWith('-')).length,
    other: contentLines.filter(l => !l.startsWith('+') && !l.startsWith('-')).length
  });

  return (
    <div className={cn("rounded-lg border bg-muted/10", className)}>
      <div className="overflow-x-auto">
        <pre className="text-sm font-mono leading-6 p-2 w-full">
          {displayLines.map((line, idx) => {
            if (!line && line !== '') return null;
            
            const isAddition = line.startsWith('+');
            const isDeletion = line.startsWith('-');
            const isHeader = line.startsWith('@@') || line.startsWith('diff');
            
            return (
              <div
                key={`${mode}-${idx}-${line.slice(0, 20)}`}
                className={cn(
                  "whitespace-pre-wrap break-all",
                  isHeader && "bg-muted/20 text-muted-foreground/60 italic",
                  isAddition && "bg-emerald-500/10 text-emerald-600",
                  isDeletion && "bg-red-500/10 text-red-600",
                )}
              >
                {line}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};

function getLineNumbers(patch: string): [number, number] {
  const match = patch.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
  console.log('Patch header match:', match);
  return match ? [parseInt(match[1]), parseInt(match[2])] : [1, 1];
}
function getLineNumber(idx: number, isAdd: boolean, isDel: boolean, oldStart: number, newStart: number): number {
  if (isAdd) return newStart++;
  if (isDel) return oldStart++;
  return isDel ? oldStart++ : newStart++;
}
