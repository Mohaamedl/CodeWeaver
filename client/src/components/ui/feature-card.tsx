import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({ icon: Icon, title, description, className }: FeatureCardProps) {
  return (
    <div className={cn(
      "bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg", 
      className
    )}>
      <div className="px-4 py-5 sm:p-6">
        <Icon className="h-8 w-8 text-primary dark:text-primary-foreground mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
          {description}
        </p>
      </div>
    </div>
  );
}
