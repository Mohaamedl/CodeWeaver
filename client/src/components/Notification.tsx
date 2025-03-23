import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle } from 'lucide-react';

type NotificationType = 'success' | 'error';

type NotificationContextType = {
  showNotification: (message: string, type: NotificationType) => void;
  hideNotification: () => void;
};

const NotificationContext = createContext<NotificationContextType>({
  showNotification: () => {},
  hideNotification: () => {},
});

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('success');
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [timer]);

  const showNotification = (message: string, type: NotificationType) => {
    setMessage(message);
    setType(type);
    setVisible(true);
    
    // Clear any existing timer
    if (timer) clearTimeout(timer);
    
    // Auto-hide after 3 seconds
    const newTimer = setTimeout(() => {
      hideNotification();
    }, 3000);
    
    setTimer(newTimer);
  };

  const hideNotification = () => {
    setVisible(false);
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        hideNotification,
      }}
    >
      {children}
      
      {/* Notification component */}
      {visible && (
        <div 
          className="fixed bottom-4 right-4 z-50 transform transition-all duration-300 ease-out"
          aria-live="assertive"
        >
          <div 
            className={cn(
              "p-4 rounded-md shadow-lg",
              type === 'success' ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'
            )}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-400 dark:text-green-300" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
                )}
              </div>
              <div className="ml-3">
                <p 
                  className={cn(
                    "text-sm font-medium",
                    type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                  )}
                >
                  {message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
