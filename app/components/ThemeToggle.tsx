'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

export type Theme = 'light' | 'dark';
const ThemeContext = createContext<{theme:Theme;toggle:()=>void} | null>(null);

export function ThemeProvider({initialTheme,children}:{initialTheme:Theme;children:ReactNode}) {
  const [theme,setTheme]=useState(initialTheme);
  function toggle() {
    const next=theme==='dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme=next;
    document.cookie=`theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:' ? '; Secure' : ''}`;
    setTheme(next);
  }
  return <ThemeContext.Provider value={{theme,toggle}}>{children}</ThemeContext.Provider>;
}

export default function ThemeToggle({lang='th'}:{lang?:'th'|'en'}) {
  const context=useContext(ThemeContext);
  if(!context) throw new Error('ThemeToggle requires ThemeProvider');
  const dark=context.theme==='dark';
  const label=lang==='th' ? 'โหมดมืด' : 'Dark mode';
  return <button type="button" className="theme-toggle" onClick={context.toggle} aria-label={label} aria-pressed={dark} title={lang==='th' ? `เปลี่ยนเป็นโหมด${dark ? 'สว่าง' : 'มืด'}` : `Switch to ${dark ? 'light' : 'dark'} mode`}>
    {dark ? <Sun size={19} aria-hidden="true"/> : <Moon size={19} aria-hidden="true"/>}
    <span className="theme-toggle-label">{lang==='th' ? `โหมด${dark ? 'มืด' : 'สว่าง'}` : dark ? 'Dark' : 'Light'}</span>
    <span className="theme-toggle-switch" aria-hidden="true"><span/></span>
  </button>;
}
