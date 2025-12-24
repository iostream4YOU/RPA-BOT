import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Moon, 
  Sun, 
  Menu,
  ShieldCheck,
  Activity,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout({ children, currentPageName }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '' },
    { name: 'Audit Logs', icon: ShieldCheck, path: 'audit-logs' },
    { name: 'Settings', icon: Settings, path: 'settings' },
  ];

  return (
    <div className={`min-h-screen flex bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300 font-sans`}>
      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800
          transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'w-64' : 'w-20'} 
          hidden md:flex flex-col
        `}
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-slate-800 px-4">
           <div className="flex items-center gap-2 font-bold text-xl text-indigo-600 dark:text-indigo-400 overflow-hidden whitespace-nowrap">
              <Activity className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span>RPA Control</span>}
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link 
              key={item.name} 
              to={createPageUrl(item.path)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                ${currentPageName === item.name 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400'}
                ${!isSidebarOpen && 'justify-center'}
              `}
              title={item.name}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">{item.name}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-slate-800">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="w-full flex justify-center hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg h-10"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </aside>
      
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
