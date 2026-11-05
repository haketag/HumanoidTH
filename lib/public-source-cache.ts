import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';

// Public reference records only. Company drafts and user-scoped results never enter this cache.
export const getPublicImageSources=unstable_cache(()=>prisma.sourceRecord.findMany({
  orderBy:[{relevanceConfidence:'desc'},{updatedAt:'desc'}],
  select:{title:true,url:true,platform:true,rawMeta:true},take:1000,
}),['public-robot-image-sources'],{revalidate:30,tags:['public-robot-image-sources']});
