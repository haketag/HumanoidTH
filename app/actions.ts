"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { SourceType } from "../generated/prisma";
import { prisma } from "@/lib/prisma";
import { runAdapter } from "@/lib/ingest/adapters";
import { canonicalizeUrl } from "@/lib/url";
import { authenticate, currentActor, logoutCompany, requireCompanyAdmin } from '@/lib/company-auth';
import { createAdminSessionToken, verifyAdminSessionToken } from "@/lib/admin-session";

async function requireAdminSession() {
  const token = (await cookies()).get("admin_session")?.value;
  if (!await verifyAdminSessionToken(token, process.env.ADMIN_SESSION_SECRET)) {
    await requireCompanyAdmin();
  }
}

function readTextField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalTextField(formData: FormData, key: string) {
  const value = readTextField(formData, key);
  return value || null;
}

function readOptionalUrlField(formData: FormData, key: string) {
  const value = canonicalizeUrl(readTextField(formData, key));
  return value || null;
}

function readOptionalNumberField(formData: FormData, key: string) {
  const value = readTextField(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readOptionalDateField(formData: FormData, key: string) {
  const value = readTextField(formData, key);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function revalidateAtlasCms() {
  revalidateTag('public-robot-image-sources');
  const paths = [
    "/",
    "/dashboard",
    "/database",
    "/robots",
    "/inventory",
    "/contributions",
    "/perspectives",
    "/analytics",
    "/submit-data",
    "/admin",
    "/admin/submitted-data",
    "/admin/cms"
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function createSubmission(formData: FormData) {
  const currentEmail = (await currentActor())?.email;
  if (!currentEmail) {
    redirect("/profile?from=/submit-data");
  }

  const user = await prisma.user.findUnique({ where: { email: currentEmail } });
  if (!user) {
    redirect("/profile?from=/submit-data");
  }

  const submissionType = readTextField(formData, "submissionType");
  if (submissionType !== "perspective" && submissionType !== "robot_model") {
    throw new Error("Choose Perspectives or Robot Model.");
  }

  const title = readTextField(formData, "title");
  const rawUrl = readTextField(formData, "url");
  if (!title || !rawUrl) {
    throw new Error("Title and evidence URL are required.");
  }
  const requireWebUrl = (value: string) => {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("A web URL is required.");
    return canonicalizeUrl(value);
  };
  const url = requireWebUrl(rawUrl);

  let payloadJson: Record<string, string | null>;
  let notes: string | null;

  if (submissionType === "perspective") {
    const perspectiveTheme = readTextField(formData, "perspectiveTheme");
    const stance = readTextField(formData, "stance");
    const sentiment = readTextField(formData, "sentiment");
    const evidenceExcerpt = readTextField(formData, "evidenceExcerpt");
    const themes = ["healthcare_trust", "job_displacement", "safety", "privacy", "education", "ethics", "other"];
    const stances = ["supportive", "cautious_supportive", "neutral", "skeptical", "critical", "mixed"];
    const sentiments = ["positive", "neutral", "negative", "mixed"];
    if (!themes.includes(perspectiveTheme) || !stances.includes(stance) || !sentiments.includes(sentiment) || !evidenceExcerpt) {
      throw new Error("Complete the perspective theme, stance, sentiment and evidence excerpt.");
    }
    payloadJson = { perspectiveTheme, stance, sentiment, evidenceExcerpt };
    notes = evidenceExcerpt;
  } else {
    const thailandStatus = readTextField(formData, "thailandStatus");
    const robotType = readOptionalTextField(formData, "robotType");
    const allowedStatuses = ["observed_in_thailand", "developed_in_thailand", "imported_for_evaluation", "unknown"];
    const allowedTypes = ["humanoid", "social", "service", "education", "other"];
    if (!allowedStatuses.includes(thailandStatus) || (robotType && !allowedTypes.includes(robotType))) {
      throw new Error("Choose a valid robot type and Thailand status.");
    }
    const officialUrl = readOptionalTextField(formData, "officialUrl");
    payloadJson = {
      canonicalName: title,
      manufacturer: readOptionalTextField(formData, "manufacturer"),
      developerOrg: readOptionalTextField(formData, "developerOrg"),
      countryOfOrigin: readOptionalTextField(formData, "countryOfOrigin"),
      robotType,
      thailandStatus,
      primaryUseCase: readOptionalTextField(formData, "primaryUseCase"),
      officialUrl: officialUrl ? requireWebUrl(officialUrl) : null,
      description: readOptionalTextField(formData, "description")
    };
    notes = payloadJson.description;
  }

  await prisma.submittedData.create({
    data: {
      submissionType,
      title,
      url,
      payloadJson,
      notes,
      submitterName: user.name || null,
      submitterContact: user.email,
      submittedById: user.id,
      status: "QUEUED"
    }
  });

  revalidateAtlasCms();
  revalidatePath("/profile");
  redirect("/profile");
}

export async function updateSubmissionStatus(id: string, status: "APPROVED" | "REJECTED" | "NEEDS_REVIEW") {
  await requireAdminSession();
  const submission = await prisma.submittedData.findUnique({ where: { id }, select: { submissionType: true, status: true } });
  if (submission?.submissionType === "perspective" || submission?.submissionType === "robot_model") {
    if (status === "APPROVED") {
      throw new Error("Use the destination-specific approval action.");
    }
    if (submission.status === "APPROVED") throw new Error("Published submissions cannot return to the review queue.");
  }
  await prisma.submittedData.update({ where: { id }, data: { status } });
  revalidateAtlasCms();
}

export async function approvePerspectiveSubmission(id: string) {
  await requireAdminSession();

  await prisma.$transaction(async (tx) => {
    const submission = await tx.submittedData.findUnique({ where: { id } });
    if (!submission || submission.submissionType !== "perspective") throw new Error("Perspective submission not found.");
    if (submission.status === "APPROVED") return;
    if (submission.status !== "QUEUED" && submission.status !== "NEEDS_REVIEW") {
      throw new Error("This submission is not ready for approval.");
    }

    const payload = submission.payloadJson;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid perspective details.");
    const theme = payload.perspectiveTheme;
    const stance = payload.stance;
    const sentiment = payload.sentiment;
    const excerpt = payload.evidenceExcerpt;
    if (!submission.title.trim() || !submission.url ||
        !["healthcare_trust", "job_displacement", "safety", "privacy", "education", "ethics", "other"].includes(String(theme)) ||
        !["supportive", "cautious_supportive", "neutral", "skeptical", "critical", "mixed"].includes(String(stance)) ||
        !["positive", "neutral", "negative", "mixed"].includes(String(sentiment)) ||
        typeof excerpt !== "string" || !excerpt.trim()) {
      throw new Error("Perspective submission is incomplete.");
    }

    const claimed = await tx.submittedData.updateMany({
      where: { id, status: { in: ["QUEUED", "NEEDS_REVIEW"] } },
      data: { status: "APPROVED" }
    });
    if (claimed.count !== 1) throw new Error("Submission was already reviewed. Reload and try again.");

    const source = await tx.sourceRecord.upsert({
      where: { url: submission.url },
      create: {
        sourceType: "SUBMISSION",
        title: submission.title,
        url: submission.url,
        excerpt,
        platform: "community_submission",
        rawMeta: { submissionId: id },
        relevanceStatus: "ACCEPTED",
        relevanceReason: "Approved community perspective submission",
        relevanceConfidence: 0.5
      },
      update: {}
    });

    const annotationKey = {
      sourceId: source.id,
      perspectiveTheme: String(theme),
      targetEntity: "humanoid/social robotics",
      evidenceExcerpt: excerpt
    };
    const existingAnnotation = await tx.perspectiveAnnotation.findUnique({
      where: { sourceId_perspectiveTheme_targetEntity_evidenceExcerpt: annotationKey }
    });
    if (existingAnnotation && (existingAnnotation.stance !== stance || existingAnnotation.sentiment !== sentiment)) {
      throw new Error("An existing perspective uses this evidence with different labels. Review it before approving.");
    }
    const annotation = await tx.perspectiveAnnotation.upsert({
      where: { sourceId_perspectiveTheme_targetEntity_evidenceExcerpt: annotationKey },
      create: {
        sourceId: source.id,
        perspectiveTheme: String(theme),
        stance: String(stance),
        sentiment: String(sentiment),
        evidenceExcerpt: excerpt,
        targetEntity: "humanoid/social robotics",
        confidence: 0.5,
        method: "admin_reviewed_submission"
      },
      update: {}
    });
    await tx.submittedData.update({
      where: { id },
      data: { payloadJson: { ...payload, publishedSourceId: source.id, publishedAnnotationId: annotation.id } }
    });
  });

  revalidateAtlasCms();
  revalidatePath("/profile");
  revalidatePath("/network");
}

export async function approveRobotModelSubmission(id: string) {
  await requireAdminSession();

  await prisma.$transaction(async (tx) => {
    const submission = await tx.submittedData.findUnique({ where: { id } });
    if (!submission || submission.submissionType !== "robot_model") throw new Error("Robot Model submission not found.");
    if (submission.status === "APPROVED") return;
    if (submission.status !== "QUEUED" && submission.status !== "NEEDS_REVIEW") {
      throw new Error("This submission is not ready for approval.");
    }

    const payload = submission.payloadJson;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid robot model details.");
    const name = submission.title.trim();
    const thailandStatus = payload.thailandStatus;
    const robotType = payload.robotType;
    if (!name || !submission.url ||
        !["observed_in_thailand", "developed_in_thailand", "imported_for_evaluation", "unknown"].includes(String(thailandStatus)) ||
        (robotType != null && !["humanoid", "social", "service", "education", "other"].includes(String(robotType)))) {
      throw new Error("Robot Model submission is incomplete.");
    }

    const duplicate = await tx.robotModel.findFirst({
      where: { canonicalName: { equals: name, mode: "insensitive" } },
      select: { id: true }
    });
    if (duplicate) throw new Error("A robot model with this name already exists. Review the existing model before approving.");

    const claimed = await tx.submittedData.updateMany({
      where: { id, status: { in: ["QUEUED", "NEEDS_REVIEW"] } },
      data: { status: "APPROVED" }
    });
    if (claimed.count !== 1) throw new Error("Submission was already reviewed. Reload and try again.");

    const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
    const robot = await tx.robotModel.create({
      data: {
        canonicalName: name,
        manufacturer: optionalText(payload.manufacturer),
        developerOrg: optionalText(payload.developerOrg),
        countryOfOrigin: optionalText(payload.countryOfOrigin),
        robotType: optionalText(robotType) || "unknown",
        thailandStatus: String(thailandStatus),
        primaryUseCase: optionalText(payload.primaryUseCase),
        officialUrl: optionalText(payload.officialUrl),
        description: optionalText(payload.description),
        sourceMeta: { submissionId: id, evidenceUrl: submission.url }
      }
    });
    await tx.submittedData.update({
      where: { id },
      data: { payloadJson: { ...payload, publishedRobotModelId: robot.id } }
    });
  });

  revalidateAtlasCms();
  revalidatePath("/profile");
  revalidatePath("/network");
  revalidatePath("/map");
}

export async function runDataPull(formData: FormData) {
  await requireAdminSession();
  const adapter = String(formData.get("adapter") ?? "OPENALEX") as SourceType;
  const query = String(formData.get("query") ?? "").trim();
  const limit = Number(formData.get("limit") ?? 10);

  if (!query) {
    throw new Error("Query is required.");
  }

  const job = await prisma.sourcePullJob.create({
    data: { adapter, query, status: "RUNNING", startedAt: new Date() }
  });

  try {
    const result = await runAdapter(adapter, { query, limit });
    await prisma.sourcePullJob.update({
      where: { id: job.id },
      data: {
        status: result.missingKeys?.length ? "SKIPPED_MISSING_KEY" : "SUCCEEDED",
        recordsFound: result.recordsFound,
        recordsSaved: result.recordsSaved,
        errorMessage: result.missingKeys?.join(", ") || null,
        finishedAt: new Date()
      }
    });
  } catch (error) {
    await prisma.sourcePullJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown ingestion error",
        finishedAt: new Date()
      }
    });
  }

  revalidatePath("/data-pulls");
  revalidatePath("/");
}

export async function loginAsUser(email: string, role: string) {
  // The legacy email/role selector is not proof of identity.
  redirect('/company');
}

export async function registerAndLoginUser(formData: FormData) {
  redirect('/company');
}

export async function logoutUser() {
  await logoutCompany();
  const cookieStore = await cookies();
  cookieStore.delete("user_email");
  cookieStore.delete("user_role");
  cookieStore.delete("admin_session");
  revalidatePath("/profile");
  revalidateAtlasCms();
  redirect("/profile");
}

export async function adminLoginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const requestedFrom = String(formData.get("from") ?? "/admin?collection=submitted-data");
  const redirectTo = requestedFrom.startsWith("/") && !requestedFrom.startsWith("//") && !requestedFrom.includes("\\")
    ? requestedFrom
    : "/admin?collection=submitted-data";
  const sessionToken = await createAdminSessionToken(process.env.ADMIN_SESSION_SECRET);
  if (!sessionToken) redirect("/admin-login?error=configuration");
  try {
    const actor = await authenticate({ email, password }, false, { adminOnly: true });

    const cookieStore = await cookies();
    const secure = process.env.NODE_ENV === "production";
    cookieStore.set("user_email", actor.email, { path: "/", httpOnly: true, sameSite: "strict", secure });
    cookieStore.set("user_role", "ADMIN", { path: "/", httpOnly: true, sameSite: "strict", secure });
    cookieStore.set("admin_session", sessionToken, { path: "/", httpOnly: true, sameSite: "strict", secure, maxAge: 8 * 60 * 60 });
  } catch {
    redirect("/admin-login?error=invalid_credentials");
  }

  revalidateAtlasCms();
  redirect(redirectTo);
}

export async function setLanguage(lang: "en" | "th") {
  const cookieStore = await cookies();
  cookieStore.set("lang", lang, { path: "/" });
  revalidatePath("/", "layout");
}

export async function upsertSourceRecordAction(formData: FormData) {
  await requireAdminSession();
  const id = readTextField(formData, "id");
  const url = readOptionalUrlField(formData, "url");
  const sourceType = readTextField(formData, "sourceType") as any;
  const title = readTextField(formData, "title");

  if (!title) throw new Error("Source title is required.");
  if (!url) throw new Error("Source URL is required.");

  const existing = id
    ? await prisma.sourceRecord.findUnique({ where: { id }, select: { rawMeta: true } })
    : null;

  const payload = {
    sourceType,
    title,
    url,
    excerpt: readOptionalTextField(formData, "excerpt") || "",
    publishedAt: readOptionalDateField(formData, "publishedAt"),
    author: readOptionalTextField(formData, "author"),
    platform: readOptionalTextField(formData, "platform"),
    relevanceStatus: readTextField(formData, "relevanceStatus") as any,
    relevanceReason: readOptionalTextField(formData, "relevanceReason"),
    relevanceConfidence: readOptionalNumberField(formData, "relevanceConfidence") ?? 0
  };

  if (id) {
    await prisma.sourceRecord.update({ where: { id }, data: { ...payload, rawMeta: existing?.rawMeta ?? {} } });
  } else {
    await prisma.sourceRecord.upsert({
      where: { url },
      create: { ...payload, rawMeta: {} },
      update: { ...payload, rawMeta: existing?.rawMeta ?? {} }
    });
  }

  revalidateAtlasCms();
}

export async function upsertRobotModelAction(formData: FormData) {
  await requireAdminSession();
  const id = readTextField(formData, "id");
  const canonicalName = readTextField(formData, "canonicalName");

  if (!canonicalName) throw new Error("Canonical name is required.");

  const existing = id
    ? await prisma.robotModel.findUnique({ where: { id }, select: { sourceMeta: true } })
    : null;

  const payload = {
    canonicalName,
    manufacturer: readOptionalTextField(formData, "manufacturer"),
    developerOrg: readOptionalTextField(formData, "developerOrg"),
    countryOfOrigin: readOptionalTextField(formData, "countryOfOrigin"),
    robotType: readOptionalTextField(formData, "robotType") || "unknown",
    embodimentLevel: readOptionalTextField(formData, "embodimentLevel"),
    primaryUseCase: readOptionalTextField(formData, "primaryUseCase"),
    thailandStatus: readOptionalTextField(formData, "thailandStatus") || "observed_in_thailand",
    statusConfidence: readOptionalNumberField(formData, "statusConfidence") ?? 0.5,
    officialUrl: readOptionalUrlField(formData, "officialUrl"),
    description: readOptionalTextField(formData, "description"),
    firstSeenYear: readOptionalNumberField(formData, "firstSeenYear"),
    lastVerifiedAt: readOptionalDateField(formData, "lastVerifiedAt")
  };

  if (id) {
    await prisma.robotModel.update({ where: { id }, data: { ...payload, sourceMeta: existing?.sourceMeta ?? {} } });
  } else {
    await prisma.robotModel.upsert({
      where: { canonicalName },
      create: { ...payload, sourceMeta: {} },
      update: { ...payload, sourceMeta: existing?.sourceMeta ?? {} }
    });
  }

  revalidateAtlasCms();
}

export async function upsertContributionAction(formData: FormData) {
  await requireAdminSession();
  const id = readTextField(formData, "id");
  const title = readTextField(formData, "title");
  const contributionType = readTextField(formData, "contributionType");
  const sourceUrl = readOptionalUrlField(formData, "sourceUrl");

  if (!title) throw new Error("Contribution title is required.");
  if (!contributionType) throw new Error("Contribution type is required.");

  const payload = {
    contributorName: readOptionalTextField(formData, "contributorName"),
    contributorType: readOptionalTextField(formData, "contributorType"),
    organization: readOptionalTextField(formData, "organization"),
    contributionType,
    title,
    description: readOptionalTextField(formData, "description"),
    relatedRobotModelId: readOptionalTextField(formData, "relatedRobotModelId"),
    sourceUrl,
    license: readOptionalTextField(formData, "license"),
    visibility: readOptionalTextField(formData, "visibility") || "public",
    verificationStatus: readOptionalTextField(formData, "verificationStatus") as any || "NEEDS_REVIEW"
  };

  if (id) {
    await prisma.contribution.update({ where: { id }, data: payload });
  } else if (sourceUrl) {
    await prisma.contribution.upsert({
      where: { sourceUrl },
      create: payload,
      update: payload
    });
  } else {
    await prisma.contribution.create({ data: payload });
  }

  revalidateAtlasCms();
}

export async function upsertSubmittedDataAction(formData: FormData) {
  await requireAdminSession();
  const id = readTextField(formData, "id");
  const title = readTextField(formData, "title");
  const submissionType = readTextField(formData, "submissionType");

  if (!title) throw new Error("Submission title is required.");
  if (!submissionType) throw new Error("Submission type is required.");
  const requestedStatus = readOptionalTextField(formData, "status") || "QUEUED";
  const existingSubmission = id
    ? await prisma.submittedData.findUnique({ where: { id }, select: { submissionType: true, status: true } })
    : null;
  if ((submissionType === "perspective" || submissionType === "robot_model" ||
       existingSubmission?.submissionType === "perspective" || existingSubmission?.submissionType === "robot_model") &&
      requestedStatus === "APPROVED" && existingSubmission?.status !== "APPROVED") {
    throw new Error("Use the destination-specific approval action.");
  }
  if (existingSubmission?.status === "APPROVED" && requestedStatus !== "APPROVED" &&
      (existingSubmission.submissionType === "perspective" || existingSubmission.submissionType === "robot_model")) {
    throw new Error("Published submissions cannot return to the review queue.");
  }

  const payload = {
    submissionType,
    title,
    url: readOptionalUrlField(formData, "url"),
    notes: readOptionalTextField(formData, "notes"),
    submitterName: readOptionalTextField(formData, "submitterName"),
    submitterContact: readOptionalTextField(formData, "submitterContact"),
    status: requestedStatus as any,
    reviewNotes: readOptionalTextField(formData, "reviewNotes")
  };

  if (id) {
    await prisma.submittedData.update({ where: { id }, data: payload });
  } else {
    await prisma.submittedData.create({ data: { ...payload, payloadJson: {} } });
  }

  revalidateAtlasCms();
}
