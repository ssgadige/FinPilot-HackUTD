import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServices } from "../services";
import { ApiFailure } from "../errors";

/** Finance pages use the same verified, unexpired session store as the APIs. */
export async function requireVerifiedSession() {
  try {
    const auth = getServices().auth;
    const session = auth.session((await cookies()).get("fp_session")?.value || "");
    return auth.profile(session.user_id);
  } catch (error) {
    redirect(error instanceof ApiFailure && error.status === 401
      ? "/login?reason=session-expired" : "/login?reason=unavailable");
  }
}
