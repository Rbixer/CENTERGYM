import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import { RegisterPwa } from "@/components/RegisterPwa";

const metadataBase = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL)
  : new URL("http://localhost:4178");

export const metadata: Metadata = {
  metadataBase,
  title: "GYM CENTER",
  description:
    "Encuesta GYM CENTER con panel de administración y análisis de respuestas. Instalable en el móvil.",
  applicationName: "gymcenter",
  icons: {
    icon: [{ url: "/gymcenter-logo.png", sizes: "180x180", type: "image/png" }],
    apple: [{ url: "/gymcenter-logo.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "gymcenter",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "GYM CENTER",
    title: "GYM CENTER",
    description: "Encuesta para el gimnasio",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /** Barra del sistema / Chrome en móvil al usar la PWA (negro). */
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="font-sans min-h-full min-h-[100dvh] flex flex-col touch-manipulation">
        <Script id="theme-mobile-dark" strategy="beforeInteractive">
          {`(function(){
function sync(){
  try{
    var d=document.documentElement;
    var dark=window.matchMedia("(prefers-color-scheme: dark)").matches
      || window.matchMedia("(max-width: 768px)").matches
      || window.matchMedia("(display-mode: standalone)").matches;
    d.classList.toggle("dark",dark);
  }catch(e){}
}
sync();
try{
  ["(prefers-color-scheme: dark)","(max-width: 768px)","(display-mode: standalone)"].forEach(function(q){
    window.matchMedia(q).addEventListener("change",sync);
  });
}catch(e){}
})();`}
        </Script>
        <Suspense fallback={null}>
          <RegisterPwa />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
