import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseFavorites } from '@/lib/favorites';
import { getRobotSourceImage } from '@/lib/robot-images';
import { getPublicImageSources } from '@/lib/public-source-cache';

export async function GET(request: NextRequest) {
  let ids: string[];
  try { ids = parseFavorites(request.nextUrl.searchParams.get('ids')); }
  catch { return NextResponse.json({error:'Invalid robot IDs'}, {status:400}); }
  try {
    const robots = ids.length ? await prisma.robotModel.findMany({where:{id:{in:ids}},select:{id:true,canonicalName:true,manufacturer:true,developerOrg:true,description:true,sourceMeta:true,officialUrl:true},orderBy:{canonicalName:'asc'}}) : [];
    const sources = robots.length ? await getPublicImageSources() : [];
    return NextResponse.json({robots:robots.map(robot=>({...robot,imageUrl:getRobotSourceImage(robot,sources)}))}, {headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Database unavailable'}, {status:503}); }
}
