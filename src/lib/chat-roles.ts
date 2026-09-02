import type { Role } from "@prisma/client";

/**
 * Кто видит переписку с клиентами. Оператор в списке отсутствует намеренно:
 * он работает на производстве и с клиентом не общается.
 */
export const CHAT_ROLES: Role[] = ["ADMIN", "MANAGER", "ACCOUNTANT", "DESIGNER"];

/** Привязывать диалог к клиенту и заявке может тот, кто ведёт продажи. */
export const CHAT_LINK_ROLES: Role[] = ["ADMIN", "MANAGER"];
