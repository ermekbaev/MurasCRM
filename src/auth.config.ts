import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Routes allowed per role (prefix match)
const ROLE_ROUTES: Record<Role, string[]> = {
  ADMIN: ["/"],
  MANAGER: [
    "/dashboard",
    "/orders",
    "/tasks",
    "/chats",
    "/clients",
    "/invoices",
    "/acts",
    "/waybills",
    "/files",
    "/consumables",
    "/defects",
    "/settings/suppliers",
    "/settings/tags",
    "/settings/client-sources",
    "/settings/order-types",
    "/settings/task-columns",
    "/settings/quick-replies",
  ],
  DESIGNER: ["/dashboard", "/tasks", "/files", "/chats"],
  OPERATOR: ["/dashboard", "/tasks", "/defects"],
  ACCOUNTANT: [
    "/dashboard",
    "/invoices",
    "/acts",
    "/waybills",
    "/chats",
    "/analytics",
    "/settings/templates",
  ],
};

// Маршруты, доступные только точным совпадением — без вложенных путей.
// Обзор настроек открыт всем, у кого есть хотя бы один раздел, но сами
// разделы остаются за префиксами из ROLE_ROUTES.
const ROLE_EXACT_ROUTES: Partial<Record<Role, string[]>> = {
  MANAGER: ["/settings"],
  ACCOUNTANT: ["/settings"],
};

function canAccess(role: Role, pathname: string): boolean {
  if (role === "ADMIN") return true;
  if ((ROLE_EXACT_ROUTES[role] ?? []).includes(pathname)) return true;
  const allowed = ROLE_ROUTES[role] ?? [];
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Always allow public paths
      // Вебхуки мессенджеров приходят без сессии и должны попадать в обработчик,
      // а не на страницу входа. Каждый защищён по-своему: Telegram — секретом в
      // заголовке, WhatsApp — подписью тела запроса.
      if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/telegram/webhook") ||
        pathname.startsWith("/api/whatsapp/webhook")
      ) {
        return true;
      }

      // Redirect unauthenticated users to login
      if (!isLoggedIn) {
        return false;
      }

      const role = auth.user.role as Role;

      // Redirect root to dashboard
      if (pathname === "/") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // Allow API routes (protected at handler level)
      if (pathname.startsWith("/api/")) {
        return true;
      }

      // Check role-based access
      if (!canAccess(role, pathname)) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
