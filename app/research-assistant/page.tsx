import type { Metadata } from "next";
import { cookies } from "next/headers";
import ResearchAssistantClient from "./ResearchAssistantClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Assistant | Thailand Humanoid Atlas",
  description: "Search robot and research records in the HumanoidTH atlas with citations and transparent limits.",
  alternates: { canonical: "/research-assistant" }
};

export default async function ResearchAssistantPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const cookieStore = await cookies();
  const lang = cookieStore.get("lang")?.value === "th" ? "th" : "en";
  const params = await searchParams;
  const initialQuestion = (params?.q || "").trim().slice(0, 500);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_MODEL?.trim());
  return <ResearchAssistantClient key={lang} lang={lang} geminiConfigured={geminiConfigured} initialQuestion={initialQuestion} />;
}
