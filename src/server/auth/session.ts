import "server-only";
import { redirect } from "next/navigation";

/**
 * FP-10 integration blocker: no trusted session validator exists on this branch.
 * Fail closed. Do not replace this with cookie presence, GET /me from the
 * browser, an environment switch, or a test identity. FP-10 must validate the
 * opaque cookie against its session store, verification state and expiry.
 */
export async function requireVerifiedSession(): Promise<never> {
  redirect("/login?reason=unavailable");
}
