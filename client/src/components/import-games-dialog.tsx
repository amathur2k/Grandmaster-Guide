import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Zap, Clock, FileText, Upload, X, RefreshCw, ChevronLeft } from "lucide-react";
import { SiChessdotcom, SiLichess } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

type Source = "chess-com" | "lichess" | "pgn";

interface GameSummary {
  id: string;
  date: string;
  white: { name: string; rating?: number };
  black: { name: string; rating?: number };
  whiteResult: "win" | "loss" | "draw";
  blackResult: "win" | "loss" | "draw";
  timeClass: string;
  timeControl: string;
  pgn: string;
}

interface ImportGamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadPgn: (pgn: string, importedUsername?: string) => void;
}

const STORAGE_KEY_CHESSCOM = "import_chess_com_username";
const STORAGE_KEY_LICHESS = "import_lichess_username";

const CHESSCOM_TRYOUT = [
  { label: "Magnus Carlsen", username: "MagnusCarlsen" },
  { label: "GothamChess", username: "GothamChess" },
  { label: "Hikaru", username: "Hikaru" },
];

const LICHESS_TRYOUT = [
  { label: "DrNykterstein", username: "DrNykterstein" },
  { label: "penguingim1", username: "penguingim1" },
  { label: "Zhigalko_Sergei", username: "Zhigalko_Sergei" },
];

function formatTimeControl(tc: string, timeClass: string): string {
  if (!tc) return timeClass || "?";
  const parts = tc.split("+");
  const secs = parseInt(parts[0], 10);
  const inc = parts[1] ? parseInt(parts[1], 10) : 0;
  if (isNaN(secs)) return tc;
  const mins = Math.floor(secs / 60);
  if (inc > 0) return `${mins}+${inc}`;
  if (mins === 0) return `${secs}s`;
  return `${mins} min`;
}

function timeIcon(timeClass: string) {
  const bullet = ["bullet", "ultrabullet"];
  if (bullet.includes(timeClass)) return <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />;
  return <Clock className="w-4 h-4 text-emerald-400" />;
}

function resultBadge(result: "win" | "loss" | "draw") {
  if (result === "win")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
        Win
      </span>
    );
  if (result === "loss")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
        Loss
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
      Draw
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const month = d.toLocaleString("default", { month: "long" });
  return { day: `${month} ${d.getDate()}`, year: d.getFullYear() };
}

