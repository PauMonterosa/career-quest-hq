export type IntelligenceItem = {
  agent: string; kind: string; entity: string; url: string; title?: string;
  status?: string; error?: string; signals?: Record<string, string[]>; message?: string;
};
export type IntelligenceFeed = {
  generated_at: string;
  summary: { targets: number; verified: number; discoveries: number; changes: number };
  sources: IntelligenceItem[]; discoveries: IntelligenceItem[]; changes: IntelligenceItem[];
};
const EMPTY_FEED: IntelligenceFeed = {
  generated_at: "", summary: { targets: 0, verified: 0, discoveries: 0, changes: 0 },
  sources: [], discoveries: [], changes: [],
};
export async function fetchIntelligence(): Promise<IntelligenceFeed> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/intelligence.json`, { cache: "no-store" });
    return response.ok ? await response.json() as IntelligenceFeed : EMPTY_FEED;
  } catch { return EMPTY_FEED; }
}
export async function inspectGitHub(username = "PauMonterosa") {
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=20`);
    if (!response.ok) throw new Error("GitHub no disponible");
    const repos = await response.json() as Array<Record<string, unknown>>;
    return repos.map(repo => ({
      name: String(repo.name ?? ""), url: String(repo.html_url ?? ""), description: String(repo.description ?? ""),
      language: String(repo.language ?? "Sin indicar"), stars: Number(repo.stargazers_count ?? 0),
      updated_at: String(repo.updated_at ?? ""), has_pages: Boolean(repo.has_pages), archived: Boolean(repo.archived),
    }));
  } catch { return []; }
}
export function compactEvidence(signals?: Record<string, string[]>) {
  if (signals) for (const category of ["deadlines", "admission", "research", "people_contact", "fees_funding"]) {
    if (signals[category]?.[0]) return signals[category][0].slice(0, 360);
  }
  return "Fuente oficial localizada; abre el enlace para revisar el contenido.";
}
