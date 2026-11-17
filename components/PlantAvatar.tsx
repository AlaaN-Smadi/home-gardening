import React from 'react';
import { Icon } from './Icon';

interface PlantAvatarProps {
  growth?: number; // 0 to 100
  hydration?: number; // 0 to 100
}

export const PlantAvatar: React.FC<PlantAvatarProps> = ({ growth = 75 }) => {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-[#162b20] dark:to-[#0e1e16] rounded-2xl p-6 shadow-md border-2 border-primary/30 relative overflow-hidden text-center">
      <div className="relative z-10 flex flex-col items-center">
        <div className="size-36 bg-primary/10 rounded-full flex items-center justify-center mb-3 text-primary">
          <Icon name="recycling" className="text-7xl animate-pulse" filled />
        </div>
        <h3 className="font-bold text-lg">سفيرة التدوير المدرسية</h3>
        <p className="text-xs text-emerald-700 dark:text-emerald-300">مستوى الإسهام البيئي: {growth}%</p>
      </div>
    </div>
  );
};
