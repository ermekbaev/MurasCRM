import type { Role } from "@prisma/client";

/**
 * Кто видит деньги компании.
 *
 * Расходы, остатки по счетам и обороты — это картина бизнеса целиком, а не
 * работа по заявке. Дизайнеру и оператору тут делать нечего, менеджеру
 * достаточно видеть приход от своих клиентов.
 */
export const MONEY_READ_ROLES: Role[] = ["ADMIN", "ACCOUNTANT"];

/** Заводить счета, статьи и расходы. */
export const MONEY_WRITE_ROLES: Role[] = ["ADMIN", "ACCOUNTANT"];

/** Принять оплату от клиента может и менеджер — это часть работы с заявкой. */
export const PAYMENT_ROLES: Role[] = ["ADMIN", "MANAGER", "ACCOUNTANT"];
