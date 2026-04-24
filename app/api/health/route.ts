import { NextResponse } from "next/server";

/** Sin base de datos: sirve para comprobar que el servidor responde (no el puerto colgado). */
export async function GET() {
  return NextResponse.json({ ok: true, t: Date.now() });
}
