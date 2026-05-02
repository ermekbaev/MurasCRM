import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { Role } from "@prisma/client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <DashboardShell
      role={session.user.role as Role}
      userName={session.user.name || ""}
      userEmail={session.user.email || ""}
    >
      {children}
    </DashboardShell>
  );
}
