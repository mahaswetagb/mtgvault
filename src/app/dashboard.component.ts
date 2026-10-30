import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RARITY_COLORS, Store, unit } from './store.service';
import { Scryfall } from './scryfall.service';

@Component({ selector: 'app-count', standalone: true, template: `{{ txt() }}` })
export class CountComponent implements OnChanges {
  @Input() to = 0; @Input() money = false;
  v = signal(0);
  txt = () => (this.money ? '€' + this.v().toFixed(2) : Math.round(this.v()).toString());
  ngOnChanges() {
    const from = this.v(), t0 = performance.now();
    const step = (n: number) => {
      const p = Math.min((n - t0) / 1000, 1);
      this.v.set(from + (this.to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

@Component({
  selector: 'app-dashboard', standalone: true, imports: [RouterLink, CountComponent], host: { class: 'page' },
  template: `
  <h1>Your <span class="grad">Vault</span></h1>
  <div class="stats">
    @for (s of stats(); track s.l; let i = $index) {
      <div class="stat glass" [style.--i]="i"><span>{{ s.l }}</span><b><app-count [to]="s.v" [money]="s.m"/></b></div>
    }
  </div>
  <div class="actions">
    <a class="btn" routerLink="/add">＋ Add Card</a><a class="btn ghost" routerLink="/collection">🔎 Search Collection</a>
    <button class="btn ghost" (click)="refresh()">{{ busy() ? '⏳ Updating…' : '🔄 Refresh prices' }}</button>
    <a class="btn ghost" routerLink="/scan">📷 Scan Card</a><span class="btn ghost off" title="Version 2">❤️ Wishlist (soon)</span>
  </div>
  <p class="muted">{{ stamp() }} · source: Scryfall</p>
  @if (!store.items().length) {
    <div class="empty glass"><div class="float">🃏</div><h3>Your vault is empty</h3><p>Add your first card to see stats, value and charts come alive.</p><a class="btn" routerLink="/add">Add your first card</a></div>
  } @else {
    <div class="two">
      <section class="glass pad"><h3>Value by rarity</h3>
        <div class="donutwrap"><svg viewBox="0 0 120 120" class="donut"><circle r="50" cx="60" cy="60" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="14"/>
          @for (s of seg(); track s.k) {
            <circle class="seg" r="50" cx="60" cy="60" fill="none" stroke-width="14" stroke-linecap="butt" transform="rotate(-90 60 60)"
              [attr.stroke]="s.c" [attr.stroke-dasharray]="s.len + ' ' + (314.16 - s.len)" [attr.stroke-dashoffset]="-s.off"/>
          }</svg>
          <ul class="legend">@for (s of seg(); track s.k) {<li><i [style.background]="s.c"></i>{{ s.k }} <b>€{{ s.v.toFixed(2) }}</b></li>}</ul></div>
      </section>
      <section class="glass pad"><h3>Most valuable</h3>
        @for (i of top(); track i.id; let n = $index) {
          <div class="row" [style.--i]="n"><img [src]="i.img" alt=""><div><b>{{ i.name }}</b><small>{{ i.setName }}</small></div><em>€{{ price(i).toFixed(2) }}</em></div>
        }
        @if (least(); as l) { <h4>Least valuable</h4><div class="row"><img [src]="l.img" alt=""><div><b>{{ l.name }}</b><small>{{ l.setName }}</small></div><em>€{{ price(l).toFixed(2) }}</em></div> }
      </section>
    </div>
    <section class="glass pad"><h3>Recently added</h3>
      <div class="strip">@for (i of store.recent(); track i.id; let n = $index) {<img class="tilt" [style.--i]="n" [src]="i.img" [alt]="i.name" [title]="i.name">}</div>
    </section>
  }`,
})
export class DashboardComponent {
  store = inject(Store); private sf = inject(Scryfall);
  price = unit; busy = signal(false);
  constructor() { if (this.store.items().length) this.refresh(); }
  stamp = () => (this.store.updatedAt() ? 'Prices updated ' + new Date(this.store.updatedAt()).toLocaleString() : 'Prices not refreshed yet');
  refresh() {
    this.busy.set(true);
    this.sf.refresh([...new Set(this.store.items().map(i => i.cardId))]).subscribe(l => { if (l.length) this.store.updatePrices(l); this.busy.set(false); });
  }
  stats = computed(() => [
    { l: 'Total cards', v: this.store.totalCards(), m: false }, { l: 'Unique cards', v: this.store.unique(), m: false },
    { l: 'Collection value', v: this.store.value(), m: true }, { l: 'Sets', v: this.store.sets(), m: false },
    { l: 'Foils', v: this.store.foils(), m: false },
  ]);
  top = computed(() => this.store.ranked().slice(0, 3));
  least = computed(() => (this.store.ranked().length > 3 ? this.store.ranked().at(-1) : null));
  seg = computed(() => {
    const e = Object.entries(this.store.byRarity()), tot = e.reduce((a, [, v]) => a + v, 0) || 1;
    let off = 0;
    return e.map(([k, v]) => { const len = (v / tot) * 314.16, s = { k, v, len, off, c: RARITY_COLORS[k] ?? '#a78bfa' }; off += len; return s; });
  });
}
