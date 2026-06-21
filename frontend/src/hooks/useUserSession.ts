import { useSession } from "next-auth/react";

export function useUserSession() {
  const { data: session, status } = useSession();

  return {
    user: session?.user?.name || null,
    email: session?.user?.email || null,
    image: session?.user?.image || null,
    authenticated: status === "authenticated",
    loading: status === "loading",
  };
}
