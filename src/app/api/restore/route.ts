import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError, parseJson } from "@/server/errors";
import { restoreBackup } from "@/server/services/restore";
import { restoreSchema } from "@/server/validation";

export const runtime = "nodejs";

/** Restores a previously exported JSON backup, merging or replacing data. */
export async function POST(request: Request) {
  try {
    const user = await requireLocalUser();
    const { mode, backup } = restoreSchema.parse(await parseJson(request));
    return Response.json(await restoreBackup(user.id, backup, mode));
  } catch (error) {
    return jsonError(error);
  }
}
