import { Injectable, NgZone, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GOOGLE_CLIENT_ID } from './config';

export interface User { sub: string; name: string; email: string; picture: string; exp: number }
interface Account { name: string; salt: string; hash: string }
declare const google: any;
const KEY = 'mtgvault.user', ACC = 'mtgvault.accounts';
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/** Email/password (local, hashed with PBKDF2) + Google Identity Services login. Client-side only. */
@Injectable({ providedIn: 'root' })
export class Auth {
  private router = inject(Router); private zone = inject(NgZone);
  user = signal<User | null>(this.restore());

  private restore(): User | null {
    try { const u = JSON.parse(localStorage.getItem(KEY) || 'null'); return u && u.exp * 1000 > Date.now() ? u : null; } catch { return null; }
  }
  private start(u: Omit<User, 'exp'>) {
    const full: User = { ...u, exp: Math.floor(Date.now() / 1000) + 7 * 86400 };
    localStorage.setItem(KEY, JSON.stringify(full)); this.user.set(full); this.router.navigateByUrl('/');
  }

  // ---- email + password ----
  private accounts(): Record<string, Account> { try { return JSON.parse(localStorage.getItem(ACC) || '{}'); } catch { return {}; } }
  private async hash(pw: string, salt: BufferSource) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, k, 256)));
  }
  async register(name: string, email: string, pw: string) {
    email = email.trim().toLowerCase(); name = name.trim() || email.split('@')[0];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address');
    if (pw.length < 8) throw new Error('Password must be at least 8 characters');
    const acc = this.accounts();
    if (acc[email]) throw new Error('An account with this email already exists');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    acc[email] = { name, salt: b64(salt), hash: await this.hash(pw, salt) };
    localStorage.setItem(ACC, JSON.stringify(acc));
    this.start({ sub: 'email:' + email, name, email, picture: '' });
  }
  async loginEmail(email: string, pw: string) {
    email = email.trim().toLowerCase();
    const a = this.accounts()[email];
    if (!a || (await this.hash(pw, unb64(a.salt))) !== a.hash) throw new Error('Invalid email or password');
    this.start({ sub: 'email:' + email, name: a.name, email, picture: '' });
  }

  // ---- Google ----
  private ready() {
    return new Promise<void>(res => { const t = () => ((window as any).google?.accounts?.id ? res() : setTimeout(t, 100)); t(); });
  }
  async renderButton(el: HTMLElement) {
    await this.ready();
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r: any) => this.zone.run(() => this.onCredential(r.credential)) });
    google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 280 });
  }
  private onCredential(jwt: string) {
    const b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const p = JSON.parse(decodeURIComponent(escape(atob(b))));
    this.start({ sub: p.sub, name: p.name, email: p.email, picture: p.picture });
  }
  logout() {
    try { google.accounts.id.disableAutoSelect(); } catch {}
    localStorage.removeItem(KEY); this.user.set(null); this.router.navigateByUrl('/login');
  }
}
export const authGuard: CanActivateFn = () => inject(Auth).user() ? true : inject(Router).parseUrl('/login');
