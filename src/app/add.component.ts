import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CardPrint, Scryfall } from './scryfall.service';
import { CONDITIONS, Store } from './store.service';

@Component({
  selector: 'app-add', standalone: true, imports: [ReactiveFormsModule], host: { class: 'page' },
  templateUrl: './add.component.html',
})
export class AddComponent {
  private sf = inject(Scryfall); private store = inject(Store); private fb = inject(FormBuilder);
  conds = CONDITIONS;
  results = signal<CardPrint[]>([]); picked = signal<CardPrint | null>(null); loading = signal(false); searched = signal(false); toast = signal('');
  f = this.fb.nonNullable.group({ qty: 1, condition: 'NM', lang: 'EN', paid: null as number | null, date: '', foil: false, notes: '' });
  go(q: string) {
    if (!q.trim()) return;
    this.loading.set(true); this.searched.set(true);
    this.sf.search(q.trim()).subscribe(r => { this.results.set(r); this.loading.set(false); });
  }
  pick(c: CardPrint) { this.picked.set(c); }
  save() {
    const c = this.picked(); if (!c) return;
    const v = this.f.getRawValue();
    this.store.add({ ...c, ...v, qty: Math.max(1, +v.qty || 1) });
    this.toast.set(`${c.name} added`); setTimeout(() => this.toast.set(''), 2200);
    this.picked.set(null); this.f.reset({ qty: 1, condition: 'NM', lang: 'EN', paid: null, date: '', foil: false, notes: '' });
  }
}