export function ImportGamesDialog({ open, onOpenChange, onLoadPgn }: ImportGamesDialogProps) {
  const [source, setSource] = useState<Source>("chess-com");
  const [username, setUsername] = useState(() =>
    localStorage.getItem(STORAGE_KEY_CHESSCOM) || ""
  );
  const [prevUsername, setPrevUsername] = useState(() =>
    localStorage.getItem(STORAGE_KEY_CHESSCOM) || ""
  );
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [fetchedUser, setFetchedUser] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pgnText, setPgnText] = useState("");
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const storageKey = source === "chess-com" ? STORAGE_KEY_CHESSCOM : STORAGE_KEY_LICHESS;

  function handleSourceChange(s: Source) {
    setSource(s);
    setGames(null);
    setUsername(localStorage.getItem(s === "chess-com" ? STORAGE_KEY_CHESSCOM : STORAGE_KEY_LICHESS) || "");
    setPrevUsername(localStorage.getItem(s === "chess-com" ? STORAGE_KEY_CHESSCOM : STORAGE_KEY_LICHESS) || "");
  }

  async function fetchGames(nameOverride?: string) {
    const name = (nameOverride ?? username).trim();
    if (!name) return;
    setIsLoading(true);
    setGames(null);
    const endpoint = source === "chess-com" ? "chess-com" : "lichess";
    try {
      const res = await fetch(`/api/games/${endpoint}?username=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch games");
      localStorage.setItem(storageKey, name);
      setPrevUsername(name);
      setFetchedUser(name);
      setGames(data.games || []);
    } catch (e) {
      toast({
        title: "Could not fetch games",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleTryout(name: string) {
    setUsername(name);
    fetchGames(name);
  }

  function handleGameClick(game: GameSummary) {
    if (!game.pgn) {
      toast({ title: "No PGN", description: "This game has no PGN data.", variant: "destructive" });
      return;
    }
    onLoadPgn(game.pgn, fetchedUser || undefined);
    onOpenChange(false);
  }

  function handleLoadPgn() {
    if (!pgnText.trim()) return;
    onLoadPgn(pgnText.trim());
    onOpenChange(false);
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setGames(null);
    }, 300);
  }

  const tryoutList = source === "chess-com" ? CHESSCOM_TRYOUT : LICHESS_TRYOUT;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-2xl p-0 overflow-hidden bg-background border-border"
        data-testid="dialog-import-games"
      >
        {games !== null ? (
          // ── Game list view ──────────────────────────────────────────────────
          <div className="flex flex-col h-[80vh] max-h-[640px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7"
                  onClick={() => setGames(null)}
                  data-testid="button-back-to-sources"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">Chess history of</span>
                <span className="px-2 py-0.5 rounded border border-amber-500/60 text-amber-400 text-sm font-semibold bg-amber-500/10">
                  {fetchedUser}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => fetchGames()}
                  disabled={isLoading}
                  data-testid="button-refresh-games"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="px-5 py-2 border-b border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">1–{games.length}</span>{" "}
                of{" "}
                <span className="font-semibold text-foreground">{games.length}</span>{" "}
                games
              </span>
            </div>

            <div className="overflow-y-auto flex-1">
              {games.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 text-sm">No games found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-2.5 text-xs text-muted-foreground font-medium w-28">Date</th>
                      <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-medium">Players</th>
                      <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium w-20">Time</th>
                      <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium w-24">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((game, i) => {
                      const { day, year } = formatDate(game.date);
                      const userLower = fetchedUser.toLowerCase();
                      const isWhiteUser =
                        game.white.name.toLowerCase() === userLower;
                      const userResult = isWhiteUser ? game.whiteResult : game.blackResult;

                      return (
                        <tr
                          key={game.id || i}
                          className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => handleGameClick(game)}
                          data-testid={`row-game-${i}`}
                        >
                          <td className="px-5 py-3">
                            <div className="font-medium text-foreground text-xs">{day}</div>
                            <div className="text-muted-foreground text-xs">{year}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-foreground border border-border flex-shrink-0" />
                                <span
                                  className={
                                    game.white.name.toLowerCase() === userLower
                                      ? "text-amber-400 font-medium"
                                      : "text-foreground"
                                  }
                                >
                                  {game.white.name}
                                  {game.white.rating ? (
                                    <span className="text-muted-foreground ml-1 font-normal">
                                      {"{"}
                                      {game.white.rating}
                                      {"}"}
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-background border border-muted-foreground/50 flex-shrink-0" />
                                <span
                                  className={
                                    game.black.name.toLowerCase() === userLower
                                      ? "text-amber-400 font-medium"
                                      : "text-foreground"
                                  }
                                >
                                  {game.black.name}
                                  {game.black.rating ? (
                                    <span className="text-muted-foreground ml-1 font-normal">
                                      {"{"}
                                      {game.black.rating}
                                      {"}"}
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {timeIcon(game.timeClass)}
                              <span className="text-xs text-muted-foreground">
                                {formatTimeControl(game.timeControl, game.timeClass)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {resultBadge(userResult)}
                              <span className="text-xs text-muted-foreground">Rated</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          // ── Source selection view ───────────────────────────────────────────
          <div className="p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-lg font-semibold">Import Games</DialogTitle>
            </DialogHeader>

            {/* Source tiles */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {(
                [
                  { id: "chess-com", label: "Chess.com", icon: <SiChessdotcom className="w-8 h-8" /> },
                  { id: "lichess", label: "Lichess.org", icon: <SiLichess className="w-8 h-8" /> },
                  { id: "pgn", label: "PGN", icon: <FileText className="w-8 h-8" /> },
                ] as { id: Source; label: string; icon: React.ReactNode }[]
              ).map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => handleSourceChange(id)}
                  className={`relative flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 p-5 transition-all ${
                    source === id
                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:bg-muted/50"
                  }`}
                  data-testid={`button-source-${id}`}
                >
                  {source === id && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                  )}
                  {icon}
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>

            {/* PGN flow */}
            {source === "pgn" ? (
              <div className="flex flex-col gap-3">
                <Textarea
                  value={pgnText}
                  onChange={(e) => setPgnText(e.target.value)}
                  placeholder="Paste PGN here...&#10;e.g. 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"
                  className="resize-none text-sm font-mono min-h-[130px]"
                  rows={5}
                  data-testid="input-pgn"
                />
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                  disabled={!pgnText.trim()}
                  onClick={handleLoadPgn}
                  data-testid="button-load-pgn"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Load PGN
                </Button>
              </div>
            ) : (
              /* Chess.com / Lichess flow */
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-muted-foreground">
                      {source === "chess-com" ? "Chess.com" : "Lichess.org"} username
                    </label>
                    {prevUsername && (
                      <button
                        onClick={() => {
                          setUsername("");
                          setPrevUsername("");
                          localStorage.removeItem(storageKey);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors"
                        data-testid="button-clear-prev-username"
                      >
                        Previously used
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <Input
                    ref={inputRef}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={source === "chess-com" ? "e.g. MagnusCarlsen" : "e.g. DrNykterstein"}
                    className="text-base h-11 bg-background border-border"
                    onKeyDown={(e) => e.key === "Enter" && fetchGames()}
                    data-testid="input-username"
                    autoFocus
                  />
                </div>

                <Button
                  className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-base"
                  onClick={() => fetchGames()}
                  disabled={isLoading || !username.trim()}
                  data-testid="button-fetch-games"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {isLoading ? "Fetching..." : "Fetch Recent Games"}
                </Button>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Try it out:</span>
                  <div className="flex flex-wrap gap-2">
                    {tryoutList.map(({ label, username: u }) => (
                      <button
                        key={u}
                        onClick={() => handleTryout(u)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        data-testid={`button-tryout-${u}`}
                      >
                        <span className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] font-bold text-foreground">
                          {label[0]}
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
