import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";

function useUserIdHook(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token) as any;
        // The subject field contains the user identifier from Gryt Auth
        if (decoded.sub) {
          setUserId(decoded.sub);
        }
      } catch (error) {
        console.error("Failed to decode JWT token:", error);
        setUserId(null);
      }
    } else {
      setUserId(null);
    }
  }, []);

  return userId;
}

const init: string | null = null;

export const useUserId = singletonHook(init, useUserIdHook);
