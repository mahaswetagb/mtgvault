import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store, unit } from './store.service';

@Component({
  selector: 'app-collection', standalone: true, imports: [FormsModule, RouterLink], host: { class: 'page' },
  template: `
  <h1>Collection <small class="muted">{{ list().length }} entries</small></h1>
  <div class="filters glass">
    <input placeholder="Search name, set, code, number…" [ngModel]="q()" (ngModelChange)="q.set($event)">
    <select [ngModel]="rar()" (ngModelChange)="rar.set($event)"><option value="">All rarities</option><option>common</option><option>uncommon</option><option>rare</option><option>mythic</option></select>
    <select [ngModel]="foil()" (ngModelChange)="foil.set($event)"><option value="">Foil & non-foil</option><option value="y">Foil</option><option value="n">Non-foil</option></select>
    <select [ngModel]="sort()" (ngModelChange)="sort.set($event)"><option value="added">Recently added</option><option value="name">Name</option><option value="price">Price</option><option value="qty">Quantity</option><option value="set">Set</option></select>
    <button class="btn ghost" (click)="grid.set(!grid())">{{ grid() ? '☰ List' : '▦ Grid' }}</button>
  </div>
  @if (!list().length) { <div class="empty glass"><div class="float">🔮</div><p>Nothing here yet.</p><a class="btn" routerLink="/add">Add a card</a></div> }
  @else if (grid()) {
    <div class="grid">@for (i of list(); track i.id; let n = $index) {
      <div class="card tilt" [style.--i]="n" (click)="sel.set(i.id)"><img [src]="i.img" [alt]="i.name" loading="lazy">
        <span class="qty">×{{ i.qty }}</span>@if (i.foil) {<span class="foilb">✨</span>}<div class="cap"><b>{{ i.name }}</b><small>{{ i.set }} · €{{ price(i).toFixed(2) }}</small></div></div>}</div>
  } @else {
    <div class="glass table">@for (i of list(); track i.id; let n = $index) {
      <div class="trow" [style.--i]="n" (click)="sel.set(i.id)"><img [src]="i.img" alt=""><b>{{ i.name }}</b><span>{{ i.setName }} #{{ i.cn }}</span><span>{{ i.condition }}{{ i.foil ? ' ✨' : '' }}</span><span>×{{ i.qty }}</span><em>€{{ (price(i) * i.qty).toFixed(2) }}</em></div>}</div>
  }
  @if (cur(); as c) {
    <div class="modal" (click)="sel.set(null)"><div class="sheet glass" (click)="$event.stopPropagation()">
      <img [src]="c.img" [alt]="c.name">
      <div class="info"><h2>{{ c.name }}</h2><p class="muted">{{ c.setName }} ({{ c.set }}) · #{{ c.cn }} · {{ c.rarity }}</p>
        <p>{{ c.mana }} — {{ c.type }}</p><p class="oracle">{{ c.oracle }}</p><p class="muted">Artist: {{ c.artist }}</p>
        <div class="kv"><span>Condition</span><b>{{ c.condition }}</b><span>Foil</span><b>{{ c.foil ? 'Yes' : 'No' }}</b><span>Language</span><b>{{ c.lang }}</b>
          <span>Paid</span><b>{{ c.paid ?? '—' }}</b><span>Purchased</span><b>{{ c.date || '—' }}</b><span>Market price</span><b class="grad">€{{ price(c).toFixed(2) }}</b></div>
        @if (c.notes) { <p class="muted">📝 {{ c.notes }}</p> }
        <div class="qtyrow"><button class="btn ghost" (click)="store.setQty(c.id, c.qty - 1)">−</button><b>{{ c.qty }}</b><button class="btn ghost" (click)="store.setQty(c.id, c.qty + 1)">＋</button>
          <button class="btn danger" (click)="store.remove(c.id); sel.set(null)">🗑 Remove</button></div>
      </div></div></div>
  }`,
})
export class CollectionComponent {
  store = inject(Store); price = unit;
  q = signal(''); rar = signal(''); foil = signal(''); sort = signal('added'); grid = signal(true); sel = signal<string | null>(null);
  cur = computed(() => this.store.items().find(i => i.id === this.sel()) ?? null);
  list = computed(() => {
    const q = this.q().toLowerCase();
    const r = this.store.items().filter(i =>
      (!q || [i.name, i.setName, i.set, i.cn].some(s => s.toLowerCase().includes(q))) &&
      (!this.rar() || i.rarity === this.rar()) && (!this.foil() || i.foil === (this.foil() === 'y')));
    const s = this.sort();
    return r.sort((a, b) => s === 'name' ? a.name.localeCompare(b.name) : s === 'set' ? a.setName.localeCompare(b.setName)
      : s === 'price' ? unit(b) - unit(a) : s === 'qty' ? b.qty - a.qty : b.added - a.added);
  });
}
