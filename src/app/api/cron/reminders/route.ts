import { requireLocalUser } from "@/server/auth/currentUser";
import { AppError, jsonError } from "@/server/errors";
import { sendDueRemindersForUser } from "@/server/services/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function providedSecret(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return new URL(request.url).searchParams.get("secret");
}

/**
 * Cron entry point for background reminders. Point a scheduler at this route
 * every few minutes with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
      throw new AppError(503, "CRON_SECRET is not configured.");
    }
    if (providedSecret(request) !== secret) {
      throw new AppError(401, "Unauthorized.");
    }

    const user = await requireLocalUser();
    const summary = await sendDueRemindersForUser(user.id);
    return Response.json(summary);
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = GET;
