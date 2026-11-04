import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logoutUser } from "@/app/actions";
import { verifyAdminSessionToken } from "@/lib/admin-session";
import { getTranslation } from "@/lib/translations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "User Profile",
  robots: { index: false, follow: false }
};

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const authenticated = await verifyAdminSessionToken(cookieStore.get("admin_session")?.value, process.env.ADMIN_SESSION_SECRET);
  const currentEmail = authenticated ? cookieStore.get("user_email")?.value : undefined;
  const currentRole = authenticated ? "ADMIN" : undefined;
  const lang = (cookieStore.get("lang")?.value || "en") as "en" | "th";
  const t = getTranslation(lang);

  let users: any[] = [];
  let currentUser: any = null;
  let userSubmissions: any[] = [];
  try {
    [users, currentUser] = await Promise.all([
      authenticated ? prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 }) : Promise.resolve([]),
      currentEmail
        ? prisma.user.findUnique({
            where: { email: currentEmail },
            include: { submissions: { orderBy: { createdAt: "desc" }, take: 50 } }
          })
        : Promise.resolve(null)
    ]);
    userSubmissions = currentUser?.submissions ?? [];
  } catch (error) {
    console.error("Failed to query users in profile page:", error);
  }

  return (
    <>
      <h1>{t.profileTitle}</h1>
      <p className="muted" style={{ marginBottom: "18px" }}>{t.profileDesc}</p>
      
      {currentEmail ? (
        <section className="panel" style={{ border: "1px solid var(--accent)", marginBottom: "20px" }}>
          <h2>Current Session Status</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "10px 0" }}>
            <div><strong>Logged in as:</strong> <code>{currentEmail}</code></div>
            <div><strong>Role:</strong> <span className={`badge ${currentRole === "ADMIN" ? "ok" : ""}`}>{currentRole}</span></div>
          </div>
          
          <form action={logoutUser} style={{ marginTop: "14px" }}>
            <button className="primary" style={{ background: "var(--danger)", borderColor: "var(--danger)" }}>
              Logout
            </button>
          </form>
        </section>
      ) : (
        <section className="panel" style={{ border: "1px solid var(--warning)", marginBottom: "20px" }}>
          <h2>Account access temporarily unavailable</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Email-only login has been disabled because it did not verify ownership of an address. Community accounts and private submission history will return after verified sign-in is added.
          </p>
        </section>
      )}

      {currentUser && (
        <section className="panel" style={{ marginBottom: "20px" }}>
          <h2>Community Contribution Profile</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Submissions linked to this account appear here so you can track review progress and show what you have contributed to the atlas.
          </p>
          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="metric-card">
              <span>Total submitted</span>
              <strong>{userSubmissions.length}</strong>
            </div>
            <div className="metric-card">
              <span>Approved</span>
              <strong>{userSubmissions.filter((item) => item.status === "APPROVED").length}</strong>
            </div>
            <div className="metric-card">
              <span>In review</span>
              <strong>{userSubmissions.filter((item) => ["QUEUED", "NEEDS_REVIEW", "ANALYZED", "FETCHING"].includes(item.status)).length}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Submission</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reviewer Notes</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {userSubmissions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      {item.url && (
                        <div style={{ marginTop: 4 }}>
                          <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, wordBreak: "break-all" }}>
                            {item.url}
                          </a>
                        </div>
                      )}
                    </td>
                    <td><span className="badge">{item.submissionType.replace(/_/g, " ")}</span></td>
                    <td>
                      <span className={`badge ${item.status === "APPROVED" ? "ok" : item.status === "REJECTED" || item.status === "FAILED" ? "danger" : "warn"}`}>
                        {item.status.toLowerCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 280 }}>
                      {item.reviewNotes || item.notes || "Manual review pending."}
                    </td>
                    <td style={{ fontSize: 12 }}>{item.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
                {!userSubmissions.length && (
                  <tr>
                    <td className="empty" colSpan={5}>No submissions linked to this profile yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <h2>Corpus Users List ({users.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Registered At</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name || "N/A"}</td>
                <td><code>{user.email}</code></td>
                <td>
                  <span className={`badge ${user.role === "ADMIN" ? "ok" : ""}`}>{user.role}</span>
                </td>
                <td>{user.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td className="empty" colSpan={4}>No users registered in database.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
