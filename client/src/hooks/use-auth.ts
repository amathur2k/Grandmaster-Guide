import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
}

const GAME_COUNT_KEY = "chess_games_loaded";

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const prevAuth = useRef(false);
  useEffect(() => {
    if (user && !prevAuth.current) {
      try {
        localStorage.removeItem(GAME_COUNT_KEY);
      } catch {}
    }
    prevAuth.current = !!user;
  }, [user]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
    },
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const signIn = useCallback(() => {
    window.open("/api/auth/google", "_blank");
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            queryClient.setQueryData(["/api/auth/me"], data);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {}
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    logout: () => logoutMutation.mutate(),
    signIn,
  };
}
