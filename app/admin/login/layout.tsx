import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/auth";

export default async function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await isAdminSession()) {
    redirect("/admin");
  }
  return <>{children}</>;
}
