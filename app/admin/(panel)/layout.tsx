import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/auth";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }
  return <>{children}</>;
}
