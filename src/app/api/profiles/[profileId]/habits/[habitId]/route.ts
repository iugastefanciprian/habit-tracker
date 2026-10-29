import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import {
  deleteHabitForProfile,
  updateHabitForProfile,
} from "@/server/services/habits";
import { habitUpdateSchema } from "@/server/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ profileId: string; habitId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireLocalUser();
    const { profileId, habitId } = await context.params;
    const input = habitUpdateSchema.parse(await parseJson(request));
    return Response.json({
      habit: await updateHabitForProfile(
        user.id,
        profileId,
        habitId,
        input
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireLocalUser();
    const { profileId, habitId } = await context.params;
    await deleteHabitForProfile(user.id, profileId, habitId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
