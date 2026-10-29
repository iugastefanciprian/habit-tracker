import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import {
  subscribeProfileToPush,
  unsubscribeFromPush,
} from "@/server/services/push";
import { pushEndpointSchema, pushSubscribeSchema } from "@/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireLocalUser();
    const { profileId, subscription } = pushSubscribeSchema.parse(
      await parseJson(request)
    );
    await subscribeProfileToPush(
      user.id,
      profileId,
      subscription,
      request.headers.get("user-agent") ?? undefined
    );
    return Response.json({ subscribed: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireLocalUser();
    const { endpoint } = pushEndpointSchema.parse(await parseJson(request));
    await unsubscribeFromPush(user.id, endpoint);
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
