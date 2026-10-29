import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import { updateProfileForUser } from "@/server/services/profiles";
import { profileUpdateSchema } from "@/server/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ profileId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireLocalUser();
    const { profileId } = await context.params;
    const input = profileUpdateSchema.parse(await parseJson(request));
    return Response.json({
      profile: await updateProfileForUser(user.id, profileId, input),
    });
  } catch (error) {
    return jsonError(error);
  }
}
