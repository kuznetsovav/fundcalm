import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/dca-quotes";
import { etfByTicker } from "@/lib/dca-etf-catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("tickers") ?? "";
  const requested = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  // Whitelist gate — only allow tickers from the catalog so this endpoint
  // can't be turned into a generic Yahoo proxy.
  const allowed = requested.filter((t) => etfByTicker(t) != null);
  if (allowed.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  try {
    const quotes = await getQuotes(allowed);
    return NextResponse.json({ quotes });
  } catch {
    return NextResponse.json({ quotes: [], error: "fetch_failed" }, { status: 502 });
  }
}
