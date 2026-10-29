import { requireLocalUser } from "@/server/auth/currentUser";
import { AppError, jsonError } from "@/server/errors";
import { getPushStatusForProfile } from "@/server/services/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireLocalUser();
    const profileId = new URL(request.url).searchParams.get("profileId");
    if (!profileId) throw new AppError(400, "profileId is required");
    return Response.json(await getPushStatusForProfile(user.id, profileId));
  } catch (error) {
    return jsonError(error);
  }
}
