import type { Metadata } from "next";

/**
 * Sobrescribe el manifest del root layout para que las páginas bajo /admin
 * declaren su propio manifest (id "/admin", scope "/admin/", start_url
 * "/admin/login"). Así el navegador puede instalar el panel como una PWA
 * separada de la app del cliente, con su propio icono que abre directamente
 * en el login del admin en lugar del home con encuesta/tienda/rutinas.
 *
 * No registramos service worker en /admin (lo hace RegisterPwa.tsx): un SW
 * dentro del admin causaba cachés rotos de auth/cookies. El manifest solo
 * provee la metadata para "Añadir a pantalla de inicio" / "Instalar app".
 */
export const metadata: Metadata = {
  title: "Admin · GYM CENTER",
  applicationName: "GYM CENTER Admin",
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Admin GYM",
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-app-shell h-full min-h-0 w-full min-w-0 max-w-full overflow-x-clip">
      {children}
    </div>
  );
}
