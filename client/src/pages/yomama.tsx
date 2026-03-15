import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const GAME_COUNT_KEY = "chess_games_loaded";

export default function YoMama() {
  const [, setLocation] = useLocation();
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(GAME_COUNT_KEY, "0");
    } catch {}
    setDone(true);
    const tid = setTimeout(() => setLocation("/"), 1500);
    return () => clearTimeout(tid);
  }, [setLocation]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "monospace", flexDirection: "column", gap: 12 }}>
      {done ? (
        <>
          <span style={{ fontSize: 48 }}>✅</span>
          <p style={{ fontSize: 14, color: "#555" }}>Game count reset. Redirecting…</p>
        </>
      ) : null}
    </div>
  );
}
