import { safeUrl } from './humanoid-match';

export function robotProfile(meta: unknown, officialUrl: string | null) {
  const record = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, unknown> : {};
  const review = record.sourceReview as { sourceUrl?: unknown; kind?: unknown; notes?: unknown } | undefined;
  const contact = record.contact as { url?: unknown; name?: unknown; kind?: unknown } | undefined;
  return {
    sourceUrl: safeUrl(review?.sourceUrl) || safeUrl(officialUrl),
    sourceKind: typeof review?.kind === 'string' ? review.kind : null,
    descriptionTh: typeof record.descriptionTh === 'string' ? record.descriptionTh : null,
    contactUrl: safeUrl(contact?.url),
    contactName: typeof contact?.name === 'string' ? contact.name : null,
    contactKind: contact?.kind === 'company' ? 'company' : contact?.kind === 'institution' ? 'institution' : 'website',
  };
}
