import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError } from "@/server/errors";
import { toggleHabitForProfile } from "@/server/services/habits";
import { toggleDaySchema } from "@/server/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ profileId: string; habitId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireLocalUser();
    const { profileId, habitId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { date } = toggleDaySchema.parse(body ?? {});
    return Response.json({
      habit: await toggleHabitForProfile(user.id, profileId, habitId, date),
    });
  } catch (error) {
    return jsonError(error);
  }
}
