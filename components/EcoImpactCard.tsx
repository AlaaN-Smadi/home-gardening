import React from 'react';
import { Icon } from './Icon';

interface EcoImpactCardProps {
  points: number;
  completedTasksCount: number;
  level: string;
}

export const EcoImpactCard: React.FC<EcoImpactCardProps> = ({ points, completedTasksCount, level }) => {
  // Estimated impact based on points and completed tasks
  const bottlesRecycled = Math.max(8, completedTasksCount * 3 + Math.floor(points / 30));
  const paperSheetsSaved = Math.max(15, completedTasksCount * 5 + Math.floor(points / 20));
  const co2SavedKg = ((bottlesRecycled * 0.08) + (paperSheetsSaved * 0.015)).toFixed(1);

  // Calculate tier percentage towards next level (e.g. out of 500 or 1500 or 3000)
  const nextTarget = points < 500 ? 500 : points < 1500 ? 1500 : points < 3000 ? 3000 : 5000;
  const progressPercent = Math.min(100, Math.round((points / nextTarget) * 100));

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-[#132a1f] dark:via-[#162e22] dark:to-[#0f2117] rounded-3xl p-5 shadow-sm border border-emerald-200/70 dark:border-emerald-800/40 relative overflow-hidden">
      {/* Decorative background watermark */}
      <div className="absolute -left-6 -bottom-6 text-emerald-500/5 dark:text-emerald-400/5 pointer-events-none">
        <Icon name="recycling" className="text-[170px]" filled />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <Icon name="compost" className="text-xl" filled />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">أثركِ البيئي في المدرسة</h3>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">بفضل جهودكِ المستمرة في فرز النفايات</p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
            {level}
          </span>
        </div>

        {/* 3 Impact metric counters */}
        <div className="grid grid-cols-3 gap-2 text-center mb-4">
          <div className="bg-white/80 dark:bg-black/20 backdrop-blur p-2.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
            <div className="size-7 mx-auto rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
              <Icon name="local_drink" className="text-base" />
            </div>
            <p className="text-lg font-black text-gray-900 dark:text-white leading-tight">{bottlesRecycled}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">علبة بلاستيكية</p>
          </div>

          <div className="bg-white/80 dark:bg-black/20 backdrop-blur p-2.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
            <div className="size-7 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
              <Icon name="description" className="text-base" />
            </div>
            <p className="text-lg font-black text-gray-900 dark:text-white leading-tight">{paperSheetsSaved}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">ورقة تم إنقاذها</p>
          </div>

          <div className="bg-white/80 dark:bg-black/20 backdrop-blur p-2.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
            <div className="size-7 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
              <Icon name="cloud_off" className="text-base" />
            </div>
            <p className="text-lg font-black text-gray-900 dark:text-white leading-tight">{co2SavedKg}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">كجم كربون وُفِّر</p>
          </div>
        </div>

        {/* Level progress bar */}
        <div className="bg-white/60 dark:bg-black/10 p-2.5 rounded-2xl border border-emerald-100/80 dark:border-emerald-900/40">
          <div className="flex justify-between items-center text-xs mb-1.5 font-bold">
            <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
              <Icon name="military_tech" className="text-amber-500 text-sm" filled />
              التقدم نحو المستوى التالي
            </span>
            <span className="text-primary font-black">{points} / {nextTarget} نقطة</span>
          </div>
          <div className="w-full bg-emerald-100 dark:bg-emerald-950/80 h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-l from-primary to-teal-400 h-full rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
