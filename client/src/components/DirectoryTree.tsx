import { useState } from 'react';
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  sha?: string;
  children?: TreeNode[];
};

type DirectoryTreeProps = {
  owner: string;
  repo: string;
  onFileSelect?: (path: string) => void;
};

const DirectoryTreeNode = ({ node, level = 0, owner, repo, onFileSelect }: { 
  node: TreeNode; 
  level?: number; 
  owner: string;
  repo: string;
  onFileSelect?: (path: string) => void;
}) => {
  const [expanded, setExpanded] = useState(level < 1);
  
  const handleToggle = () => {
    setExpanded(!expanded);
  };
  
  const handleFileClick = () => {
    if (node.type === 'file' && onFileSelect) {
      onFileSelect(node.path);
    }
  };
  
  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return '';
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="font-mono text-sm">
      <div 
        className={cn(
          "flex items-center py-1",
          node.type === 'file' && "hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer",
        )}
        onClick={node.type === 'file' ? handleFileClick : undefined}
      >
        {node.type === 'directory' && (
          <button onClick={handleToggle} className="focus:outline-none">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            )}
          </button>
        )}
        
        {node.type === 'directory' ? (
          <Folder className="h-5 w-5 ml-1 text-gray-400 dark:text-gray-500" />
        ) : (
          <File className="h-5 w-5 ml-5 text-gray-400 dark:text-gray-500" />
        )}
        
        <span className="ml-1 text-gray-900 dark:text-white">
          {node.name}{node.type === 'directory' ? '/' : ''}
        </span>
        
        {node.type === 'file' && node.size !== undefined && (
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            ({formatFileSize(node.size)})
          </span>
        )}
      </div>
      
      {expanded && node.type === 'directory' && node.children && (
        <div className="ml-5 border-l border-gray-200 dark:border-gray-700">
          {node.children
            .sort((a, b) => {
              // Directories first, then files, then alphabetical
              if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <DirectoryTreeNode
                key={child.path}
                node={child}
                level={level + 1}
                owner={owner}
                repo={repo}
                onFileSelect={onFileSelect}
              />
            ))}
        </div>
      )}
    </div>
  );
};

const DirectoryTree = ({ owner, repo, onFileSelect }: DirectoryTreeProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/repository/${owner}/${repo}/tree`],
    enabled: !!owner && !!repo,
  });

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading repository structure...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 dark:text-red-400">
        Error loading repository structure. Please try again.
      </div>
    );
  }

  if (!data || !data.children) {
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400">
        No repository structure available.
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <DirectoryTreeNode 
        node={{ 
          name: repo, 
          path: '', 
          type: 'directory', 
          children: data.children 
        }}
        owner={owner}
        repo={repo}
        onFileSelect={onFileSelect}
      />
    </div>
  );
};

export default DirectoryTree;
