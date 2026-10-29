import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import {
  createHabitForProfile,
  listHabitsForProfile,
} from "@/server/services/habits";
import { habitInputSchema } from "@/server/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ profileId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireLocalUser();
    const { profileId } = await context.params;
    return Response.json({
      habits: await listHabitsForProfile(user.id, profileId),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireLocalUser();
    const { profileId } = await context.params;
    const input = habitInputSchema.parse(await parseJson(request));
    return Response.json(
      { habit: await createHabitForProfile(user.id, profileId, input) },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
