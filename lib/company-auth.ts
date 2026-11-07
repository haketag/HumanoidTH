import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { Prisma } from '../generated/prisma';
import { createAdminSessionToken } from './admin-session';
import { credentials } from './company-validation';

const scrypt = promisify(scryptCallback);
export const companyCookie = 'company_session';
export type Actor = { id: string; email: string; name: string | null; isAdmin: boolean };
export class PortalError extends Error { constructor(public status: number, message: string) { super(message); } }
export function tokenHash(value: string) { return createHash('sha256').update(value).digest('hex'); }
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [salt, encoded] = stored.split(':');
  if (!salt || !encoded || !/^[a-f0-9]{128}$/.test(encoded)) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(encoded, 'hex'));
}
export async function rateLimit(scope: string, maximum = 60) {
  const key = tokenHash(scope);
  const rows = await prisma.$queryRaw<{attempts:number}[]>`INSERT INTO "CompanyRateLimit" (key, attempts, "expiresAt") VALUES (${key},1,NOW()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN "CompanyRateLimit"."expiresAt"<NOW() THEN 1 ELSE "CompanyRateLimit".attempts+1 END, "expiresAt"=CASE WHEN "CompanyRateLimit"."expiresAt"<NOW() THEN NOW()+interval '15 minutes' ELSE "CompanyRateLimit"."expiresAt" END RETURNING attempts`;
  if (rows[0].attempts > maximum) throw new PortalError(429, 'ลองหลายครั้งเกินไป กรุณารอ 15 นาที');
}
export async function authenticate(input: unknown, register: boolean, { adminOnly = false } = {}) {
  const value = credentials.parse(input);
  if (!adminOnly || process.env.NODE_ENV !== 'development') {
    await rateLimit(`auth:${value.email}`, 8);
  }
  const configuredAdmin = !adminOnly && !!process.env.ADMIN_BASIC_USER && !!process.env.ADMIN_BASIC_PASSWORD && value.email === process.env.ADMIN_BASIC_USER.toLowerCase() && tokenHash(value.password) === tokenHash(process.env.ADMIN_BASIC_PASSWORD);
  const rows = await prisma.$queryRaw<(Actor & {passwordHash:string | null})[]>`SELECT u.id,u.email,u.name,a."isAdmin",a."passwordHash" FROM "User" u LEFT JOIN "CompanyAccount" a ON a."userId"=u.id WHERE lower(u.email)=${value.email}`;
  let user = rows[0];
  if (register && (user || configuredAdmin)) throw new PortalError(409, 'อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบหรือติดต่อผู้ดูแล');
  if (register || configuredAdmin) {
    const passwordHash = await hashPassword(value.password);
    user = await prisma.$transaction(async tx => {
      const id = user?.id || randomUUID();
      if (!user) await tx.$executeRaw`INSERT INTO "User" (id,email,name,role,"updatedAt") VALUES (${id},${value.email},${value.name || 'Company representative'},${configuredAdmin ? 'ADMIN' : 'USER'}::"UserRole",NOW())`;
      await tx.$executeRaw`INSERT INTO "CompanyAccount" ("userId","passwordHash","isAdmin") VALUES (${id},${passwordHash},${configuredAdmin}) ON CONFLICT("userId") DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash","isAdmin"=EXCLUDED."isAdmin"`;
      return {id,email:value.email,name:value.name || user?.name || null,isAdmin:configuredAdmin,passwordHash};
    });
  } else if (!user?.passwordHash || !await passwordMatches(value.password, user.passwordHash)) {
    // Equalize the expensive password work for unknown accounts.
    if (!user?.passwordHash) await scrypt(value.password, 'unregistered-account', 64);
    throw new PortalError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
  if (adminOnly) authorizeAdmin(user);
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now()+8*60*60*1000);
  await prisma.$executeRaw`INSERT INTO "CompanySession" ("tokenHash","userId","expiresAt") VALUES (${tokenHash(token)},${user.id},${expires})`;
  const jar = await cookies();
  const old = jar.get(companyCookie)?.value;
  if (old) await prisma.$executeRaw`DELETE FROM "CompanySession" WHERE "tokenHash"=${tokenHash(old)}`;
  jar.set(companyCookie, token, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', expires });
  const adminToken = user.isAdmin ? await createAdminSessionToken(process.env.ADMIN_SESSION_SECRET) : null;
  if (adminToken) jar.set('admin_session', adminToken, {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',expires});
  else jar.delete('admin_session');
  return {id:user.id,email:user.email,name:user.name,isAdmin:user.isAdmin};
}
export async function currentActor(): Promise<Actor | null> {
  const token = (await cookies()).get(companyCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await prisma.$queryRaw<Actor[]>`SELECT u.id,u.email,u.name,a."isAdmin" FROM "CompanySession" s JOIN "CompanyAccount" a ON a."userId"=s."userId" JOIN "User" u ON u.id=s."userId" WHERE s."tokenHash"=${tokenHash(token)} AND s."expiresAt">NOW()`;
  return rows[0] || null;
}
export function authorizeAdmin(actor: Actor | null): asserts actor is Actor {
  if (!actor) throw new PortalError(401,'กรุณาเข้าสู่ระบบ');
  if (!actor.isAdmin) throw new PortalError(403,'เฉพาะผู้ดูแลที่ได้รับสิทธิ์เท่านั้น');
}
export async function requireCompanyAdmin() { const actor = await currentActor(); authorizeAdmin(actor); return actor; }
export async function logoutCompany() {
  const jar=await cookies(); const token=jar.get(companyCookie)?.value;
  if(token) await prisma.$executeRaw`DELETE FROM "CompanySession" WHERE "tokenHash"=${tokenHash(token)}`;
  jar.delete(companyCookie);
  jar.delete('admin_session');jar.delete('user_email');jar.delete('user_role');
}
export type CompanyTransaction = Prisma.TransactionClient;
