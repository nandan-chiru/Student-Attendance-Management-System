import { NextResponse } from "next/server";
import { connection } from "next/server";
import { isMongoConfigured } from "@/lib/db/mongodb-config";
import { getMongoDatabase } from "@/lib/db/mongodb";

/** MongoDB's optional health is reported separately from application/MySQL health. */
export async function GET() {
  await connection();

  if (!isMongoConfigured()) {
    return NextResponse.json({ status: "not_configured" });
  }

  try {
    const database = await getMongoDatabase();
    await database.command({ ping: 1 });
    return NextResponse.json({ status: "ok" });
  } catch {
    // Do not return driver messages: they may contain host or connection details.
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
