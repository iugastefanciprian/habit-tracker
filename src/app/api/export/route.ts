import { requireLocalUser } from "@/server/auth/currentUser";
import { jsonError } from "@/server/errors";
import { exportAllData } from "@/server/services/export";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireLocalUser();
    return Response.json(await exportAllData(user.id));
  } catch (error) {
    return jsonError(error);
  }
}
