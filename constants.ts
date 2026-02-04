
import { Task } from './types';

export const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    title: 'ري شتلات النعناع',
    description: 'تحتاج النبتة إلى القليل من الماء في الصباح الباكر',
    points: 10,
    completed: false,
    icon: 'water_drop',
    color: 'blue',
    category: 'watering'
  },
  {
    id: '2',
    title: 'فحص رطوبة التربة',
    description: 'استخدم إصبعك للتأكد من أن التربة ليست جافة جداً',
    points: 5,
    completed: false,
    icon: 'psychology_alt',
    color: 'orange',
    category: 'maintenance'
  },
  {
    id: '3',
    title: 'صوّر ورقة جديدة',
    description: 'وثق نمو نباتاتك الجميل اليوم',
    points: 20,
    completed: true,
    icon: 'photo_camera',
    color: 'green',
    category: 'observation'
  },
  {
    id: '4',
    title: 'تعديل مكان الأصيص',
    description: 'تأكد أن النبتة تحصل على ما يكفي من أشعة الشمس',
    points: 15,
    completed: false,
    icon: 'light_mode',
    color: 'yellow',
    category: 'maintenance'
  }
];

export const LEVELS = [
  { name: 'برعم ناشئ', minPoints: 0, icon: 'potted_plant', color: '#13ec5b' },
  { name: 'شتلة نشيطة', minPoints: 500, icon: 'energy_savings_leaf', color: '#0ea641' },
  { name: 'شجيرة واعدة', minPoints: 1500, icon: 'eco', color: '#0b8a36' },
  { name: 'بستاني محترف', minPoints: 3000, icon: 'psychology_alt', color: '#ffd700' }
];

export const BADGES = [
  { id: 'b1', name: 'صديق البيئة', icon: 'nest_eco_leaf', description: 'أتممت أول 5 مهام ري', unlocked: true },
  { id: 'b2', name: 'المصور المبدع', icon: 'photo_camera', description: 'وثقت نمو نبتتك لـ 7 أيام متتالية', unlocked: true },
  { id: 'b3', name: 'خبير التربة', icon: 'agriculture', description: 'أتممت فحص التربة 10 مرات', unlocked: false },
  { id: 'b4', name: 'حارس الشمس', icon: 'wb_sunny', description: 'عدلت مكان الأصيص للضوء الأمثل', unlocked: false },
];
