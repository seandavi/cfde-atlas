import { getDataRefreshedAt } from "@/app/lib/tools/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const refreshed = await getDataRefreshedAt();
  return Response.json({ refreshed });
}
