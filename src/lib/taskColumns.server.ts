// Только для серверных модулей: тянет prisma, в клиентский бандл попадать не должен.
import { prisma } from "@/lib/prisma";
import { DEFAULT_TASK_COLUMNS, type TaskColumnDto } from "@/lib/taskColumns";

/** Этапы задач из справочника; при пустом справочнике — встроенные. */
export async function getTaskColumns(): Promise<TaskColumnDto[]> {
  const columns = await prisma.taskColumn.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return columns.length > 0 ? columns : DEFAULT_TASK_COLUMNS;
}

/** Карта code -> название этапа. */
export async function getTaskStatusLabels(): Promise<Record<string, string>> {
  const columns = await getTaskColumns();
  return Object.fromEntries(columns.map((c) => [c.code, c.name]));
}
