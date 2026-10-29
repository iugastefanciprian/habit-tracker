import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import { importLegacyData } from "@/server/services/import";
import { importSchema } from "@/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireLocalUser();
    const input = importSchema.parse(await parseJson(request));
    const profiles = await importLegacyData(user.id, input);
    return Response.json({ profiles }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
