import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBranding } from "@/lib/branding.server";
import { needsSetup } from "@/lib/setup.server";
import { getLicenseStatus } from "@/lib/license.server";
import SetupWizard from "./SetupWizard";

export const dynamic = "force-dynamic";

/**
 * Мастер первичной настройки.
 *
 * Только админ и только пока настройка не завершена — иначе отправляем в
 * систему. Лицензия проверяется раньше: за её стеной настраивать нечего.
 */
export default async function SetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const license = await getLicenseStatus();
  if (license.locked) redirect("/license");

  if (!(await needsSetup())) redirect("/dashboard");

  const brand = await getBranding();
  return <SetupWizard brandName={brand.name} />;
}
