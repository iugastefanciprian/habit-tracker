import { redirect } from "next/navigation";

/** The overview page was retired in Phase 1; its metrics now live on /habits. */
export default function Overview() {
  redirect("/habits");
}
