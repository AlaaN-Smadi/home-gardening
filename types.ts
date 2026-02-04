export enum AppView {
  HOME = 'home',
  TASKS = 'tasks',
  LEARN = 'learn',
  CHALLENGES = 'challenges',
  PROFILE = 'profile',
  CHAT = 'chat',
  ADMIN = 'admin',
  ADMIN_CLASSES = 'admin_classes',
  ADMIN_PROFILE = 'admin_profile',
  ADMIN_ADD_CLASS = 'admin_add_class',
  ADMIN_CLASS_DETAILS = 'admin_class_details',
  ADMIN_SECTION_DETAILS = 'admin_section_details',
  ADMIN_ADD_SECTION = 'admin_add_section',
  ADMIN_ADD_STUDENT = 'admin_add_student',
  ADMIN_ADD_TASK = 'admin_add_task',
  ADMIN_EDIT_TASK = 'admin_edit_task',
  ADMIN_COMPETITIONS = 'admin_competitions',
  ADMIN_ADD_COMPETITION = 'admin_add_competition',
  ADMIN_EDIT_COMPETITION = 'admin_edit_competition'
}

export interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  completed: boolean;
  icon: string;
  color: string;
  category: string;
}

export interface StudentStats {
  name: string;
  level: string;
  points: number;
  streak: number;
  completedTasks: number;
  totalTasks: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface Student {
  id: string;
  name: string;
  points: number;
}

export interface Section {
  id: string;
  name: string;
  students: Student[];
}

export interface ClassRoom {
  id: string;
  name: string;
  sections: Section[];
}

export interface Competition {
  id: string;
  title: string;
  type: 'inter-class' | 'intra-class';
  targetClassId?: string; // Only for intra-class
  startDate: string;
  endDate: string;
  prize: string;
  status: 'active' | 'completed';
}