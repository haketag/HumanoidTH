'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Fingerprint, Globe2 } from 'lucide-react';
import styles from './login.module.css';

export default function MemberLogin({ thai, destination }: { thai: boolean; destination: '/profile' | '/submit-data' }) {
  const [register, setRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const loginLabel = thai ? 'เข้าสู่ระบบ' : 'Sign in';
  const registerLabel = thai ? 'สมัครบัญชี' : 'Create account';
  const revealLabel = showPassword ? (thai ? 'ซ่อนรหัสผ่าน' : 'Hide password') : (thai ? 'แสดงรหัสผ่าน' : 'Show password');

  function selectMode(next: boolean) {
    setRegister(next);
    setShowPassword(false);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: register ? 'register' : 'login',
          credentials: {
            email: data.get('email'),
            password: data.get('password'),
            ...(register ? { name: data.get('name') } : {}),
          },
        }),
      });
      if (response.ok) {
        window.location.assign(destination);
        return;
      }
      if (response.status === 401) setError(thai ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : 'Incorrect email or password.');
      else if (response.status === 409) setError(thai ? 'อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบ' : 'This email already has an account. Try signing in.');
      else if (response.status === 429) setError(thai ? 'ลองหลายครั้งเกินไป กรุณารอ 15 นาที' : 'Too many attempts. Try again in 15 minutes.');
      else if (response.status === 422) setError(thai ? 'ตรวจสอบอีเมลและข้อมูลที่กรอก แล้วลองอีกครั้ง' : 'Check your email and the information you entered, then try again.');
      else setError(thai ? 'ระบบบัญชียังไม่พร้อม กรุณาลองใหม่ภายหลัง' : 'Account services are unavailable. Try again later.');
    } catch {
      setError(thai ? 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' : 'Could not connect. Check your connection and try again.');
    }
    setPending(false);
  }

  return (
    <section className={styles.login} aria-labelledby="member-login-title">
      <aside className={styles.atlas}>
        <Link className={styles.brand} href="/"><Globe2 size={21} aria-hidden="true" /> HumanoidTH</Link>
        <svg className={styles.map} viewBox="0 0 390 400" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1">
            <path d="M0 58H390M0 114H390M0 170H390M0 226H390M0 282H390M0 338H390M54 0V400M110 0V400M166 0V400M222 0V400M278 0V400M334 0V400" opacity=".25" />
            <path d="M-24 112C62 19 141 45 165 101S220 159 288 126 370 96 422 150M-24 134C62 41 132 66 154 117S220 180 288 147 370 117 422 171M-24 156C60 67 122 89 143 135S220 201 288 168 370 138 422 192M-24 178C49 102 115 104 133 151S220 223 288 189 370 159 422 213M-24 200C49 124 104 124 122 167S220 245 288 210 370 181 422 234M-24 222C49 146 94 144 112 184S220 267 288 231 370 202 422 255M-24 244C40 175 84 163 102 201S220 289 288 252 370 223 422 276M-24 266C39 197 75 185 92 218S220 311 288 273 370 245 422 297" />
            <path d="M110 170L207 231 308 181" strokeDasharray="4 6" opacity=".8" />
            <circle cx="207" cy="231" r="25" opacity=".45" />
            <circle cx="207" cy="231" r="12" opacity=".7" />
          </g>
          <g fill="currentColor"><circle cx="110" cy="170" r="3" /><circle cx="207" cy="231" r="4" /><circle cx="308" cy="181" r="3" /></g>
        </svg>
        <div className={styles.atlasCopy}>
          <p className={styles.atlasTitle}>Thailand<br />Humanoid Atlas</p>
          <p>{thai ? 'สำรวจหุ่นยนต์ งานวิจัย และผู้พัฒนาในประเทศไทย' : 'Explore the robots, research, and people shaping humanoid robotics in Thailand.'}</p>
        </div>
      </aside>
      <div className={styles.panel}>
        <div className={styles.switcher} role="group" aria-label={thai ? 'ตัวเลือกบัญชี' : 'Account options'}>
          <button type="button" aria-pressed={!register} disabled={pending} onClick={() => selectMode(false)}>{loginLabel}</button>
          <button type="button" aria-pressed={register} disabled={pending} onClick={() => selectMode(true)}>{registerLabel}</button>
        </div>
        <h1 id="member-login-title">{register ? registerLabel : loginLabel}</h1>
        <p className={styles.intro}>{register
          ? (thai ? 'สร้างบัญชีเพื่อส่งข้อมูลและติดตามสถานะการตรวจสอบ' : 'Create an account to contribute records and track their review.')
          : (thai ? 'เข้าสู่บัญชีเพื่อดูโปรไฟล์และติดตามข้อมูลที่คุณส่ง' : 'Access your profile and track the records you’ve submitted.')}</p>

        <form method="post" className={styles.form} onSubmit={submit} aria-busy={pending}>
          <fieldset disabled={pending}>
            {register && <label htmlFor="member-name">{thai ? 'ชื่อที่แสดง' : 'Display name'}
              <input id="member-name" name="name" autoComplete="name" required minLength={2} maxLength={180} />
            </label>}
            <label htmlFor="member-email">{thai ? 'อีเมล' : 'Email'}
              <input id="member-email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="you@example.com" />
            </label>
            <label htmlFor="member-password">{thai ? 'รหัสผ่าน' : 'Password'}</label>
            <div className={styles.password}>
              <input key={String(register)} id="member-password" name="password" type={showPassword ? 'text' : 'password'}
                autoComplete={register ? 'new-password' : 'current-password'} required minLength={12} maxLength={128}
                aria-describedby={register ? 'member-password-help' : undefined} />
              <button type="button" aria-label={revealLabel} title={revealLabel} onClick={() => setShowPassword((shown) => !shown)}>
                {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
              </button>
            </div>
            {register && <p className={styles.hint} id="member-password-help">{thai ? 'อย่างน้อย 12 ตัวอักษร' : 'Use at least 12 characters.'}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.submit}>{pending ? (thai ? 'กำลังดำเนินการ…' : 'Please wait…') : register ? registerLabel : loginLabel}</button>
          </fieldset>
        </form>
        <div className={styles.portal}>
          <Fingerprint size={20} aria-hidden="true" />
          <Link href="/company">{thai ? 'จัดการข้อมูลในนามบริษัท' : 'Manage records for a company'}</Link>
        </div>
      </div>
    </section>
  );
}
