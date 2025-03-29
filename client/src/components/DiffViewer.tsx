import { cn } from "@/lib/utils";

interface DiffViewerProps {
  patch: string;
  className?: string;
}

export const DiffViewer = ({ patch, className }: DiffViewerProps) => {
  const lines = patch.split('\n');
  
  return (
    <div className={cn("rounded-md border bg-muted/50", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <tbody>
            {lines.map((line, idx) => {
              const isAddition = line.startsWith('+');
              const isDeletion = line.startsWith('-');
              const isHeader = line.startsWith('@@') || line.startsWith('diff') || line.startsWith('index');

              return (
                <tr 
                  key={idx}
                  className={cn(
                    "leading-6",
                    isHeader && "bg-muted/50 text-muted-foreground",
                    isAddition && "bg-green-500/10",
                    isDeletion && "bg-red-500/10"
                  )}
                >
                  <td className="w-[1%] whitespace-nowrap pl-2 pr-3 text-right text-sm select-none text-muted-foreground">
                    {!isHeader && (
                      <span className={cn(
                        isAddition && "text-green-600",
                        isDeletion && "text-red-600"
                      )}>
                        {isAddition ? '+' : isDeletion ? '-' : ' '}
                      </span>
                    )}
                  </td>
                  <td className={cn(
                    "whitespace-pre px-2",
                    isAddition && "text-green-600",
                    isDeletion && "text-red-600",
                    isHeader && "text-muted-foreground"
                  )}>
                    {line.slice(isHeader ? 0 : 1)}
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