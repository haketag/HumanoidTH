import type { SourceType } from "../../generated/prisma";
import type { IngestResult, NormalizedSource } from "@/lib/ingest/types";
import { saveSources } from "@/lib/ingest/save";

type AdapterInput = {
  query: string;
  limit?: number;
  days?: number;
  fromYear?: number;
};

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}

function validDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  const isoValue = compact ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z` : value;
  const date = new Date(isoValue);
  if (compact && !Number.isNaN(date.getTime()) && date.toISOString() !== isoValue.replace(/Z$/, ".000Z")) return null;
  return Number.isNaN(date.getTime()) ? null : date;
}

async function finish(adapter: SourceType, query: string, records: NormalizedSource[], missingKeys: string[] = []): Promise<IngestResult> {
  return {
    adapter,
    query,
    recordsFound: records.length,
    recordsSaved: records.length ? await saveSources(records) : 0,
    missingKeys
  };
}

export function reconstructOpenAlexAbstract(index: unknown) {
  if (!index || typeof index !== "object" || Array.isArray(index)) return "";
  const wordsByPosition: string[] = [];
  for (const [word, rawPositions] of Object.entries(index as Record<string, unknown>)) {
    if (!Array.isArray(rawPositions)) continue;
    for (const position of rawPositions) {
      if (typeof position === "number" && Number.isSafeInteger(position) && position >= 0 && position < 100_000) {
        wordsByPosition[position] = word;
      }
    }
  }
  return wordsByPosition.filter((word): word is string => typeof word === "string").join(" ").replace(/\s+/g, " ").trim();
}

export function parseOpenAlexPublicationDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function parseOpenAlexAccessLinks(value: unknown) {
  const asRecord = (item: unknown): Record<string, unknown> => item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
  const work = asRecord(value);
  const location = asRecord(work.best_oa_location);
  const openAccess = asRecord(work.open_access);
  return {
    pdfUrl: isHttpUrl(location.pdf_url) ? location.pdf_url : null,
    landingPageUrl: isHttpUrl(location.landing_page_url) ? location.landing_page_url : null,
    isOpenAccess: typeof openAccess.is_oa === "boolean" ? openAccess.is_oa : null
  };
}

export async function ingestOpenAlex({ query, limit = 25, fromYear = 2015 }: AdapterInput) {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("filter", `from_publication_date:${fromYear}-01-01`);
  url.searchParams.set("per-page", String(Math.min(limit, 50)));

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`OpenAlex ${response.status}`);
  const payload = await response.json();

  const records: NormalizedSource[] = (payload.results ?? []).flatMap((work: any) => {
    const publicationDate = parseOpenAlexPublicationDate(work.publication_date);
    const reconstructedAbstract = reconstructOpenAlexAbstract(work.abstract_inverted_index);
    const authors = Array.isArray(work.authorships)
      ? work.authorships.slice(0, 20).map((item: any) => item.author?.display_name).filter((name: unknown): name is string => typeof name === "string")
      : [];
    const url = isHttpUrl(work.doi) ? work.doi : work.id;
    if (!isHttpUrl(url)) return [];
    const accessLinks = parseOpenAlexAccessLinks(work);
    return [{
      sourceType: "OPENALEX" as const,
      title: typeof work.display_name === "string" && work.display_name.trim() ? work.display_name : "Untitled OpenAlex work",
      url,
      excerpt: reconstructedAbstract.slice(0, 1200),
      publishedAt: publicationDate,
      author: authors.join(", ") || null,
      platform: "openalex",
      rawMeta: {
        openalexId: work.id,
        doi: work.doi ?? null,
        openAccessPdfUrl: accessLinks.pdfUrl,
        openAccessLandingUrl: accessLinks.landingPageUrl,
        isOpenAccess: accessLinks.isOpenAccess,
        publicationYear: work.publication_year ?? null,
        publicationDatePrecision: publicationDate ? "day" : work.publication_year ? "year_only" : "unknown",
        abstractTruncated: reconstructedAbstract.length > 1200,
        workType: work.type ?? null,
        authors,
        isRetracted: work.is_retracted ?? null,
        query
      }
    }];
  });

  return finish("OPENALEX", query, records);
}

export async function ingestGithub({ query, limit = 25 }: AdapterInput) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", String(Math.min(limit, 100)));

  const headers: HeadersInit = { Accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  const payload = await response.json();

  const records: NormalizedSource[] = (payload.items ?? []).filter((repo: any) => isHttpUrl(repo.html_url)).map((repo: any) => ({
    sourceType: "GITHUB",
    title: repo.full_name,
    url: repo.html_url,
    excerpt: repo.description ?? "",
    author: repo.owner?.login ?? null,
    platform: "github",
    rawMeta: { stars: repo.stargazers_count, language: repo.language, query }
  }));

  return finish("GITHUB", query, records, token ? [] : ["GITHUB_TOKEN optional"]);
}

export async function ingestGdelt({ query, limit = 25, days = 30 }: AdapterInput) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(Math.min(limit, 250)));
  url.searchParams.set("timespan", `${days}d`);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`GDELT ${response.status}`);
  const payload = await response.json();

  const records: NormalizedSource[] = (payload.articles ?? []).filter((article: any) => isHttpUrl(article.url)).map((article: any) => ({
    sourceType: "GDELT",
    title: article.title ?? "Untitled GDELT article",
    url: article.url,
    excerpt: article.snippet ?? "",
    publishedAt: validDate(article.seendate),
    platform: article.domain ?? "gdelt",
    rawMeta: { query, source: article }
  }));

  return finish("GDELT", query, records);
}

export async function ingestYoutube({ query, limit = 25 }: AdapterInput) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return finish("YOUTUBE", query, [], ["YOUTUBE_API_KEY"]);
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(Math.min(limit, 50)));
  url.searchParams.set("key", key);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`YouTube ${response.status}`);
  const payload = await response.json();

  const records: NormalizedSource[] = (payload.items ?? []).filter((item: any) => typeof item.id?.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(item.id.videoId)).map((item: any) => ({
    sourceType: "YOUTUBE",
    title: item.snippet?.title ?? "Untitled YouTube video",
    url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    excerpt: item.snippet?.description ?? "",
    publishedAt: validDate(item.snippet?.publishedAt),
    author: item.snippet?.channelTitle ?? null,
    platform: "youtube",
    rawMeta: { query, videoId: item.id?.videoId }
  }));

  return finish("YOUTUBE", query, records);
}

export async function runAdapter(adapter: SourceType, input: AdapterInput) {
  switch (adapter) {
    case "OPENALEX":
      return ingestOpenAlex(input);
    case "GITHUB":
      return ingestGithub(input);
    case "GDELT":
      return ingestGdelt(input);
    case "YOUTUBE":
      return ingestYoutube(input);
    default:
      throw new Error(`Adapter ${adapter} is not implemented for API pulling yet.`);
  }
}
