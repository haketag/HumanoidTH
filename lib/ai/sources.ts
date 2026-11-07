export function classifySourceKind(urlValue: string, manufacturerNames: string[] = []): "official" | "academic" | "external" {
  try {
    const host = new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "");
    const knownNames = manufacturerNames.map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
    if (knownNames.some((name) => name.length >= 4 && host.replace(/[^a-z0-9]/g, "").includes(name))) return "official";
    if (/(^|\.)(gov|go\.th|edu|ac\.th|edu\.th|gov\.th)$/.test(host) || ["arxiv.org", "doi.org", "pubmed.ncbi.nlm.nih.gov"].includes(host) || host.endsWith(".edu")) return "academic";
    if (host === "github.com") return "official";
    return "external";
  } catch {
    return "external";
  }
}
