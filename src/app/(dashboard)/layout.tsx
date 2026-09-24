import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { Role } from "@prisma/client";
import { getBranding } from "@/lib/branding.server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const brand = await getBranding();

  return (
    <DashboardShell
      role={session.user.role as Role}
      userName={session.user.name || ""}
      userEmail={session.user.email || ""}
      brand={{ name: brand.name, tagline: brand.tagline, logo: brand.logo }}
    >
      {children}
    </DashboardShell>
  );
}
