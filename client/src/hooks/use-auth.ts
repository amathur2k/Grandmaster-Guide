import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { analytics, identifyUser, resetAmplitudeUser } from "@/lib/analytics";

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
      analytics.signInCompleted("google");
      identifyUser(String(user.id), { name: user.name, email: user.email });
    }
    prevAuth.current = !!user;
  }, [user]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      resetAmplitudeUser();
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    logout: () => logoutMutation.mutate(),
  };
}
