import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Модели с корзиной: удаление помечает запись, а не стирает.
 *
 * Фильтр «скрыть удалённое» навешен один раз на клиента, а не расставлен по
 * полусотне запросов: иначе где-нибудь его забудут, и удалённая заявка
 * всплывёт в списке — а при следующей правке забудут снова.
 */
const SOFT_DELETE_MODELS = new Set([
  "Order",
  "Client",
  "Invoice",
  "Act",
  "Waybill",
  "Expense",
]);

/** Операции чтения, в которые подставляется фильтр. */
const READ_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

function createBaseClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prismaBase: ReturnType<typeof createBaseClient> | undefined;
};

const base = globalForPrisma.prismaBase ?? createBaseClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = base;

/**
 * Клиент без фильтра — видит и удалённое.
 *
 * Нужен ровно в двух местах: сама корзина (показать, восстановить, вычистить)
 * и нумерация документов. Нумерация обязана учитывать удалённые номера: иначе
 * следующий счёт займёт номер удалённого, и восстановить его уже не выйдет —
 * номер уникален.
 */
export const prismaRaw = base;

export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model) || !READ_OPERATIONS.has(operation)) {
          return query(args);
        }
        const withFilter = args as { where?: Record<string, unknown> };
        withFilter.where = { ...(withFilter.where ?? {}), deletedAt: null };
        return query(withFilter);
      },
    },
  },
});
