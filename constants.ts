import { ShareClass } from './types';

export const VOTES_PER_SHARE: Record<ShareClass, number> = {
  [ShareClass.A]: 1,
  [ShareClass.B]: 10,
};

// Light theme friendly chart colors
export const LIGHT_THEME_CHART_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // green-500
  '#EF4444', // red-500
  '#F59E0B', // amber-500
  '#6366F1', // indigo-500
  '#06B6D4', // cyan-500
  '#EC4899', // pink-500
  '#8B5CF6', // violet-500
  '#D97706', // amber-600
  '#6D28D9', // violet-700
];

export const EMPLOYEE_POOL_ID = 'employee-option-pool';
export const EMPLOYEE_POOL_NAME = 'Employee Option Pool';
