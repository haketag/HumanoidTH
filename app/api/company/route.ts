import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ZodError, z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authenticate, currentActor, logoutCompany, PortalError, rateLimit } from '@/lib/company-auth';
import { commandSchema } from '@/lib/company-validation';
import { companyCommand, portalState, requireActor, reviewState } from '@/lib/company-service';

export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
function failure(error:unknown) {
  if(error instanceof PortalError) return json({error:error.message},error.status);
  if(error instanceof ZodError) return json({error:error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('\n')},422);
  const e=error as {code?:string;meta?:{code?:string}};
  if(e.code==='P2002' || e.meta?.code==='23505') return json({error:'รายการซ้ำหรือมีการส่งพร้อมกัน กรุณาโหลดใหม่'},409);
  console.error('Company portal request failed');
  return json({error:'ระบบข้อมูลยังไม่พร้อม กรุณาลองใหม่หรือติดต่อผู้ดูแล'},503);
}
export async function GET(request:NextRequest) {
  try {
    const actor=await currentActor();
    if(request.nextUrl.searchParams.get('view')==='company') {
      const rows=await prisma.$queryRaw`SELECT id,published FROM "Company" WHERE id=${request.nextUrl.searchParams.get('id') || ''} AND published IS NOT NULL`;
      return (rows as unknown[]).length ? json({company:(rows as unknown[])[0]}) : json({error:'ไม่พบโปรไฟล์ที่เผยแพร่'},404);
    }
    if(request.nextUrl.searchParams.get('view')==='companies') {
      const companies=await prisma.$queryRaw`SELECT id,published FROM "Company" WHERE published IS NOT NULL ORDER BY name LIMIT 200`;
      return json({companies});
    }
    requireActor(actor);
    const result=request.nextUrl.searchParams.get('view')==='review'
      ? await prisma.$transaction(tx=>reviewState(tx,actor))
      : await prisma.$transaction(tx=>portalState(tx,actor));
    return json({actor,...result});
  } catch(error) { return failure(error); }
}
export async function POST(request:NextRequest) {
  try {
    if(request.headers.get('origin')!==request.nextUrl.origin) throw new PortalError(403,'คำขอต้องมาจากเว็บไซต์เดียวกัน');
    if(!request.headers.get('content-type')?.startsWith('application/json')) throw new PortalError(415,'ต้องส่งข้อมูล JSON');
    const reader=request.body?.getReader();
    if(!reader) throw new PortalError(400,'ไม่มีข้อมูล');
    let size=0; const chunks:Uint8Array[]=[];
    while(true) { const part=await reader.read(); if(part.done) break; size+=part.value.length; if(size>65536) {await reader.cancel();throw new PortalError(413,'ข้อมูลเกิน 64 KB');} chunks.push(part.value); }
    let body;
    try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {throw new PortalError(400,'JSON ไม่ถูกต้อง');}
    if(body?.action==='login' || body?.action==='register') {
      const auth=z.object({action:z.enum(['login','register']),credentials:z.unknown()}).strict().parse(body);
      if(auth.action==='register') await rateLimit('company-registration',20);
      return json({actor:await authenticate(auth.credentials,auth.action==='register')});
    }
    if(body?.action==='logout') {z.object({action:z.literal('logout')}).strict().parse(body);await logoutCompany();return json({ok:true});}
    const actor=await currentActor();requireActor(actor);
    await rateLimit(`write:${actor.id}`);
    const command=commandSchema.parse(body);
    const result=await prisma.$transaction(tx=>companyCommand(tx,actor,command),{maxWait:10000,timeout:15000});
    if(command.action==='review' && command.decision==='APPROVED') revalidateTag('public-robot-image-sources');
    for(const path of ['/company','/company-review','/companies','/robots','/contributions','/database','/dashboard','/network','/map']) revalidatePath(path);
    revalidatePath('/robots/[id]','page');revalidatePath('/companies/[id]','page');
    return json(result);
  } catch(error) { return failure(error); }
}
