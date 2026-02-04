
import React from 'react';
import { Icon } from './Icon';

interface PlantAvatarProps {
  growth: number; // 0 to 100
  hydration: number; // 0 to 100
}

export const PlantAvatar: React.FC<PlantAvatarProps> = ({ growth, hydration }) => {
  return (
    <div className="bg-gradient-to-br from-[#f0f9f1] to-white dark:from-[#1a2e1f] dark:to-[#102216] rounded-2xl p-6 shadow-md border-2 border-primary/30 relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 relative">
          <div className="w-48 h-48 bg-white/50 dark:bg-black/20 rounded-full flex items-center justify-center backdrop-blur-sm relative overflow-hidden">
            {/* Animated Glow */}
            <div className="absolute inset-0 bg-primary/10 animate-pulse"></div>
            
            {/* Plant Icon Logic based on growth */}
            <Icon 
              name={growth < 30 ? 'potted_plant' : growth < 70 ? 'energy_savings_leaf' : 'eco'} 
              className={`text-[120px] text-primary transition-all duration-1000 transform ${growth >= 70 ? 'scale-110' : 'scale-100'}`} 
              filled 
            />
          </div>
          <div className="absolute -bottom-2 right-0 bg-white dark:bg-[#2a3f30] px-4 py-1 rounded-full shadow-md border border-primary/20">
            <p className="text-xs font-bold text-primary">المرحلة: {growth < 30 ? 'برعم' : growth < 70 ? 'نمو' : 'نضج'}</p>
          </div>
        </div>
        <div className="w-full text-center">
          <p className="text-lg font-bold text-[#111813] dark:text-white">نبتة النعناع الرقمية</p>
          <p className="text-[#61896f] dark:text-[#a3c3ad] text-sm mb-4">تنمو بنسبة {growth}% نحو النضج الكامل</p>
          <div className="w-full space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span>مستوى الرطوبة</span>
              <span>{hydration}%</span>
            </div>
            <div className="w-full bg-[#dbe6df] dark:bg-[#2a3f30] h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${hydration < 30 ? 'bg-red-400' : 'bg-blue-400'}`} 
                style={{ width: `${hydration}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -top-10 -left-10 opacity-5 dark:opacity-10 transform -rotate-12">
        <Icon name="filter_vintage" className="text-[200px]" />
      </div>
    </div>
  );
};
