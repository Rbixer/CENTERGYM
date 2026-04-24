import { NextResponse } from "next/server";
import {
  assertAdminPassword,
  attachAdminSessionCookie,
  createAdminToken,
} from "@/lib/auth";

export async function POST(req: Request) {
  let password = "";
  try {
    const j = (await req.json()) as { password?: string };
    password = typeof j.password === "string" ? j.password : "";
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!assertAdminPassword(password)) {
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }

  let token: string;
  try {
    token = createAdminToken();
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Configuración del servidor incompleta (ADMIN_SECRET)" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true });
  attachAdminSessionCookie(res, token);
  return res;
}
