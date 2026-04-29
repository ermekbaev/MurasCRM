import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Returns the session if authenticated, null otherwise.
// Usage:
//   const session = await requireAuth();
//   if (!session) return apiError.unauthorized();
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

// Retry wrapper for Prisma unique constraint violations (P2002).
// Pass attempt index to the callback so the caller can vary the generated value.
export async function retryOnDuplicate<T>(
  fn: (attempt: number) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (e: unknown) {
      const isUnique =
        typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
      if (isUnique && attempt < maxAttempts - 1) continue;
      throw e;
    }
  }
  throw new Error("retryOnDuplicate: exceeded max attempts");
}

export const apiError = {
  unauthorized: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  forbidden: () => NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  notFound: () => NextResponse.json({ error: "Not found" }, { status: 404 }),
  badRequest: (error?: unknown) =>
    NextResponse.json({ error: error ?? "Bad request" }, { status: 400 }),
};
