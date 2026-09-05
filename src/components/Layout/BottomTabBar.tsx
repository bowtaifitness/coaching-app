import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import {
  Home,
  Dumbbell,
  TrendingUp,
  User,
  Users,
  Video,
  BookOpen,
  MoreHorizontal,
  CreditCard,
  BarChart3,
  Settings,
  X,
  UserCheck,
  Tag,
  Mail,
  LogOut,
  History,
  MessageCircle,
} from 'lucide-react';

interface BottomTabBarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ currentView, onViewChange }) => {
  const { user, signOut } = useAuth();
  const unreadCount = useUnreadMessages();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAdmin = user?.email === 'brian@bowtaifitness.com';

  const clientTabs = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'workouts', label: 'Workouts', icon: Dumbbell },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
  ];

  const coachTabs = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
  ];

  const adminTabs = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
  ];

  const coachMoreItems = [
    { id: 'workouts', label: 'Workout Builder', icon: BookOpen },
    { id: 'exercises', label: 'Exercise Library', icon: Dumbbell },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: Settings },
  ];

  const clientMoreItems = [
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'profile', label: 'Profile', icon: Settings },
  ];

  const adminMoreItems = [
    { id: 'workouts', label: 'Workouts', icon: BookOpen },
    { id: 'trainers', label: 'Trainers', icon: UserCheck },
    { id: 'exercises', label: 'Exercise Library', icon: Dumbbell },
    { id: 'invitations', label: 'Invitations', icon: Mail },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'promotions', label: 'Trial & Promotions', icon: Tag },
    { id: 'payments', label: 'Business Analytics', icon: CreditCard },
    { id: 'profile', label: 'Profile', icon: Settings },
  ];

  const tabs = isAdmin ? adminTabs : user?.role === 'coach' ? coachTabs : clientTabs;
  const moreItems = isAdmin ? adminMoreItems : user?.role === 'coach' ? coachMoreItems : clientMoreItems;

  const moreViewIds = moreItems?.map(item => item.id) || [];
  const isMoreActive = moreOpen || moreViewIds.includes(currentView);
  const showMore = true;

  const handleMoreItemClick = (id: string) => {
    setMoreOpen(false);
    onViewChange(id);
  };

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
  };

  return (
    <>
      {moreOpen && showMore && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-base font-semibold text-gray-900">More</h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-3 pb-3 grid grid-cols-3 gap-2">
              {moreItems!.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMoreItemClick(item.id)}
                    className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-colors min-h-[76px]
                      ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Icon className={`h-6 w-6 mb-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className={`text-xs font-medium text-center leading-tight ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-gray-100 mx-3 mt-1">
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[48px]"
              >
                <LogOut className="h-5 w-5 mr-3" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        className="flex-shrink-0 w-full bg-white border-t border-gray-200 lg:hidden z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch justify-around">

          {tabs.map((tab) => {
            const isActive = currentView === tab.id && !moreOpen;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => { setMoreOpen(false); onViewChange(tab.id); }}
                className={`flex flex-col items-center justify-center flex-1 pt-2 pb-1 min-h-[56px] relative transition-colors
                  ${isActive ? 'text-blue-600' : 'text-gray-500 active:text-gray-700'}`}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                  {tab.id === 'messages' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 font-medium leading-tight ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}

          {showMore && (
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex flex-col items-center justify-center flex-1 pt-2 pb-1 min-h-[56px] relative transition-colors
                ${isMoreActive ? 'text-blue-600' : 'text-gray-500 active:text-gray-700'}`}
            >
              <MoreHorizontal className={`h-5 w-5 ${isMoreActive ? 'text-blue-600' : 'text-gray-400'}`} strokeWidth={isMoreActive ? 2.5 : 2} />
              <span className={`text-[10px] mt-0.5 font-medium leading-tight ${isMoreActive ? 'text-blue-600' : 'text-gray-500'}`}>
                More
              </span>
              {isMoreActive && !moreOpen && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          )}
        </div>
      </nav>
    </>
  );
};

export default BottomTabBar;
