"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAdminSessionToken } from "@/lib/admin-session";

async function requireAdminSession() {
  const token = (await cookies()).get("admin_session")?.value;
  if (!await verifyAdminSessionToken(token, process.env.ADMIN_SESSION_SECRET)) {
    throw new Error("Unauthorized. A valid administrator session is required.");
  }
}

export type ContributionMapPoint = {
  id: string;
  title: string;
  organization: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  summary: string;
  contributorType: string;
  contributionCount: number;
  detailsList: string[];
};

async function analyzeClusters(): Promise<ContributionMapPoint[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL?.trim();
  if (!apiKey || apiKey === "mock_key" || apiKey.trim() === "" || !model) {
    throw new Error("GEMINI_API_KEY and GEMINI_MODEL must be configured with valid values.");
  }

  // 1. Fetch contributions, robot models, and owned inventory
  const [contributions, robots, inventory] = await Promise.all([
    prisma.contribution.findMany({
      where: { visibility: "public", verificationStatus: "APPROVED" },
      select: {
        id: true,
        title: true,
        description: true,
        organization: true,
        contributorName: true,
        contributionType: true
      }
    }),
    prisma.robotModel.findMany({
      select: {
        id: true,
        canonicalName: true,
        description: true,
        developerOrg: true,
        countryOfOrigin: true
      }
    }),
    prisma.ownedInventory.findMany({
      where: { visibility: "public" },
      select: {
        id: true,
        displayName: true,
        ownerOrg: true,
        locationLabel: true,
        ownershipStatus: true
      }
    })
  ]);

  // 2. Prepare the payload for Gemini
  const payload = {
    contributions: contributions.map(c => ({
      type: "contribution",
      id: c.id,
      title: c.title,
      description: c.description,
      org: c.organization || c.contributorName,
      contribType: c.contributionType
    })),
    robots: robots.map(r => ({
      type: "robot_model",
      id: r.id,
      name: r.canonicalName,
      desc: r.description,
      org: r.developerOrg,
      country: r.countryOfOrigin
    })),
    inventory: inventory.map(i => ({
      type: "owned_inventory",
      id: i.id,
      name: i.displayName,
      org: i.ownerOrg,
      location: i.locationLabel,
      ownershipStatus: i.ownershipStatus
    }))
  };

  const prompt = `
You are an expert GIS and robotics analyst mapping the humanoid and social robotics ecosystem in Thailand.
Below is the database dump of contributions, robot models, and owned inventory from the Thailand Humanoid Atlas:

${JSON.stringify(payload, null, 2)}

Please read through all records and group/cluster them by geographical location of their development, research, or deployment within Thailand. 
Identify the key institutions, labs, or organizations (e.g. universities like Chulalongkorn, KMUTT, VISTEC, Chiang Mai University, or companies like CT Asia Robotics) responsible for these contributions.

For each cluster/location:
1. Provide a unique ID.
2. Set 'title' to the institution or entity name (e.g. "Chulalongkorn University Robotics Lab").
3. Set 'organization' to the organization name.
4. Set 'locationLabel' to the city and region in Thailand (e.g., "Bangkok, Thailand" or "Rayong, Thailand").
5. Geocode the location and set 'latitude' and 'longitude' to its coordinates in Thailand (use precise coordinates for the campus/facility if known, otherwise default to city coordinates).
6. Set 'summary' to a concise 1-2 sentence description summarizing what humanoid robotics contributions came from this location based on the database data (e.g. what robots they own, what papers/repos they contributed, etc.).
7. Set 'contributorType' to one of: "University", "Enterprise", "Government", "Community".
8. Set 'contributionCount' to the count of connected database records.
9. Set 'detailsList' to a list of titles/names of the specific contributions/robots/inventory connected to this location.

Return the response as a JSON object matching the requested schema.
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            clusters: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  title: { type: "STRING" },
                  organization: { type: "STRING" },
                  locationLabel: { type: "STRING" },
                  latitude: { type: "NUMBER" },
                  longitude: { type: "NUMBER" },
                  summary: { type: "STRING" },
                  contributorType: { type: "STRING" },
                  contributionCount: { type: "NUMBER" },
                  detailsList: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                  }
                },
                required: ["id", "title", "organization", "locationLabel", "latitude", "longitude", "summary", "contributorType", "contributionCount", "detailsList"]
              }
            }
          },
          required: ["clusters"]
        }
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API returned error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error("Empty response from Gemini API");
  }

  const parsed = JSON.parse(textResponse);
  const clusters = (parsed.clusters || []) as ContributionMapPoint[];
  
  // Save to StatsCache
  await prisma.statsCache.upsert({
    where: { key: "map_contribution_clusters" },
    update: {
      valueJson: clusters as any,
      updatedAt: new Date()
    },
    create: {
      key: "map_contribution_clusters",
      valueJson: clusters as any
    }
  });

  return clusters;
}

export async function analyzeClustersWithGemini(): Promise<ContributionMapPoint[]> {
  await requireAdminSession();
  return analyzeClusters();
}

export async function fetchContributionClusters(): Promise<ContributionMapPoint[]> {
  try {
    const cached = await prisma.statsCache.findUnique({
      where: { key: "map_contribution_clusters" }
    });
    if (cached && cached.valueJson && Array.isArray(cached.valueJson)) {
      return cached.valueJson as unknown as ContributionMapPoint[];
    }
  } catch (e) {
    console.error("Cache fetch failed:", e);
  }

  return [];
}

export async function reanalyzeClustersWithGemini() {
  await requireAdminSession();
  try {
    await analyzeClusters();
  } catch (e) {
    console.error("Map reanalysis failed; no synthetic data was saved:", e);
  }
  revalidatePath("/map");
}
