import { cn } from "@/lib/utils";

interface DiffViewerProps {
  patch: string;
  className?: string;
  mode?: 'original' | 'modified' | 'unified';
}

export const DiffViewer = ({ patch, className, mode = 'unified' }: DiffViewerProps) => {
  console.log('DiffViewer render:', { mode, patchLength: patch?.length });
  
  const lines = patch.split('\n');
  console.log('Parsed lines:', lines.length);
  
  const [oldStart, newStart] = getLineNumbers(patch);
  console.log('Line numbers:', { oldStart, newStart });
  
  // Filter lines based on mode
  const displayLines = lines.filter(line => {
    if (mode === 'unified') return true;
    if (mode === 'original') return !line.startsWith('+');
    if (mode === 'modified') return !line.startsWith('-');
    return true;
  });

  console.log('Display lines:', {
    total: displayLines.length,
    additions: displayLines.filter(l => l.startsWith('+')).length,
    deletions: displayLines.filter(l => l.startsWith('-')).length,
    other: displayLines.filter(l => !l.startsWith('+') && !l.startsWith('-')).length
  });

  return (
    <div className={cn("rounded-lg border bg-muted/10", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono leading-6">
          <tbody>
            {displayLines.map((line, idx) => {
              if (!line) return null;
              
              const isAddition = line.startsWith('+');
              const isDeletion = line.startsWith('-');
              const isHeader = line.startsWith('@@') || line.startsWith('diff');
              const key = `${mode}-${idx}-${line.slice(0, 20)}`;
              const lineNum = getLineNumber(idx, isAddition, isDeletion, oldStart, newStart);

              // Skip lines based on mode
              if (mode === 'original' && isAddition) return null;
              if (mode === 'modified' && isDeletion) return null;

              return (
                <tr 
                  key={key}
                  className={cn(
                    isHeader && "bg-muted/20",
                    isAddition && "bg-emerald-500/10",
                    isDeletion && "bg-red-500/10",
                  )}
                >
                  <td className="select-none pl-4 pr-4 text-right tabular-nums text-muted-foreground/40">
                    {!isHeader && lineNum}
                  </td>
                  <td className="select-none px-2 text-muted-foreground">
                    {!isHeader && (
                      <span className={cn(
                        isAddition && "text-emerald-600",
                        isDeletion && "text-red-600"
                      )}>
                        {isAddition ? '+' : isDeletion ? '-' : ' '}
                      </span>
                    )}
                  </td>
                  <td 
                    className={cn(
                      "pr-4 whitespace-pre",
                      isHeader && "text-muted-foreground/60 italic",
                      isAddition && "text-emerald-600",
                      isDeletion && "text-red-600"
                    )}
                  >
                    {isHeader ? line : line.slice(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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