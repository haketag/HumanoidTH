import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import MockupLikeButton from './MockupLikeButton';
import styles from './companies.module.css';

export default function OptimusPrimeCard() {
  return (
    <article className={styles.mockup} aria-labelledby="optimus-title">
      <div className={styles.preview}>
        <Image src="/company-optimus-prime.png" alt="โปสเตอร์ Optimus Prime จาก Transformers" fill sizes="220px" />
      </div>
      <div className={styles.mockupCopy}>
        <span className={styles.label}>ตัวอย่างการแสดงผล</span>
        <h3 id="optimus-title">Optimus Prime</h3>
        <p>ตัวละครจาก Transformers ที่นำมาใช้เป็นภาพตัวอย่างในหน้านี้</p>
        <div className={styles.mockupActions}>
          <MockupLikeButton />
          <details>
            <summary>อ่านข้อมูลเพิ่ม <ChevronDown size={16} aria-hidden="true" /></summary>
            <p>Optimus Prime เป็นผู้นำกลุ่ม Autobots ในเรื่อง Transformers โปสเตอร์นี้มาจากภาพยนตร์ Transformers: Age of Extinction</p>
            <a href="https://www.hasbropulse.com/product/transformers-studio-series-transformers-age-of-extinction-voyager-class-optimus-prime/G21945X00">ดูข้อมูลตัวละครจาก Hasbro</a>
          </details>
        </div>
      </div>
    </article>
  );
}
