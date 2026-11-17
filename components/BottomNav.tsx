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
    { view: AppView.TASKS, icon: 'recycling', label: 'المهام' },
    // Center is floating CHAT button
    { view: AppView.REWARDS, icon: 'redeem', label: 'المكافآت' },
    { view: AppView.CHALLENGES, icon: 'emoji_events', label: 'المسابقات' },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white/95 dark:bg-[#162b20]/95 backdrop-blur-md border-t border-emerald-100 dark:border-emerald-950/60 flex justify-around items-center py-2 px-3 z-50 shadow-lg">
      {/* First two items */}
      {navItems.slice(0, 2).map((item) => (
        <button
          key={item.view}
          onClick={() => setActiveView(item.view)}
          className={`flex flex-col items-center flex-1 py-1 transition-all ${
            activeView === item.view ? 'text-primary scale-105' : 'text-gray-400 dark:text-gray-500 hover:text-primary/70'
          }`}
        >
          <Icon name={item.icon} filled={activeView === item.view} className="text-2xl" />
          <span className={`text-[11px] mt-0.5 ${activeView === item.view ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
        </button>
      ))}

      {/* Floating Center AI Mentor Button */}
      <div className="relative -top-5 px-2">
        <button
          onClick={() => setActiveView(AppView.CHAT)}
          className={`size-14 rounded-full shadow-xl flex flex-col items-center justify-center border-4 border-background-light dark:border-background-dark transform transition-all ${
            activeView === AppView.CHAT
              ? 'bg-primary-dark text-white ring-4 ring-primary/30 scale-110'
              : 'bg-primary text-white hover:scale-105 active:scale-95 shadow-primary/40'
          }`}
          title="المرشدة تدويرة"
        >
          <Icon name="smart_toy" className="text-2xl" filled />
          <span className="text-[9px] font-black tracking-tight leading-none">تدويرة</span>
        </button>
      </div>

      {/* Last two items */}
      {navItems.slice(2, 4).map((item) => (
        <button
          key={item.view}
          onClick={() => setActiveView(item.view)}
          className={`flex flex-col items-center flex-1 py-1 transition-all ${
            activeView === item.view ? 'text-primary scale-105' : 'text-gray-400 dark:text-gray-500 hover:text-primary/70'
          }`}
        >
          <Icon name={item.icon} filled={activeView === item.view} className="text-2xl" />
          <span className={`text-[11px] mt-0.5 ${activeView === item.view ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
        </button>
      ))}
    </div>
  );
};
