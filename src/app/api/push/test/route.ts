import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import { sendTestNotification } from "@/server/services/push";
import { pushTestSchema } from "@/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireLocalUser();
    const { profileId } = pushTestSchema.parse(await parseJson(request));
    const sent = await sendTestNotification(user.id, profileId);
    return Response.json({ sent });
  } catch (error) {
    return jsonError(error);
  }
}
