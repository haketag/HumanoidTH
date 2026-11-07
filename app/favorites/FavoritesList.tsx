'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import FavoriteButton from '../components/FavoriteButton';
import RobotSourceImage from '../components/RobotSourceImage';
import { useFavorites } from '../components/FavoritesProvider';
import OptimusPrimeCard from '../companies/OptimusPrimeCard';

type Robot = { id:string; canonicalName:string; manufacturer:string|null; developerOrg:string|null; description:string|null; imageUrl:string|null; sourceMeta:unknown };
export default function FavoritesList() {
  const {ids,ready,error:storageError,mockupLiked} = useFavorites();
  const [data,setData] = useState<{key:string; robots:Robot[]}>({key:'',robots:[]});
  const [failed,setFailed] = useState(false);
  const [retry,setRetry] = useState(0);
  const key = JSON.stringify(ids);
  const hasRobotIds = ids.length > 0;
  useEffect(() => {
    if (!ready || !hasRobotIds) return;
    const controller = new AbortController();
    setFailed(false);
    fetch(`/api/favorites?ids=${encodeURIComponent(key)}`, {signal:controller.signal,cache:'no-store'})
      .then(async response => { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
      .then(result => { if (!Array.isArray(result.robots)) throw new Error('Invalid response'); setData({key,robots:result.robots}); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [key,ready,retry,hasRobotIds]);
  if (!ready) return <p role="status">กำลังโหลดรายการที่ถูกใจ…</p>;
  const mockup = mockupLiked ? <OptimusPrimeCard /> : null;
  if (storageError) return <>{mockup}<p role="alert">{storageError}</p></>;
  if (!hasRobotIds && !mockupLiked) return <div className="empty"><p>ยังไม่มีหุ่นยนต์ในรายการที่ถูกใจ</p><Link href="/robots">สำรวจทะเบียนหุ่นยนต์</Link></div>;
  return <>
    {mockup}
    {hasRobotIds && (failed ? (
      <div role="alert"><p>โหลดข้อมูลหุ่นยนต์ไม่ได้ รายการที่ถูกใจยังเก็บอยู่</p><button className="button" onClick={()=>{setFailed(false);setRetry(n=>n+1);}}>ลองใหม่</button></div>
    ) : data.key !== key ? (
      <p role="status">กำลังโหลดข้อมูลหุ่นยนต์…</p>
    ) : <>
      {data.robots.length < ids.length && <p className="notice">บางรายการไม่มีในฐานข้อมูลแล้ว จึงไม่แสดงข้อมูลหุ่นยนต์นั้น</p>}
      <div className="cards">{data.robots.filter(robot=>ids.includes(robot.id)).map(robot => {
      return <article className="card" key={robot.id}>
        <RobotSourceImage url={robot.imageUrl} name={robot.canonicalName} sourceMeta={robot.sourceMeta}/>
        <h2>{robot.canonicalName}</h2><p>{robot.manufacturer || robot.developerOrg || 'ยังไม่ทราบผู้พัฒนา'}</p><p className="muted">{robot.description || 'ยังไม่มีคำอธิบาย'}</p>
        <Link href={`/robots/${encodeURIComponent(robot.id)}`}>ดูรายละเอียดหุ่นยนต์</Link>
        <FavoriteButton robotId={robot.id} name={robot.canonicalName}/>
      </article>;
      })}</div>
    </>)}
    <Link href="/robots">สำรวจทะเบียนหุ่นยนต์เพิ่มเติม</Link>
  </>;
}
