import { headers } from "next/headers";
import { auth } from "./auth";

export async function getServerSession() {
  try {
    let reqHeaders: Headers;
    try {
      reqHeaders = await headers();
    } catch {
      reqHeaders = new Headers();
    }
    return await auth.api.getSession({ headers: reqHeaders });
  } catch {
    return null;
  }
}
