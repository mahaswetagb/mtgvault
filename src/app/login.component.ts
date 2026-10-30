import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Auth } from './auth.service';
import { GOOGLE_CLIENT_ID } from './config';

@Component({
  selector: 'app-login', standalone: true, imports: [ReactiveFormsModule], host: { class: 'page' },
  template: `<div class="login glass"><div class="float"></div><h1>MTG<span class="grad">Vault</span></h1>
    <p class="muted">Scan, value and organize your Magic: The Gathering collection.</p>
    <div class="seg2"><button type="button" [class.on]="mode() === 'in'" (click)="mode.set('in'); err.set('')">Sign in</button>
      <button type="button" [class.on]="mode() === 'up'" (click)="mode.set('up'); err.set('')">Create account</button></div>
    <form class="authform" [formGroup]="f" (ngSubmit)="submit()">
      @if (mode() === 'up') { <input formControlName="name" placeholder="Name" autocomplete="name"> }
      <input type="email" formControlName="email" placeholder="Email" autocomplete="email">
      <input type="password" formControlName="password" placeholder="Password (min. 8 characters)" [attr.autocomplete]="mode() === 'up' ? 'new-password' : 'current-password'">
      @if (err()) { <p class="err">{{ err() }}</p> }
      <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? '…' : mode() === 'in' ? 'Sign in' : 'Create account' }}</button>
    </form>
    @if (googleEnabled) {
      <div class="or"><span>or</span></div>
      <div #btn class="gbtn"></div>
    }
    <div class="orbit"><i>🔥</i><i>💧</i><i>🌿</i><i>⚡</i><i>💀</i></div></div>`,
})
export class LoginComponent implements AfterViewInit {
  private auth = inject(Auth); private fb = inject(FormBuilder);
  googleEnabled = Boolean(GOOGLE_CLIENT_ID);
  mode = signal<'in' | 'up'>('in'); err = signal(''); busy = signal(false);
  f = this.fb.nonNullable.group({ name: '', email: '', password: '' });
  @ViewChild('btn') btn!: ElementRef<HTMLElement>;
  ngAfterViewInit() { if (this.googleEnabled) this.auth.renderButton(this.btn.nativeElement); }
  async submit() {
    const v = this.f.getRawValue(); this.err.set(''); this.busy.set(true);
    try { this.mode() === 'up' ? await this.auth.register(v.name, v.email, v.password) : await this.auth.loginEmail(v.email, v.password); }
    catch (e: any) { this.err.set(e?.message || 'Something went wrong'); }
    this.busy.set(false);
  }
}
