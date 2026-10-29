import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import { renameHabitCategoryForProfile } from "@/server/services/habits";
import { categoryRenameSchema } from "@/server/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ profileId: string }>;
}

/** Renames a category across every habit in the profile. `to: null` clears it. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireLocalUser();
    const { profileId } = await context.params;
    const { from, to } = categoryRenameSchema.parse(await parseJson(request));
    return Response.json({
      habits: await renameHabitCategoryForProfile(
        user.id,
        profileId,
        from,
        to
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}
