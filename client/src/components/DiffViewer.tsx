import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface DiffViewerProps {
  patch: string;
  className?: string;
}

interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: { content: string; type: 'unchanged' | 'deleted' }[];
  newStart: number;
  newLines: { content: string; type: 'unchanged' | 'added' }[];
}

export const DiffViewer = ({ patch, className }: DiffViewerProps) => {
  const [hunks, setHunks] = useState<DiffHunk[]>([]);

  // Parse diff into hunks
  useEffect(() => {
    if (!patch) return;

    const lines = patch.split('\n');
    const parsedHunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;

    for (const line of lines) {
      // Parse hunk header
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
        if (match) {
          if (currentHunk) parsedHunks.push(currentHunk);
          currentHunk = {
            header: line,
            oldStart: parseInt(match[1]),
            oldLines: [],
            newStart: parseInt(match[3]),
            newLines: []
          };
        }
        continue;
      }

      if (!currentHunk) continue;

      // Skip file headers
      if (line.startsWith('---') || line.startsWith('+++')) continue;

      // Parse content lines
      if (line.startsWith('-')) {
        currentHunk.oldLines.push({ content: line.slice(1), type: 'deleted' });
      } else if (line.startsWith('+')) {
        currentHunk.newLines.push({ content: line.slice(1), type: 'added' });
      } else if (line.startsWith(' ')) {
        const content = line.slice(1);
        currentHunk.oldLines.push({ content, type: 'unchanged' });
        currentHunk.newLines.push({ content, type: 'unchanged' });
      }
    }

    if (currentHunk) parsedHunks.push(currentHunk);
    setHunks(parsedHunks);
  }, [patch]);

  return (
    <div className={cn("grid grid-cols-2 gap-4 rounded-lg border bg-[#1E1E1E]", className)}>
      {/* Original Code */}
      <div className="border-r border-[#313131]">
        <div className="sticky top-0 z-10 bg-[#2d2d2d] px-4 py-2 text-sm text-gray-400">
          Original
        </div>
        <div className="overflow-auto">
          <pre className="p-4 font-mono text-sm">
            {hunks.map((hunk, i) => (
              <div key={`old-${i}`}>
                <div className="text-xs text-gray-500 mb-2">{hunk.header}</div>
                {hunk.oldLines.map((line, j) => (
                  <div
                    key={`old-${i}-${j}`}
                    className={cn(
                      "flex",
                      line.type === 'deleted' && "bg-red-950/20 text-red-400"
                    )}
                  >
                    <span className="w-12 text-right text-gray-500 pr-4 select-none">
                      {hunk.oldStart + j}
                    </span>
                    <span className="flex-1">{line.content}</span>
                  </div>
                ))}
              </div>
            ))}
          </pre>
        </div>
      </div>

      {/* Modified Code */}
      <div>
        <div className="sticky top-0 z-10 bg-[#2d2d2d] px-4 py-2 text-sm text-gray-400">
          Modified
        </div>
        <div className="overflow-auto">
          <pre className="p-4 font-mono text-sm">
            {hunks.map((hunk, i) => (
              <div key={`new-${i}`}>
                <div className="text-xs text-gray-500 mb-2">{hunk.header}</div>
                {hunk.newLines.map((line, j) => (
                  <div
                    key={`new-${i}-${j}`}
                    className={cn(
                      "flex",
                      line.type === 'added' && "bg-green-950/20 text-green-400"
                    )}
                  >
                    <span className="w-12 text-right text-gray-500 pr-4 select-none">
                      {hunk.newStart + j}
                    </span>
                    <span className="flex-1">{line.content}</span>
                  </div>
                ))}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
};
