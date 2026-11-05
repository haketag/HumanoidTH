'use client';

import { useState } from 'react';
import { getRobotImageCredit } from '@/lib/robot-images';

export default function RobotSourceImage({ url, name, sourceMeta }: { url: string | null; name: string; sourceMeta: unknown }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const credit = getRobotImageCredit(sourceMeta);
  const visible = url && failedUrl !== url;
  return <figure style={{ margin: 0 }}>
    <div className="card-banner">{visible ? <img src={url} alt={credit?.caption || name} loading="lazy" style={{ objectFit: 'contain' }} onError={() => setFailedUrl(url)} /> : <div className="source-thumbnail-empty">ยังไม่มีภาพที่ยืนยันจากต้นทาง</div>}</div>
    {visible && credit && <figcaption className="muted" style={{ fontSize: 12, margin: '8px 0' }}>
      {credit.caption && <span>{credit.caption}<br /></span>}
      ภาพ: <a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.text}</a>
    </figcaption>}
  </figure>;
}
