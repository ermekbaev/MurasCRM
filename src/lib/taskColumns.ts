import { slugifyCode } from "@/lib/slug";

export interface TaskColumnDto {
  id: string;
  code: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  isStart: boolean;
  isFinal: boolean;
}

// Встроенные этапы — запасной вариант, если справочник пуст.
export const DEFAULT_TASK_COLUMNS: TaskColumnDto[] = [
  { id: "tcol_todo",        code: "TODO",        name: "К выполнению", color: "#64748b", sortOrder: 1, isActive: true, isStart: false, isFinal: false },
  { id: "tcol_in_progress", code: "IN_PROGRESS", name: "В работе",     color: "#0ea5e9", sortOrder: 2, isActive: true, isStart: true,  isFinal: false },
  { id: "tcol_review",      code: "REVIEW",      name: "На проверке",  color: "#8b5cf6", sortOrder: 3, isActive: true, isStart: false, isFinal: false },
  { id: "tcol_done",        code: "DONE",        name: "Готово",       color: "#10b981", sortOrder: 4, isActive: true, isStart: false, isFinal: true  },
];

export function slugifyTaskColumnCode(name: string): string {
  return slugifyCode(name, "STAGE");
}
