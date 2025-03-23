import { cn } from '@/lib/utils';

interface StepCardProps {
  number: number;
  title: string;
  description: string;
  className?: string;
}

export function StepCard({ number, title, description, className }: StepCardProps) {
  return (
    <div className={cn(
      "bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg", 
      className
    )}>
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary-100 dark:bg-primary-900 text-primary dark:text-primary-foreground mb-4">
          <span className="text-xl font-bold">{number}</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
          {description}
        </p>
      </div>
    </div>
  );
}
