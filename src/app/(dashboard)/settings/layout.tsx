import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import SettingsNav from "@/components/settings/SettingsNav";
import { settingsSectionsFor } from "@/lib/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  // Роль без единого доступного раздела не должна попадать в настройки.
  if (settingsSectionsFor(role).length === 0) redirect("/dashboard");

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        <SettingsNav role={role} />
        <div className="min-w-0 flex-1 lg:max-w-5xl">{children}</div>
      </div>
    </div>
  );
}
