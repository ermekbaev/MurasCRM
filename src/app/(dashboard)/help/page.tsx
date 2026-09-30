import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultHelpArticles } from "@/lib/help-defaults.server";
import HelpClient from "./HelpClient";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  await ensureDefaultHelpArticles();
  const articles = await prisma.helpArticle.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <HelpClient
      initialArticles={articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        category: a.category,
        title: a.title,
        body: a.body,
      }))}
      isAdmin={isAdmin}
    />
  );
}
