import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import { setDayValueForProfile } from "@/server/services/habits";
import { dateParamSchema, dayValueSchema } from "@/server/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ profileId: string; habitId: string; date: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireLocalUser();
    const { profileId, habitId, date } = await context.params;
    const validDate = dateParamSchema.parse(date);
    const { value, note, skipped } = dayValueSchema.parse(
      await parseJson(request)
    );
    return Response.json({
      habit: await setDayValueForProfile(
        user.id,
        profileId,
        habitId,
        validDate,
        value,
        { note, skipped }
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}
