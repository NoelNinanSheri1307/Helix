"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function useUserSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    const user = session?.user;
    if (
      status !== "authenticated" ||
      !user ||
      !user.email
    ) {
      return;
    }

    const syncUser = async () => {
      try {
        await fetch(
          "http://localhost:8000/users/sync",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name || null,
              avatar_url: user.image || null,
            }),
          }
        );
      } catch (error) {
        console.error(
          "User sync failed",
          error
        );
      }
    };

    syncUser();
  }, [session, status]);
}