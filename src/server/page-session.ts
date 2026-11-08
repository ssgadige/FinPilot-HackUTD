import { cookies } from "next/headers";
import { getServices } from "./services";
export async function pageProfile() {
  const jar = await cookies();
  if (!jar.get("fp_session")) return null;
  try {
    const s = getServices();
    return s.auth.profile(s.auth.session(jar.get("fp_session")!.value).user_id);
  } catch {
    return null;
  }
}
