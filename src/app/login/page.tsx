import { getBranding } from "@/lib/branding.server";
import LoginForm from "./LoginForm";

/**
 * Страница входа.
 *
 * Обёртка серверная: название и значок установки читаются из настроек до
 * отрисовки, иначе клиент на секунду видел бы чужой логотип.
 */
export default async function LoginPage() {
  const brand = await getBranding();
  return (
    <LoginForm
      brand={{ name: brand.name, tagline: brand.tagline, logo: brand.logo }}
    />
  );
}
