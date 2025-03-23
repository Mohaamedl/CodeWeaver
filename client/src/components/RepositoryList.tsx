import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Folder, Search, SortAsc, SortDesc } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { GitHubRepository } from '@shared/schema';

type SortField = 'name' | 'updated_at' | 'language';
type SortDirection = 'asc' | 'desc';

interface RepositoryListProps {
  onRepositorySelect: (repository: GitHubRepository) => void;
}

const RepositoryList = ({ onRepositorySelect }: RepositoryListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/repositories'],
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filterRepositories = (repos: GitHubRepository[]) => {
    if (!searchQuery) return repos;
    
    const lowerCaseQuery = searchQuery.toLowerCase();
    return repos.filter(repo => 
      repo.name.toLowerCase().includes(lowerCaseQuery) || 
      (repo.description && repo.description.toLowerCase().includes(lowerCaseQuery))
    );
  };

  const sortRepositories = (repos: GitHubRepository[]) => {
    return [...repos].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'updated_at') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      } else if (sortField === 'language') {
        comparison = (a.language || '').localeCompare(b.language || '');
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const renderLanguageBadge = (language: string | null) => {
    if (!language) return null;
    
    const languageColors: Record<string, string> = {
      JavaScript: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      TypeScript: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      Python: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      Java: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'C#': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      PHP: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      Ruby: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      Go: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      Rust: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    
    const colorClass = languageColors[language] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    
    return (
      <Badge variant="outline" className={colorClass}>
        {language}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading repositories...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 dark:text-red-400">
        Error loading repositories. Please try again.
      </div>
    );
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400">
        No repositories found. Connect with GitHub to see your repositories.
      </div>
    );
  }

  const repositories = sortRepositories(filterRepositories(data));

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 shadow px-4 py-5 sm:rounded-lg sm:p-6 mb-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Your Repositories</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
              Choose a repository to analyze its structure and get improvement suggestions.
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <div className="relative rounded-md shadow-sm">
              <Input
                type="text"
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
            <div className="ml-3">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="focus:ring-primary focus:border-primary h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 dark:text-gray-300 sm:text-sm rounded-md"
              >
                <option value="name">Sort by Name</option>
                <option value="updated_at">Sort by Date</option>
                <option value="language">Sort by Language</option>
              </select>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="ml-3"
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              {sortDirection === 'asc' ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <div className="shadow overflow-hidden border-b border-gray-200 dark:border-gray-700 sm:rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => handleSort('name')} className="cursor-pointer">
                      Repository
                      {sortField === 'name' && (
                        sortDirection === 'asc' ? <SortAsc className="inline h-4 w-4 ml-1" /> : <SortDesc className="inline h-4 w-4 ml-1" />
                      )}
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead onClick={() => handleSort('language')} className="cursor-pointer">
                      Language
                      {sortField === 'language' && (
                        sortDirection === 'asc' ? <SortAsc className="inline h-4 w-4 ml-1" /> : <SortDesc className="inline h-4 w-4 ml-1" />
                      )}
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Analyze</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repositories.map((repo) => (
                    <TableRow key={repo.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-primary-100 dark:bg-primary-900 text-primary dark:text-primary-foreground">
                            <Folder className="h-6 w-6" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{repo.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Updated {formatDistanceToNow(new Date(repo.updated_at))} ago
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{repo.description || 'No description'}</div>
                      </TableCell>
                      <TableCell>
                        {renderLanguageBadge(repo.language)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={repo.private ? 'destructive' : 'success'}>
                          {repo.private ? 'Private' : 'Public'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="link" 
                          onClick={() => onRepositorySelect(repo)}
                        >
                          Analyze
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepositoryList;
