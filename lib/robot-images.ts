export type SourceLike = {
  title: string;
  url: string;
  platform: string | null;
  rawMeta: unknown;
};

type RobotLike = {
  canonicalName: string;
  officialUrl: string | null;
  sourceMeta: unknown;
};

const imageMetaKeys = [
  "thumbnail",
  "thumbnailUrl",
  "thumbnail_url",
  "image",
  "imageUrl",
  "image_url",
  "banner",
  "bannerUrl",
  "banner_url",
  "ogImage",
  "og:image",
  "coverImage",
  "cover_image"
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getStringField(meta: unknown, keys: string[]) {
  const record = asRecord(meta);
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractYoutubeVideoId(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "") || null;
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop() || null;
  } catch {
    return null;
  }
  return null;
}

function getSourceImageUrl(url: string | null, meta: unknown) {
  const explicitImage = getStringField(meta, imageMetaKeys);
  if (explicitImage) return explicitImage;

  const videoId = getStringField(meta, ["videoId", "video_id"]) ?? extractYoutubeVideoId(url);
  if (videoId) return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;

  return null;
}

function findRobotSource(robot: RobotLike, sources: SourceLike[]) {
  const robotName = robot.canonicalName.toLowerCase();
  const officialUrl = robot.officialUrl?.toLowerCase() ?? null;
  const metaTitle = getStringField(robot.sourceMeta, ["title"])?.toLowerCase() ?? null;

  return sources.find((source) => {
    const raw = asRecord(source.rawMeta);
    const canonicalName = typeof raw?.canonicalName === "string" ? raw.canonicalName.toLowerCase() : null;
    const sourceUrl = source.url.toLowerCase();
    const sourceTitle = source.title.toLowerCase();

    return (
      (officialUrl && sourceUrl === officialUrl) ||
      (canonicalName && canonicalName === robotName) ||
      (metaTitle && sourceTitle === metaTitle) ||
      sourceTitle.includes(robotName)
    );
  }) ?? null;
}

export function getRobotSourceImage(robot: RobotLike, sources: SourceLike[]) {
  const meta = asRecord(robot.sourceMeta);
  // Reviewed records must never borrow a thumbnail from a loosely matching article.
  if (meta?.sourceReview) return typeof meta.imageUrl === 'string' ? meta.imageUrl : null;
  const robotMetaImage = getSourceImageUrl(robot.officialUrl, robot.sourceMeta);
  if (robotMetaImage) return robotMetaImage;

  const source = findRobotSource(robot, sources);
  return getSourceImageUrl(source?.url ?? robot.officialUrl, source?.rawMeta ?? null);
}

export function getRobotImageCredit(meta: unknown) {
  const record = asRecord(meta);
  const url = getStringField(meta, ['imageSourceUrl']);
  return url && /^https?:\/\//i.test(url) ? {
    url, text: getStringField(meta, ['imageCredit']) || 'Original publisher',
    caption: typeof record?.imageCaption === 'string' ? record.imageCaption : null,
  } : null;
}
import reviewedProfiles from '../data/robot-profiles.json';


const reviewedImagesByName = new Map(reviewedProfiles.map(({ name, sourceMeta }) => [
  name.trim().toLowerCase(),
  { url: sourceMeta.imageUrl, credit: getRobotImageCredit(sourceMeta) },
]));

export function getReviewedRobotImage(name: string) {
  return reviewedImagesByName.get(name.trim().toLowerCase()) ?? null;
}
