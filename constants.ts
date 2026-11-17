import { Task, SchoolReward } from './types';

export const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    title: 'فرز العلب البلاستيكية',
    description: 'ضعي علب الماء والعصير البلاستيكية في حاوية البلاستيك المخصصة بالمدرسة',
    points: 15,
    completed: false,
    icon: 'recycling',
    color: 'emerald',
    category: 'plastic'
  },
  {
    id: '2',
    title: 'تجميع أوراق ودفاتر الفصل المستعملة',
    description: 'اجمعي الأوراق التالفة ومسودات الدفاتر وضعيها في صندوق تدوير الورق والكرتون',
    points: 20,
    completed: false,
    icon: 'description',
    color: 'amber',
    category: 'paper'
  },
  {
    id: '3',
    title: 'استخدام مطارة ماء صديقة للبيئة',
    description: 'احضري مطارة ماء قابلة لإعادة الاستخدام بدلاً من شراء علب بلاستيكية لمرة واحدة',
    points: 10,
    completed: true,
    icon: 'local_drink',
    color: 'cyan',
    category: 'reuse'
  },
  {
    id: '4',
    title: 'جمع أغطية القوارير لمشروع البيئة',
    description: 'اجمعي أغطية العلب البلاستيكية الملونة لتسليمها لنادي التدوير المدرسي',
    points: 15,
    completed: false,
    icon: 'category',
    color: 'purple',
    category: 'sorting'
  },
  {
    id: '5',
    title: 'توثيق ركن التدوير في فصلي',
    description: 'التقطي صورة لركن فرز النفايات المنظم داخل فصلكِ وشاركي زميلاتكِ الإنجاز',
    points: 25,
    completed: false,
    icon: 'photo_camera',
    color: 'pink',
    category: 'awareness'
  },
  {
    id: '6',
    title: 'تنظيف علب الحليب والعصير قبل الفرز',
    description: 'اشطفي علبة الحليب أو العصير المدرسية بالماء سريعاً قبل وضعها في حاوية التدوير',
    points: 10,
    completed: false,
    icon: 'cleaning_services',
    color: 'blue',
    category: 'maintenance'
  }
];

export const LEVELS = [
  { name: 'صديقة بيئة مبتدئة', minPoints: 0, icon: 'eco', color: '#10b981' },
  { name: 'فارزة نفايات نشيطة', minPoints: 500, icon: 'recycling', color: '#059669' },
  { name: 'سفيرة الاستدامة المدرسية', minPoints: 1500, icon: 'auto_awesome', color: '#0d9488' },
  { name: 'بطلة التدوير الذهبية', minPoints: 3000, icon: 'military_tech', color: '#f59e0b' }
];

export const BADGES = [
  { id: 'b1', name: 'حامية كوكبنا', icon: 'recycling', description: 'أتممتِ أول 5 مهام لفرز النفايات بنجاح', unlocked: true },
  { id: 'b2', name: 'سفيرة الورق', icon: 'description', description: 'ساهمتِ في جمع وإعادة تدوير الورق والكرتون المدرسي', unlocked: true },
  { id: 'b3', name: 'بطلة البلاستيك', icon: 'inventory_2', description: 'قمتِ بفرز العلب والأغطية البلاستيكية 10 مرات', unlocked: false },
  { id: 'b4', name: 'الموثقة البيئية', icon: 'photo_camera', description: 'وثقتِ جهود وأركان التدوير المدرسية بالصور', unlocked: false },
  { id: 'b5', name: 'مدرسة بلا نفايات', icon: 'stars', description: 'استخدمتِ مطارة ماء صديقة للبيئة لأسبوع كامل', unlocked: false },
];

export const INITIAL_REWARDS: SchoolReward[] = [
  {
    id: 'r1',
    title: 'قسيمة وجبة مجانية من المقصف المدرسي',
    description: 'استبدلي نقاطكِ بوجبة فطور أو عصير صحي مجاناً من مقصف المدرسة',
    cost: 100,
    icon: 'fastfood',
    color: 'amber',
    category: 'canteen'
  },
  {
    id: 'r2',
    title: 'شهادة تقدير "سفيرة التدوير المتميزة"',
    description: 'شهادة شكر رسمية موقعة من إدارة المدرسة ونادي البيئة تُسلّم في الطابور الصباحي',
    cost: 150,
    icon: 'workspace_premium',
    color: 'emerald',
    category: 'honor'
  },
  {
    id: 'r3',
    title: 'طقم أقلام ومفكرة من مواد معاد تدويرها',
    description: 'أدوات مدرسية فاخرة وأنيقة صديقة للبيئة مصنوعة بالكامل من خامات معاد تدويرها',
    cost: 200,
    icon: 'edit_note',
    color: 'teal',
    category: 'tools'
  },
  {
    id: 'r4',
    title: 'مطارة ماء مدرسية حافظة للحرارة',
    description: 'مطارة أنيقة لحفظ برودة الماء طوال اليوم الدراسي مع شارة سفيرة التدوير',
    cost: 250,
    icon: 'local_drink',
    color: 'cyan',
    category: 'tools'
  },
  {
    id: 'r5',
    title: 'وسام تكريم في الإذاعة المدرسية',
    description: 'تكريم خاص باسمكِ وفصلكِ في برنامج الإذاعة المدرسية الأسبوعي لجهودكِ البيئية',
    cost: 120,
    icon: 'campaign',
    color: 'purple',
    category: 'honor'
  },
  {
    id: 'r6',
    title: 'بطاقة استعارة مميزة من مكتبة المدرسة',
    description: 'استعارة 3 كتب إضافية في وقت واحد مع فترة استعارة مضاعفة من أمينة المكتبة',
    cost: 80,
    icon: 'local_library',
    color: 'blue',
    category: 'privilege'
  }
];
