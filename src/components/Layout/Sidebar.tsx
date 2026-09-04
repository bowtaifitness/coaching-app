import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import {
  Home,
  Dumbbell,
  Users,
  BarChart3,
  CreditCard,
  BookOpen,
  TrendingUp,
  Settings,
  UserCheck,
  Tag,
  Mail,
  Video,
  History,
  MessageCircle
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, isOpen }) => {
  const { user } = useAuth();
  const unreadCount = useUnreadMessages();

  // Check if user is admin by email
  const isAdmin = user?.email === 'brian@bowtaifitness.com';
  
  const adminMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'trainers', label: 'Trainers', icon: UserCheck },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'invitations', label: 'Invitations', icon: Mail },
    { id: 'exercises', label: 'Exercise Library', icon: Dumbbell },
    { id: 'workouts', label: 'All Workouts', icon: BookOpen },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'promotions', label: 'Trial & Promotions', icon: Tag },
    { id: 'payments', label: 'Business Analytics', icon: CreditCard },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'profile', label: 'Profile', icon: Settings },
  ];

  const coachMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'exercises', label: 'Exercise Library', icon: Dumbbell },
    { id: 'workouts', label: 'Workout Builder', icon: BookOpen },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'profile', label: 'Profile', icon: Settings },
  ];

  const clientMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'workouts', label: 'My Workouts', icon: Dumbbell },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'profile', label: 'Profile', icon: Settings },
  ];

  const menuItems = isAdmin ? adminMenuItems : 
                   user?.role === 'coach' ? coachMenuItems : clientMenuItems;

  return (
    <aside className={`bg-white border-r border-gray-200 transition-all duration-300 safe-left hidden lg:flex lg:flex-col shrink-0 ${
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    } fixed lg:relative z-30 h-full lg:w-56 xl:w-64`}>
      <div className="flex-1 overflow-y-auto py-4 px-3 lg:px-4 safe-bottom">
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center px-3 py-3 min-h-[44px] rounded-lg text-left transition-all duration-200 touch-manipulation ${
                currentView === item.id
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md shadow-green-500/20'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-green-700'
              }`}
            >
              <item.icon className={`h-[18px] w-[18px] mr-3 shrink-0 ${
                currentView === item.id ? 'text-white' : 'text-gray-400'
              }`} />
              <span className="font-medium text-sm flex-1">{item.label}</span>
              {item.id === 'messages' && unreadCount > 0 && (
                <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  currentView === item.id
                    ? 'bg-white/20 text-white'
                    : 'bg-red-500 text-white'
                }`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;