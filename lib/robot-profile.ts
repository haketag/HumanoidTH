import { safeUrl } from './humanoid-match';
import { publicUrl } from './company-validation';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function companyEvidence(meta: Record<string, unknown>) {
  if (record(meta.sourceReview).status !== 'admin_approved_company_submission') return null;

  const submission = record(meta.companySubmission);
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const sourceLink = (value: unknown) => {
    const url = text(value);
    return publicUrl(url) ? safeUrl(url) : null;
  };
  const capabilities = (Array.isArray(submission.capabilities) ? submission.capabilities : []).flatMap((item: unknown) => {
    const capability = record(item);
    const claim = text(capability.claim);
    const source = sourceLink(capability.source);
    return claim && source ? [{ claim, source }] : [];
  });
  const sources = (Array.isArray(submission.sources) ? submission.sources : []).flatMap((value: unknown) => {
    const url = sourceLink(value);
    return url ? [url] : [];
  });
  return {
    organization: text(submission.submittedByOrganization),
    modelIdentifier: text(submission.modelIdentifier),
    specifications: text(submission.specifications),
    capabilities,
    sources: [...new Set(sources)],
  };
}

export function robotProfile(meta: unknown, officialUrl: string | null) {
  const metadata = record(meta);
  const review = record(metadata.sourceReview);
  const contact = record(metadata.contact);
  return {
    sourceUrl: safeUrl(review?.sourceUrl) || safeUrl(officialUrl),
    sourceKind: typeof review?.kind === 'string' ? review.kind : null,
    descriptionTh: typeof metadata.descriptionTh === 'string' ? metadata.descriptionTh : null,
    contactUrl: safeUrl(contact?.url),
    contactName: typeof contact?.name === 'string' ? contact.name : null,
    contactKind: contact?.kind === 'company' ? 'company' : contact?.kind === 'institution' ? 'institution' : 'website',
    companyEvidence: companyEvidence(metadata),
  };
}
