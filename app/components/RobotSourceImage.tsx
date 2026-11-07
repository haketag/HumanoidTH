'use client';

import { useState } from 'react';
import { getReviewedRobotImage, getRobotImageCredit } from '@/lib/robot-images';

export default function RobotSourceImage({ url, name, sourceMeta }: { url: string | null; name: string; sourceMeta: unknown }) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const credit = getRobotImageCredit(sourceMeta);
  const reviewed = getReviewedRobotImage(name);
  const current = url ? { url, credit } : null;
  const candidates = current?.credit ? [current, reviewed] : [reviewed, current];
  const image = candidates.find(candidate => candidate && !failedUrls.includes(candidate.url));
  return <figure style={{ margin: 0 }}>
    <div className="card-banner">{image ? <img src={image.url} alt={image.credit?.caption || name} loading="lazy" style={{ objectFit: 'contain' }} onError={() => setFailedUrls(previous => [...previous, image.url])} /> : <div className="source-thumbnail-empty">ยังไม่มีภาพที่ยืนยันจากต้นทาง</div>}</div>
    {image?.credit && <figcaption className="muted" style={{ fontSize: 12, margin: '8px 0' }}>
      {image.credit.caption && <span>{image.credit.caption}<br /></span>}
      ภาพ: <a href={image.credit.url} target="_blank" rel="noopener noreferrer">{image.credit.text}</a>
    </figcaption>}
  </figure>;
}
