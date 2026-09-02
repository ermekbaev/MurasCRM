/**
 * Оповещение открытых вкладок о новых сообщениях.
 *
 * События живут в памяти процесса: вебхук Telegram и SSE-поток работают в одном
 * приложении, поэтому входящее долетает до браузера мгновенно. На случай, когда
 * процессов несколько, поток дополнительно сверяется с базой — см. stream.
 */
export interface ChatEvent {
  conversationId: string;
  direction: "IN" | "OUT";
}

type Listener = (event: ChatEvent) => void;

// Через globalThis — иначе горячая перезагрузка в разработке создаёт
// второй экземпляр модуля, и подписки теряются.
const globalForChat = globalThis as unknown as { chatListeners?: Set<Listener> };
const listeners = (globalForChat.chatListeners ??= new Set<Listener>());

export function emitChatEvent(event: ChatEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Один сорвавшийся подписчик не должен мешать остальным.
    }
  }
}

export function onChatEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
