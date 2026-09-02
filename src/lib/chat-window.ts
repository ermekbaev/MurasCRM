import { WHATSAPP_WINDOW_MS } from "@/lib/whatsapp";

export interface ChatWindow {
  /** Можно ли писать свободным текстом прямо сейчас. */
  open: boolean;
  /** Когда окно закроется. Пусто, если клиент ещё ни разу не писал. */
  expiresAt: string | null;
}

/**
 * Окно свободной переписки WhatsApp.
 *
 * Meta разрешает отвечать свободным текстом только 24 часа после последнего
 * сообщения клиента. Дальше — лишь заранее одобренные платные шаблоны.
 * Считаем окно сами, чтобы показать запрет до того, как менеджер напишет
 * ответ, а не после отказа Meta.
 */
export function whatsappWindow(lastInboundAt: Date | string | null): ChatWindow {
  if (!lastInboundAt) return { open: false, expiresAt: null };

  const last = new Date(lastInboundAt).getTime();
  const expires = last + WHATSAPP_WINDOW_MS;
  return { open: Date.now() < expires, expiresAt: new Date(expires).toISOString() };
}
