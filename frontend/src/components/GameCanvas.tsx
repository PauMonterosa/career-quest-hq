import { useEffect, useRef } from "react";
import { createCareerQuestGame } from "../game/CareerQuestGame";

export function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const game = createCareerQuestGame(host.current);
    return () => game.destroy(true);
  }, []);
  return <div ref={host} className="game-host" aria-label="Interactive pixel-art office" />;
}

