import { NextResponse } from "next/server";
import { isAdminSession } from "./auth";

export async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}
