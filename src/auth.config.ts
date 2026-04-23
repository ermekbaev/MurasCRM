import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Routes allowed per role (prefix match)
const ROLE_ROUTES: Record<Role, string[]> = {
  ADMIN: ["/"],
  MANAGER: [
    "/dashboard",
    "/orders",
    "/tasks",
    "/clients",
    "/invoices",
    "/acts",
    "/files",
    "/consumables",
    "/settings/suppliers",
    "/settings/tags",
  ],
  DESIGNER: ["/dashboard", "/tasks", "/files"],
  OPERATOR: ["/dashboard", "/tasks"],
  ACCOUNTANT: [
    "/dashboard",
    "/invoices",
    "/acts",
    "/analytics",
    "/settings/templates",
  ],
};

function canAccess(role: Role, pathname: string): boolean {
  if (role === "ADMIN") return true;
  const allowed = ROLE_ROUTES[role] ?? [];
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Always allow public paths
      if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
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
