import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/components/Notification';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header = () => {
  const [location] = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isAuthenticated, user, login, logout, isLoading } = useAuth();
  const { showNotification } = useNotification();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCodebaseAnalysisClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      showNotification('Please connect with GitHub first', 'error');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <svg className="h-8 w-8 text-primary dark:text-primary-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-white">CodeWeaver</span>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link href="/">
                <span className={`${location === '/' ? 'border-primary text-primary dark:text-primary-foreground' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer`}>
                  Home
                </span>
              </Link>
              <Link href="/codebase">
                <span 
                  className={`${location === '/codebase' ? 'border-primary text-primary dark:text-primary-foreground' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer`}
                  onClick={handleCodebaseAnalysisClick}
                >
                  Codebase Analysis
                </span>
              </Link>
              <Link href="/assistant">
                <span className={`${location === '/assistant' ? 'border-primary text-primary dark:text-primary-foreground' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer`}>
                  Assistant
                </span>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="ml-3 p-1 rounded-full text-gray-500 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800"
            >
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            
            {/* Mobile menu button */}
            <div className="sm:hidden ml-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              >
                <span className="sr-only">{mobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
                {mobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
            
            {/* Authentication */}
            {!isLoading && (
              <>
                {!isAuthenticated ? (
                  <Button
                    onClick={login}
                    className="ml-4"
                  >
                    Sign in
                  </Button>
                ) : (
                  <div className="ml-3 relative">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src="https://github.com/identicons/jasonm23.png" alt={user?.username || 'User'} />
                            <AvatarFallback>{user?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <div className="flex items-center justify-start gap-2 p-2">
                          <div className="flex flex-col space-y-1 leading-none">
                            {user?.githubUsername && (
                              <p className="font-medium">{user.githubUsername}</p>
                            )}
                            <p className="w-[200px] truncate text-sm text-muted-foreground">
                              {user?.username}
                            </p>
                          </div>
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout}>
                          Log out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <Link href="/">
              <span
                className={`${
                  location === '/'
                    ? 'bg-primary-50 border-primary text-primary'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium dark:text-gray-200 dark:hover:bg-gray-700 cursor-pointer`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </span>
            </Link>
            <Link href="/codebase">
              <span
                className={`${
                  location === '/codebase'
                    ? 'bg-primary-50 border-primary text-primary'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium dark:text-gray-200 dark:hover:bg-gray-700 cursor-pointer`}
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  handleCodebaseAnalysisClick(e);
                }}
              >
                Codebase Analysis
              </span>
            </Link>
            <Link href="/assistant">
              <span
                className={`${
                  location === '/assistant'
                    ? 'bg-primary-50 border-primary text-primary'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium dark:text-gray-200 dark:hover:bg-gray-700 cursor-pointer`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Assistant
              </span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
