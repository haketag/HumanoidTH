'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import styles from './portal.module.css';

type FieldName = 'name' | 'email' | 'password';
type Errors = Partial<Record<FieldName, string>>;

export default function AccountForm({ initialRegister, busy, send, th }: {
  initialRegister: boolean;
  busy: boolean;
  send: (body: Record<string, unknown>) => Promise<number | undefined>;
  th: boolean;
}) {
  const [register, setRegister] = useState(initialRegister);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [requestError, setRequestError] = useState('');
  const title = register ? (th ? 'สร้างบัญชีตัวแทน' : 'Create a representative account') : (th ? 'เข้าสู่ระบบ' : 'Sign in');

  useEffect(() => {
    setErrors({});
    setRequestError('');
    setShowPassword(false);
  }, [th]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const next: Errors = {};
    const name = String(fields.get('name') ?? '').trim();
    const email = form.elements.namedItem('email') as HTMLInputElement;
    const password = String(fields.get('password') ?? '');

    if (register && name.length < 2) next.name = th ? 'กรอกชื่อผู้ติดต่ออย่างน้อย 2 ตัวอักษร' : 'Enter at least 2 characters for the contact name.';
    if (!email.validity.valid) next.email = th ? 'กรอกอีเมลในรูปแบบที่ถูกต้อง' : 'Enter a valid email address.';
    if (password.length < 12) next.password = th ? 'กรอกรหัสผ่านอย่างน้อย 12 ตัวอักษร' : 'Enter a password with at least 12 characters.';

    setErrors(next);
    setRequestError('');
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) {
      requestAnimationFrame(() => (form.elements.namedItem(firstInvalid) as HTMLInputElement)?.focus());
      return;
    }

    const status = await send({
      action: register ? 'register' : 'login',
      credentials: { email: email.value.trim(), password, ...(register ? { name } : {}) },
    });
    if (status === 409 && register) {
      setErrors({ email: th ? 'อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ' : 'This email already has an account. Please sign in.' });
      requestAnimationFrame(() => email.focus());
    } else if (status === 401) {
      setRequestError(th ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' : 'The email or password is incorrect. Check both and try again.');
    } else if (status === 429) {
      setRequestError(th ? 'ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' : 'Too many attempts. Wait 15 minutes and try again.');
    } else if (status) {
      setRequestError(th ? 'ดำเนินการไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่' : 'The request could not be completed. Check your details and try again.');
    }
  }

  function clearError(field: FieldName) {
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
    if (requestError) setRequestError('');
  }

  return <section className={styles.account} aria-labelledby="account-title">
    <h2 id="account-title">{title}</h2>
    <p>{register
      ? (th ? 'ใช้บัญชีนี้เพื่อติดตามคำขอและส่งโปรไฟล์' : 'Use this account to track requests and submit profiles.')
      : (th ? 'เข้าสู่ระบบเพื่อติดตามคำขอและจัดการโปรไฟล์บริษัท' : 'Sign in to track requests and manage company profiles.')}</p>
    <form className={`${styles.form} ${styles.accountForm}`} onSubmit={submit} noValidate aria-busy={busy}>
      {register && <div className={styles.accountField}>
        <label htmlFor="company-name">{th ? 'ชื่อผู้ติดต่อ' : 'Contact name'}</label>
        <input id="company-name" name="name" autoComplete="name" minLength={2} maxLength={180} required onChange={() => clearError('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'company-name-error' : undefined} />
        {errors.name && <p id="company-name-error" className={styles.fieldError}>{errors.name}</p>}
      </div>}
      <div className={styles.accountField}>
        <label htmlFor="company-email">{th ? 'อีเมล' : 'Email'}</label>
        <input id="company-email" name="email" type="email" autoComplete="email" spellCheck={false} maxLength={254} required onChange={() => clearError('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'company-email-error' : undefined} />
        {errors.email && <p id="company-email-error" className={styles.fieldError}>{errors.email}</p>}
      </div>
      <div className={styles.accountField}>
        <label htmlFor="company-password">{th ? 'รหัสผ่าน' : 'Password'}</label>
        <div className={styles.passwordControl}>
          <input key={String(register)} id="company-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required onChange={() => clearError('password')} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'company-password-error' : register ? 'company-password-hint' : undefined} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? (th ? 'ซ่อนรหัสผ่าน' : 'Hide password') : (th ? 'แสดงรหัสผ่าน' : 'Show password')}>
            {showPassword ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
          </button>
        </div>
        {errors.password ? <p id="company-password-error" className={styles.fieldError}>{errors.password}</p> : register && <p id="company-password-hint">{th ? 'อย่างน้อย 12 ตัวอักษร' : 'At least 12 characters'}</p>}
      </div>
      {requestError && <p className={styles.fieldError} role="alert">{requestError}</p>}
      <button className={styles.accountSubmit} type="submit" disabled={busy}>{busy ? (th ? 'กำลังดำเนินการ…' : 'Submitting…') : register ? (th ? 'สร้างบัญชี' : 'Create account') : (th ? 'เข้าสู่ระบบ' : 'Sign in')}</button>
    </form>
    <p className={styles.switchMode}>
      {register ? (th ? 'มีบัญชีแล้ว?' : 'Already have an account?') : (th ? 'ยังไม่มีบัญชี?' : 'New here?')}
      <button type="button" disabled={busy} onClick={() => {
        setErrors({});
        setRequestError('');
        setShowPassword(false);
        setRegister(!register);
      }}>{register ? (th ? 'เข้าสู่ระบบ' : 'Sign in') : (th ? 'สร้างบัญชีตัวแทน' : 'Create an account')}</button>
    </p>
  </section>;
}
