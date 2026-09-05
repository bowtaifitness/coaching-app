import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, User } from 'lucide-react';

interface NavbarProps {
  onMenuToggle: () => void;
  onNavigate?: (view: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuToggle, onNavigate }) => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav
      className="bg-white shadow-lg border-b border-gray-100 sticky top-0 z-40"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center">
            <button
              onClick={() => onNavigate?.('dashboard')}
              className="flex-shrink-0 flex items-center hover:opacity-80 transition-opacity touch-manipulation"
              title="Go to Dashboard"
            >
              <img
                src="/logo.jpg"
                alt="Bowtai Fitness"
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover"
              />
              <span className="ml-2 text-base sm:text-xl font-bold text-gray-900">
                Bowtai Fitness
              </span>
            </button>
          </div>

          <div className="hidden lg:flex items-center space-x-3">
            <button
              onClick={() => onNavigate?.('profile')}
              className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg p-2 transition-colors touch-manipulation"
              title="Profile"
            >
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-xs text-gray-500 capitalize leading-tight">
                  {user?.role === 'admin' ? 'Administrator' : user?.role}
                </span>
              </div>
            </button>
            <button
              onClick={handleSignOut}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => onNavigate?.('profile')}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
              title="Profile"
            >
              <User className="h-5 w-5" />
            </button>
            <button
              onClick={handleSignOut}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
