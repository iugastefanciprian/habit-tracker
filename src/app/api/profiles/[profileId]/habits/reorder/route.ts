import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import { reorderHabitsForProfile } from "@/server/services/habits";
import { reorderHabitsSchema } from "@/server/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ profileId: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireLocalUser();
    const { profileId } = await context.params;
    const { habitIds } = reorderHabitsSchema.parse(await parseJson(request));
    return Response.json({
      habits: await reorderHabitsForProfile(user.id, profileId, habitIds),
    });
  } catch (error) {
    return jsonError(error);
  }
}
