
import React from 'react';
import { AppView } from '../types';
import { Icon } from './Icon';

interface BottomNavProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView }) => {
  const navItems = [
    { view: AppView.HOME, icon: 'grid_view', label: 'الرئيسية' },
    { view: AppView.TASKS, icon: 'checklist_rtl', label: 'مهامي' },
    { view: AppView.CHALLENGES, icon: 'leaderboard', label: 'التحديات' },
    { view: AppView.PROFILE, icon: 'person', label: 'حسابي' },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white/80 dark:bg-[#1a2e1f]/80 backdrop-blur-md border-t border-[#dbe6df] dark:border-[#2a3f30] flex justify-around items-center py-3 px-2 z-50">
      {navItems.map((item) => (
        <button
          key={item.view}
          onClick={() => setActiveView(item.view)}
          className={`flex flex-col items-center flex-1 transition-all ${activeView === item.view ? 'text-primary' : 'text-[#61896f] dark:text-[#a3c3ad]'
            }`}
        >
          <Icon name={item.icon} filled={activeView === item.view} className="text-2xl" />
          <span className="text-[10px] font-bold mt-1">{item.label}</span>
        </button>
      ))}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 md:hidden">
        <button
          onClick={() => setActiveView(AppView.CHAT)}
          className="size-14 bg-primary text-white rounded-full shadow-lg shadow-primary/40 flex items-center justify-center border-4 border-background-light dark:border-background-dark transform hover:scale-110 active:scale-95 transition-transform"
        >
          <Icon name="smart_toy" className="text-3xl" />
        </button>
      </div>
    </div>
  );
};
