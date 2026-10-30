import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardPrint, Scryfall } from './scryfall.service';
import { CONDITIONS, Store } from './store.service';

interface Rect { x: number; y: number; w: number; h: number }

/** Camera scanner: captures a frame, OCRs the card title (Tesseract.js, in-browser), looks it up on Scryfall, asks for confirmation. */
@Component({
  selector: 'app-scan', standalone: true, imports: [FormsModule, RouterLink], host: { class: 'page' },
  template: `
  <h1>Scan <span class="grad">Card</span> <small class="muted">{{ added() }} added this session</small></h1>
  <div class="cam glass" [style.aspect-ratio]="ratio()">
    <video #video playsinline muted autoplay (loadedmetadata)="meta()"></video>
    @if (!camErr()) {
      <div class="guide" [style.width.%]="gw()" style="height:80%"><i class="line"></i><span class="zone"><em>card title here</em></span></div>
    } @else { <p class="warn pad">{{ camErr() }}</p> }
    @if (busy()) { <div class="scanning"><div class="spinner"></div><span>{{ status() }}</span></div> }
  </div>
  <p class="muted tip">Fit the whole card inside the dashed frame with the title in the blue box. Good light, no glare.</p>
  <div class="actions">
    <button class="btn" [disabled]="busy() || !!camErr()" (click)="capture()">📸 Capture</button>
    <label class="btn ghost">📁 Upload photo<input type="file" accept="image/*" capture="environment" hidden (change)="onFile($event)"></label>
    <a class="btn ghost" routerLink="/add">Search manually</a>
  </div>
  <div class="filters glass"><input [(ngModel)]="manual" placeholder="Detected / typed card name" (keyup.enter)="lookup(manual)"><button class="btn" (click)="lookup(manual)">Find</button></div>
  @if (msg()) { <p class="muted">{{ msg() }}</p> }
  @if (detected(); as c) {
    <div class="glass pad found"><img [src]="c.img" [alt]="c.name">
      <div class="info"><h2>{{ c.name }}</h2>
        <label>Printing<select [ngModel]="c.cardId" (ngModelChange)="choose($event)">
          @for (p of prints(); track p.cardId) { <option [value]="p.cardId">{{ p.setName }} · #{{ p.cn }} · €{{ p.price.toFixed(2) }}</option> }
          @if (!prints().length) { <option [value]="c.cardId">{{ c.setName }} · #{{ c.cn }}</option> }</select></label>
        <p class="grad" style="font-size:1.6rem">Market price €{{ c.price.toFixed(2) }}</p>
        <div class="fgrid"><label>Quantity<input type="number" min="1" [(ngModel)]="qty"></label>
          <label>Condition<select [(ngModel)]="cond">@for (x of conds; track x) {<option>{{ x }}</option>}</select></label>
          <label class="chk"><input type="checkbox" [(ngModel)]="foil"> Foil ✨</label></div>
        <div class="qtyrow"><button class="btn" (click)="add()">Add to Collection</button><button class="btn ghost" (click)="reset()">Scan again</button></div>
      </div></div>
  }
  @if (toast()) { <div class="toast">✔ {{ toast() }}</div> }`,
})
export class ScanComponent implements AfterViewInit, OnDestroy {
  private sf = inject(Scryfall); private store = inject(Store);
  conds = CONDITIONS;
  @ViewChild('video') video!: ElementRef<HTMLVideoElement>;
  private stream?: MediaStream; private worker: any;
  camErr = signal(''); busy = signal(false); status = signal(''); msg = signal(''); toast = signal('');
  ratio = signal('3/4'); gw = signal(50); added = signal(0);
  detected = signal<CardPrint | null>(null); prints = signal<CardPrint[]>([]);
  manual = ''; qty = 1; cond = 'NM'; foil = false;

  async ngAfterViewInit() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false });
      const v = this.video.nativeElement; v.srcObject = this.stream; await v.play();
    } catch { this.camErr.set('Camera not available (needs HTTPS and camera permission). Use "Upload photo" or type the card name below.'); }
  }
  ngOnDestroy() { this.stream?.getTracks().forEach(t => t.stop()); this.worker?.terminate(); }
  meta() {
    const v = this.video.nativeElement;
    this.ratio.set(`${v.videoWidth}/${v.videoHeight}`); this.gw.set(((0.8 * v.videoHeight * 5) / 7 / v.videoWidth) * 100);
  }
  capture() {
    const v = this.video.nativeElement; if (!v.videoWidth) return;
    const h = v.videoHeight * 0.8, w = (h * 5) / 7;
    this.ocr(v, { x: (v.videoWidth - w) / 2, y: (v.videoHeight - h) / 2, w, h });
  }
  async onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    const b = await createImageBitmap(f);
    this.ocr(b, { x: 0, y: 0, w: b.width, h: b.height });
    (e.target as HTMLInputElement).value = '';
  }
  private async getWorker() {
    if (!this.worker) {
      this.status.set('Loading text recognition (first time only)…');
      const { createWorker } = await import('tesseract.js');
      this.worker = await createWorker('eng');
      await this.worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ,'-" });
    }
    return this.worker;
  }
  private async ocr(src: CanvasImageSource, r: Rect) {
    this.busy.set(true); this.msg.set(''); this.detected.set(null); this.status.set('Reading card…');
    try {
      const x = r.x + r.w * 0.05, y = r.y + r.h * 0.035, w = r.w * 0.75, h = r.h * 0.085, k = Math.min(3, 1000 / w);
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      const g = c.getContext('2d')!; g.drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) { const v = Math.max(0, Math.min(255, (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2] - 128) * 1.6 + 128)); p[i] = p[i + 1] = p[i + 2] = v; }
      g.putImageData(d, 0, 0);
      const wk = await this.getWorker(); this.status.set('Reading card…');
      const res = await wk.recognize(c);
      this.manual = String(res.data.text).replace(/[^A-Za-z ,'’\-]/g, ' ').replace(/\s+/g, ' ').trim();
      await this.lookup(this.manual);
    } catch (e) {
      this.msg.set(e instanceof Error ? `Text recognition failed: ${e.message}` : 'Could not read the card. Try again with better light, or type the name.');
    }
    this.busy.set(false);
  }
  lookup(name: string) {
    name = (name || '').trim();
    if (name.length < 3) { this.msg.set('Could not read a name — type it above and press Find.'); return Promise.resolve(); }
    this.busy.set(true); this.status.set('Searching Scryfall…'); this.msg.set('');
    return new Promise<void>(done => this.sf.named(name).subscribe(c => {
      this.busy.set(false);
      if (!c) { this.msg.set(`No card found for “${name}”. Edit the name and press Find.`); done(); return; }
      this.detected.set(c); this.prints.set([]);
      this.sf.search('!"' + c.name.replace(/"/g, '') + '"').subscribe(l => this.prints.set(l));
      done();
    }));
  }
  choose(id: string) { const p = this.prints().find(x => x.cardId === id); if (p) this.detected.set(p); }
  add() {
    const c = this.detected(); if (!c) return;
    this.store.add({ ...c, qty: Math.max(1, +this.qty || 1), condition: this.cond, foil: this.foil, lang: 'EN', paid: null, date: '', notes: '' });
    this.added.update(n => n + 1); this.toast.set(`${c.name} added`); setTimeout(() => this.toast.set(''), 2000);
    this.reset(); // camera stays open → continuous scanning
  }
  reset() { this.detected.set(null); this.prints.set([]); this.manual = ''; this.msg.set(''); this.qty = 1; this.foil = false; }
}
