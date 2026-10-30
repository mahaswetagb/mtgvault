import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Auth } from './auth.service';

export interface Item {
  id: string; cardId: string; name: string; set: string; setName: string; cn: string;
  rarity: string; type: string; colors: string[]; img: string; oracle: string; mana: string; artist: string;
  price: number; priceFoil: number; qty: number; condition: string; foil: boolean; lang: string;
  paid: number | null; date: string; notes: string; added: number;
}
export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
export const RARITY_COLORS: Record<string, string> = { common: '#9aa4b2', uncommon: '#7dd3fc', rare: '#fbbf24', mythic: '#fb7185' };
export const unit = (i: Item) => (i.foil ? i.priceFoil || i.price : i.price);

/** "Basic DB": localStorage, one collection per Google account. Swap load/commit for IndexedDB/Dexie later. */
@Injectable({ providedIn: 'root' })
export class Store {
  private auth = inject(Auth);
  private key = () => `mtgvault.collection.v1.${this.auth.user()?.sub ?? 'guest'}`;
  private load = (): Item[] => JSON.parse(localStorage.getItem(this.key()) || '[]');
  items = signal<Item[]>(this.load());
  updatedAt = signal<number>(+(localStorage.getItem('mtgvault.pricesAt') || 0));
  constructor() { effect(() => { this.auth.user(); untracked(() => this.items.set(this.load())); }); }
  private commit(l: Item[]) { this.items.set(l); localStorage.setItem(this.key(), JSON.stringify(l)); }

  totalCards = computed(() => this.items().reduce((a, i) => a + i.qty, 0));
  unique = computed(() => new Set(this.items().map(i => i.cardId)).size);
  value = computed(() => this.items().reduce((a, i) => a + unit(i) * i.qty, 0));
  sets = computed(() => new Set(this.items().map(i => i.set)).size);
  foils = computed(() => this.items().filter(i => i.foil).reduce((a, i) => a + i.qty, 0));
  ranked = computed(() => [...this.items()].sort((a, b) => unit(b) - unit(a)));
  recent = computed(() => [...this.items()].sort((a, b) => b.added - a.added).slice(0, 6));
  byRarity = computed(() => {
    const m: Record<string, number> = {};
    for (const i of this.items()) m[i.rarity] = (m[i.rarity] || 0) + unit(i) * i.qty;
    return m;
  });

  add(x: Omit<Item, 'id' | 'added'>) {
    const same = this.items().find(i => i.cardId === x.cardId && i.condition === x.condition && i.foil === x.foil && i.lang === x.lang);
    if (same) this.setQty(same.id, same.qty + x.qty);
    else this.commit([...this.items(), { ...x, id: crypto.randomUUID(), added: Date.now() }]);
  }
  setQty(id: string, qty: number) {
    this.commit(qty <= 0 ? this.items().filter(i => i.id !== id) : this.items().map(i => (i.id === id ? { ...i, qty } : i)));
  }
  remove(id: string) { this.commit(this.items().filter(i => i.id !== id)); }
  /** Apply freshly fetched market prices to owned cards. */
  updatePrices(l: { cardId: string; price: number; priceFoil: number }[]) {
    const m = new Map(l.map(c => [c.cardId, c]));
    this.commit(this.items().map(i => { const n = m.get(i.cardId); return n ? { ...i, price: n.price, priceFoil: n.priceFoil } : i; }));
    this.updatedAt.set(Date.now()); localStorage.setItem('mtgvault.pricesAt', String(Date.now()));
  }
}
