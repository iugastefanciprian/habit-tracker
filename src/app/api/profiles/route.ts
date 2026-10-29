import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import {
  createProfileForUser,
  listProfilesForUser,
} from "@/server/services/profiles";
import { profileInputSchema } from "@/server/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireLocalUser();
    return Response.json({ profiles: await listProfilesForUser(user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireLocalUser();
    const { name } = profileInputSchema.parse(await parseJson(request));
    return Response.json(
      { profile: await createProfileForUser(user.id, name) },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
