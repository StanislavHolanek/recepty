'use strict';

// Edice (Martinčina kuchařka, veřejná…) se liší jen nastavením v config.js, kód je společný
// Starý config.js Martinčiny kuchařky (RECEPTY_CONFIG) z mezipaměti prohlížeče musí fungovat dál
const LEGACY = window.RECEPTY_CONFIG?.supabaseUrl ? {
  id: 'martinka', nazev: 'Martinčina kuchařka', kratky: 'Martinka', prihlaseni: 'Přihlaste se, recepty uvidíte jen vy dva.',
  supabase: { url: window.RECEPTY_CONFIG.supabaseUrl, key: window.RECEPTY_CONFIG.supabaseKey }, prevod: 'claude', jazykyReceptu: ['vi'],
  sdileni: { cs: { brand: 'Martinčina kuchařka', footer: '— z Martinčiny kuchařky 🌸' }, vi: { brand: 'Sổ nấu ăn của Martinka', footer: '— từ Sổ nấu ăn của Martinka 🌸' } },
} : null;
const EDICE = window.EDICE || LEGACY || { id: 'verejna', nazev: 'Kuchařka', prevod: 'test', jazykyReceptu: [], sdileni: {} };
const APP_NAME = EDICE.nazev;
// 'claude' = recept z fotky přepíše Claude mimo aplikaci; jinak převod přímo v aplikaci (AI)
const BY_CLAUDE = EDICE.prevod === 'claude';
const PENDING = BY_CLAUDE ? 'Čeká na přepis' : 'Čeká na převod';

/* ================= Pomocné funkce ================= */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

const ICON = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M20 16l-5-5-8 8"/></svg>',
};

const MAX_PHOTOS = 5;

// Kytička do designu: pět okvětních lístků a střed
function flower(petal = 'var(--petal)', center = 'var(--flower-center)', cls = '') {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="20" cy="10.5" rx="6.3" ry="9" fill="${petal}" transform="rotate(${a} 20 20)"/>`).join('');
  return `<svg class="flower ${cls}" viewBox="0 0 40 40" aria-hidden="true">${petals}<circle cx="20" cy="20" r="5" fill="${center}"/></svg>`;
}

// Pastelové kombinace pro recepty bez fotky (barva podle názvu)
const PASTELS = [
  ['#f5e1e3', '#800020', '#d4a24c'], ['#f6ead3', '#c58a2e', '#800020'], ['#f8e6e6', '#d98a9c', '#d4a24c'],
  ['#efe0e3', '#a8324f', '#e3bf7a'], ['#faf0e2', '#d4a24c', '#a8324f'], ['#f6e4e8', '#b5546d', '#d4a24c'],
];
function flowerThumb(title) {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, petal, center] = PASTELS[h % PASTELS.length];
  return `<div class="thumb" style="background:${bg}">${flower(petal, center)}</div>`;
}

// Dvě tlačítka na fotky: „Vyfotit“ otevře rovnou fotoaparát, „Z galerie“ vybere uložené fotky
const photoPickers = () => `
  <label class="photo-add">${ICON.camera}<span>Vyfotit</span><input type="file" accept="image/*" capture="environment"></label>
  <label class="photo-add">${ICON.image}<span>Z galerie</span><input type="file" accept="image/*" multiple></label>`;

const bouquet = () => `<div class="bouquet">${flower('#d98a9c', '#d4a24c')}${flower('#800020', '#d4a24c', 'big')}${flower('#e3bf7a', '#800020')}</div>`;
const empty = (title, text) => `<div class="empty">${bouquet()}<b>${title}</b>${text}</div>`;
const h3 = (text) => `<h3>${flower('var(--petal)', 'var(--flower-center)', 'mini')}${text}`;

// Kategorie v pořadí, v jakém se zobrazují; recept může patřit do více (oběd i večeře)
const CATEGORIES = [['Snídaně', '🍳'], ['Polévky', '🥣'], ['Obědy', '🍲'], ['Večeře', '🌙'], ['Přílohy', '🥔'],
  ['Omáčky', '🥄'], ['Saláty', '🥗'], ['Zákusky', '🍰'], ['Pečivo', '🥖'], ['Nápoje', '🍹'], ['Zavařování', '🍓'], ['Ostatní', '🌼']];
const CAT_EMOJI = Object.fromEntries(CATEGORIES);
const catLabel = (c) => `${CAT_EMOJI[c] ? CAT_EMOJI[c] + ' ' : ''}${c}`;
function sortCats(list) {
  const order = CATEGORIES.map(([c]) => c);
  const idx = (c) => (order.includes(c) ? order.indexOf(c) : 100);
  return [...new Set(list)].sort((a, b) => idx(a) - idx(b) || a.localeCompare(b, 'cs'));
}

// Základní věci, které bývají doma vždycky (pro „Co je doma“), v různých pádech
const STAPLES = ['sůl', 'soli', 'pepř', 'pepře', 'voda', 'vody', 'vodu', 'olej', 'oleje', 'ocet', 'octa', 'octem',
  'kmín', 'kmínu', 'bobkový', 'bobkové', 'bobkových'].map((s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, ''));
// Rychlý výběr surovin na obrazovce „Co je doma“
const QUICK_HAVES = ['vejce', 'mouka', 'mléko', 'máslo', 'smetana', 'sýr', 'brambory', 'cibule', 'česnek', 'rýže',
  'těstoviny', 'kuřecí maso', 'mleté maso', 'vepřové maso', 'mrkev', 'rajčata', 'cukr', 'tvaroh', 'jablka', 'houby'];

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function setTitle(title, back) {
  $('#pageTitle').textContent = title;
  document.title = title === APP_NAME ? title : `${title} · ${APP_NAME}`;
  $('#backBtn').hidden = !back;
}

function formatMinutes(m) {
  if (!m) return '';
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
}

function plural(n, one, few, many) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

/* ================= Ingredience: rozbor a přepočet ================= */

const UNITS = new Set(['g', 'dkg', 'kg', 'mg', 'ml', 'cl', 'dl', 'l', 'ks', 'kus', 'kusy', 'kusů', 'lžíce', 'lžic', 'lžíci',
  'lžička', 'lžičky', 'lžiček', 'lžičku', 'lž', 'lž.', 'čl', 'čl.', 'pl', 'pl.', 'kl', 'kl.', 'hrnek', 'hrnku', 'hrnky', 'hrnků','hrníček', 'hrnečky',
  'šálek', 'šálky', 'špetka', 'špetky', 'stroužek', 'stroužky', 'stroužků', 'balení', 'bal', 'bal.', 'balíček', 'balíčky',
  'sáček', 'sáčky', 'sáčku', 'plátek', 'plátky', 'plátků', 'plechovka', 'plechovky', 'konzerva', 'svazek', 'svazky', 'hrst', 'hrsti',
  'kostka', 'kostky', 'kelímek', 'kelímky', 'snítka', 'snítky', 'list', 'listy']);
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const NUM_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+[.,]\d+|\d+\s*[½¼¾⅓⅔⅛]|\d+|[½¼¾⅓⅔⅛])(?![\d/–-])/;

function parseNumber(s) {
  s = s.trim();
  let m;
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
  if ((m = s.match(/^(\d*)\s*([½¼¾⅓⅔⅛])$/))) return (+m[1] || 0) + FRAC[m[2]];
  return parseFloat(s.replace(',', '.'));
}

function parseIngredient(line) {
  const t = String(line).trim().replace(/^[-•*–]\s*/, '');
  if (!t) return null;
  if (/:$/.test(t) && t.length < 60) return { section: t.slice(0, -1).trim() };
  const m = t.match(NUM_RE);
  if (!m) return { qty: null, unit: '', name: t };
  const qty = parseNumber(m[1]);
  let rest = t.slice(m[0].length).trim();
  let unit = '';
  const w = rest.match(/^(\S+)\s*(.*)$/);
  if (w && UNITS.has(w[1].toLowerCase())) { unit = w[1]; rest = w[2]; }
  return { qty: isFinite(qty) ? qty : null, unit, name: rest || t };
}

function normalizeIngredient(i) {
  if (i == null) return null;
  if (typeof i === 'string') return parseIngredient(i);
  if (i.section) return { section: String(i.section) };
  return { qty: i.qty == null || i.qty === '' ? null : Number(i.qty), unit: i.unit || '', name: String(i.name || '') };
}

const NICE_FRAC = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
function formatQty(v, unit) {
  if (v == null || !isFinite(v)) return '';
  const metric = /^(g|dkg|ml|mg)$/i.test(unit || '');
  if (metric || v >= 20) return String(Math.round(metric && v >= 100 ? v / 5 : v) * (metric && v >= 100 ? 5 : 1));
  const whole = Math.floor(v), frac = v - whole;
  if (v < 10 && frac > 0.04) {
    for (const [f, sym] of NICE_FRAC) if (Math.abs(frac - f) < 0.04) return (whole || '') + sym;
  }
  return (Math.round(v * 10) / 10).toLocaleString('cs-CZ');
}

function ingredientAmount(ing, factor = 1) {
  if (ing.qty == null) return '';
  return [formatQty(ing.qty * factor, ing.unit), ing.unit].filter(Boolean).join(' ');
}

function ingredientToLine(ing) {
  if (ing.section) return ing.section + ':';
  if (ing.qty == null) return ing.name;
  const q = (Math.round(ing.qty * 1000) / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 3, useGrouping: false });
  return [q, ing.unit, ing.name].filter(Boolean).join(' ');
}

function normalizeRecipe(r) {
  return {
    id: r.id || uuid(),
    title: String(r.title || r.name || 'Bez názvu').trim(),
    categories: sortCats((Array.isArray(r.categories) ? r.categories : String(r.categories || r.category || '').split(','))
      .map((s) => String(s).trim()).filter(Boolean)),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : String(r.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
    servings: r.servings ? Number(r.servings) : null,
    time_minutes: r.time_minutes ? Number(r.time_minutes) : null,
    ingredients: (r.ingredients || []).map(normalizeIngredient).filter(Boolean),
    steps: (r.steps || []).map((s) => String(s).trim()).filter(Boolean),
    notes: r.notes || '',
    // Původ receptu: od koho a odkud je, např. „od babičky Marie, 1975“
    source: r.source || r.origin || '',
    photos: r.photos || [],
    favorite: !!r.favorite,
    // Překlady receptu, např. {vi: {title, ingredients, steps, notes, stale}}
    translations: r.translations && typeof r.translations === 'object' ? r.translations : {},
    // 'ceka' = jen nafocený papírek, přepis zatím neproběhl (např. bez signálu nebo čeká na Clauda)
    status: r.status === 'ceka' ? 'ceka' : 'hotovo',
  };
}

/* ================= Fotky ================= */

function compressImage(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Fotku se nepodařilo zpracovat'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Soubor není obrázek')); };
    img.src = url;
  });
}

const blobToDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
const dataUrlToBlob = async (d) => (await fetch(d)).blob();

/* ================= Úložiště: v zařízení (IndexedDB) ================= */

// Všechna data jsou zatím jen v tomto zařízení. Později se stejné rozhraní (metody níže)
// napojí na Supabase (účty, rodiny, sdílení); zbytek aplikace se měnit nebude.
class DeviceStore {
  constructor() {
    this.mode = 'device';
    this.urls = new Map();
    this.dbPromise = null;
  }
  db() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('babicina-kucharka', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const name of ['recipes', 'shopping', 'plan']) db.createObjectStore(name, { keyPath: 'id' });
          db.createObjectStore('photos');
          db.createObjectStore('meta');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(new Error('Úložiště v zařízení nejde otevřít (soukromé okno?)'));
      });
      // Požádat prohlížeč, ať data při nedostatku místa nemaže
      navigator.storage?.persist?.().catch(() => {});
    }
    return this.dbPromise;
  }
  async _tx(names, mode, fn) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let result;
      Promise.resolve(fn(...[].concat(names).map((n) => tx.objectStore(n)))).then((r) => { result = r; });
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('Chyba úložiště'));
      tx.onabort = () => reject(tx.error?.name === 'QuotaExceededError'
        ? new Error('V zařízení došlo místo') : tx.error || new Error('Uložení se nepovedlo'));
    });
  }
  _req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  _all(name) { return this._tx(name, 'readonly', (s) => this._req(s.getAll())); }
  _put(name, items) { return this._tx(name, 'readwrite', (s) => { for (const i of items) s.put(i); }); }

  async session() { return { user: { email: '' } }; }
  async userEmail() { return ''; }
  async signOut() {}

  async listRecipes() {
    // Při prvním spuštění vložit ukázkové recepty, ať aplikace není prázdná
    const seeded = await this._tx('meta', 'readonly', (s) => this._req(s.get('seeded')));
    if (!seeded) {
      await this._put('recipes', DEMO_RECIPES.map(normalizeRecipe));
      await this._tx('meta', 'readwrite', (s) => s.put(true, 'seeded'));
    }
    return (await this._all('recipes')).sort((a, b) => a.title.localeCompare(b.title, 'cs'));
  }
  async saveRecipe(r) { await this._put('recipes', [r]); }
  async deleteRecipe(r) {
    await this._tx(['recipes', 'photos'], 'readwrite', (rs, ps) => {
      rs.delete(r.id);
      for (const p of r.photos || []) ps.delete(p);
    });
  }
  async uploadPhoto(_recipeId, blob) {
    const path = `foto-${uuid()}`;
    await this._tx('photos', 'readwrite', (s) => s.put(blob, path));
    return path;
  }
  async removePhotos(paths) {
    if (!paths.length) return;
    await this._tx('photos', 'readwrite', (s) => { for (const p of paths) s.delete(p); });
    for (const p of paths) { if (this.urls.has(p)) URL.revokeObjectURL(this.urls.get(p)); this.urls.delete(p); }
  }
  async photoBlob(path) {
    return this._tx('photos', 'readonly', (s) => this._req(s.get(path)));
  }
  async photoUrls(paths) {
    for (const p of paths) {
      if (this.urls.has(p)) continue;
      const blob = await this.photoBlob(p);
      if (blob) this.urls.set(p, URL.createObjectURL(blob));
    }
    return Object.fromEntries(paths.map((p) => [p, this.urls.get(p)]));
  }

  async listShopping() {
    return (await this._all('shopping')).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  async addShopping(items) {
    const now = Date.now();
    await this._put('shopping', items.map((i, n) => ({
      id: uuid(), checked: false, amount: null, recipe_id: null, recipe_title: null,
      created_at: new Date(now + n).toISOString(), ...i,
    })));
  }
  async updateShopping(id, patch) {
    await this._tx('shopping', 'readwrite', async (s) => {
      const it = await this._req(s.get(id));
      if (it) s.put({ ...it, ...patch });
    });
  }
  async deleteShopping(ids) {
    await this._tx('shopping', 'readwrite', (s) => { for (const id of ids) s.delete(id); });
  }
  onShoppingChange() {}

  async listPlan(from, to) {
    return (await this._all('plan')).filter((p) => p.day >= from && p.day <= to)
      .sort((a, b) => a.day.localeCompare(b.day) || a.created_at.localeCompare(b.created_at));
  }
  async addPlan(item) {
    await this._put('plan', [{ id: uuid(), created_at: new Date().toISOString(), ...item }]);
  }
  async updatePlan(id, patch) {
    await this._tx('plan', 'readwrite', async (s) => {
      const it = await this._req(s.get(id));
      if (it) s.put({ ...it, ...patch });
    });
  }
  async deletePlan(id) {
    await this._tx('plan', 'readwrite', (s) => s.delete(id));
  }
}

/* ================= Úložiště: Supabase (účet, data na serveru) ================= */

// Stejné metody jako DeviceStore. Kdo co vidí, hlídají pravidla v databázi (RLS), ne aplikace.
class SupabaseStore {
  constructor({ url, key }) {
    this.mode = 'supabase';
    this.sb = window.supabase.createClient(url, key);
    this.urls = new Map();
    this.channel = null;
    // Sloupce nákupu pro sčítání a oddělení (qty, unit, dept); bez nich nákup funguje dál, jen bez nich
    this.shopExtra = true;
  }
  async session() {
    const { data } = await this.sb.auth.getSession();
    return data.session;
  }
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Špatný e-mail nebo heslo' : error.message);
  }
  async signOut() { await this.sb.auth.signOut(); }
  async userEmail() { return (await this.session())?.user?.email || ''; }

  async listRecipes() {
    try {
      const { data, error } = await this.sb.from('recipes').select('*').order('title');
      if (error) throw error;
      try { localStorage.setItem('rc_cache_recipes', JSON.stringify(data)); } catch { /* plné úložiště */ }
      return data;
    } catch (e) {
      const cached = localStorage.getItem('rc_cache_recipes');
      if (cached) { toast('Jste offline – zobrazuji uložené recepty'); return JSON.parse(cached); }
      throw e;
    }
  }
  async saveRecipe(r) {
    const { error } = await this.sb.from('recipes').upsert(r);
    if (error) throw error;
  }
  async deleteRecipe(r) {
    if (r.photos?.length) await this.sb.storage.from('recipe-photos').remove(r.photos);
    const { error } = await this.sb.from('recipes').delete().eq('id', r.id);
    if (error) throw error;
  }
  async uploadPhoto(recipeId, blob) {
    const path = `${recipeId}/${Date.now()}-${Math.random().toString(16).slice(2, 8)}.jpg`;
    const { error } = await this.sb.storage.from('recipe-photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  }
  async removePhotos(paths) {
    if (paths.length) await this.sb.storage.from('recipe-photos').remove(paths);
  }
  async photoBlob(path) {
    const { data, error } = await this.sb.storage.from('recipe-photos').download(path);
    if (error) throw error;
    return data;
  }
  async photoUrls(paths) {
    const missing = paths.filter((p) => !this.urls.has(p));
    if (missing.length) {
      const { data } = await this.sb.storage.from('recipe-photos').createSignedUrls(missing, 60 * 60 * 12);
      (data || []).forEach((d) => d.signedUrl && this.urls.set(d.path, d.signedUrl));
    }
    return Object.fromEntries(paths.map((p) => [p, this.urls.get(p)]));
  }

  // Zápis do nákupu; když databáze ještě nemá nové sloupce, zkusí to znovu bez nich
  async _shop(fn, rows) {
    const strip = (o) => { const { qty, unit, dept, ...rest } = o; return rest; };
    let { error } = await fn(this.shopExtra ? rows : rows.map(strip));
    if (error && this.shopExtra && /qty|unit|dept/.test(error.message || '')) {
      this.shopExtra = false;
      ({ error } = await fn(rows.map(strip)));
    }
    if (error) throw error;
  }
  async listShopping() {
    const { data, error } = await this.sb.from('shopping_items').select('*').order('created_at');
    if (error) throw error;
    return data;
  }
  async addShopping(items) {
    await this._shop((rows) => this.sb.from('shopping_items').insert(rows), items);
  }
  async updateShopping(id, patch) {
    await this._shop(([p]) => this.sb.from('shopping_items').update(p).eq('id', id), [patch]);
  }
  async deleteShopping(ids) {
    const { error } = await this.sb.from('shopping_items').delete().in('id', ids);
    if (error) throw error;
  }
  onShoppingChange(cb) {
    if (this.channel) return;
    this.channel = this.sb.channel('nakup')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, cb)
      .subscribe();
  }

  async listPlan(from, to) {
    const { data, error } = await this.sb.from('meal_plan').select('*').gte('day', from).lte('day', to).order('day').order('created_at');
    if (error) throw error;
    return data;
  }
  async addPlan(item) {
    const { error } = await this.sb.from('meal_plan').insert(item);
    if (error) throw error;
  }
  async updatePlan(id, patch) {
    const { error } = await this.sb.from('meal_plan').update(patch).eq('id', id);
    if (error) throw error;
  }
  async deletePlan(id) {
    const { error } = await this.sb.from('meal_plan').delete().eq('id', id);
    if (error) throw error;
  }
}

const DEMO_RECIPES = [
  {
    title: 'Bábovka od babičky', categories: ['Zákusky'], tags: ['sladké', 'víkend'], servings: 12, time_minutes: 70, favorite: true,
    ingredients: ['250 g hladké mouky', '200 g moučkového cukru', '4 vejce', '125 ml oleje', '125 ml mléka',
      '1 prášek do pečiva', '1 vanilkový cukr', '2 lžíce kakaa', 'máslo a hrubá mouka na formu'],
    steps: ['Formu vymažte máslem a vysypte hrubou moukou. Troubu předehřejte na 170 °C.',
      'Vejce vyšlehejte s cukrem a vanilkovým cukrem do pěny.', 'Za stálého šlehání přilijte olej a mléko.',
      'Vmíchejte mouku smíchanou s práškem do pečiva.', 'Třetinu těsta smíchejte s kakaem. Do formy střídavě lijte světlé a tmavé těsto.',
      'Pečte asi 50 minut, propečení ověřte špejlí.'],
    notes: 'Nejlepší je druhý den. Babička dávala místo mléka trochu rumu.', source: 'Babiččin sešit, str. 14',
  },
  {
    title: 'Kulajda', categories: ['Polévky', 'Obědy'], tags: ['houby'], servings: 4, time_minutes: 40,
    ingredients: ['Základ:', '4 brambory', '1 l vody', '1 lžička kmínu', '2 bobkové listy', '5 kuliček nového koření',
      'Zjemnění:', '250 ml smetany ke šlehání', '1 lžíce hladké mouky', '1 hrst sušených hub', '4 vejce', 'kopr, ocet, sůl'],
    steps: ['Houby namočte na 30 minut do vlažné vody.', 'Brambory nakrájejte na kostičky a vařte s kořením a houbami doměkka.',
      'Smetanu rozmíchejte s moukou a vlijte do polévky, provařte 5 minut.', 'Vejce zastřete zvlášť ve vroucí vodě s octem.',
      'Polévku dochuťte octem, solí a koprem, podávejte s vejcem.'],
    source: 'od maminky',
  },
];

/* ================= Převod fotky na recept (AI) ================= */

// Zatím testovací režim: místo AI vrátí ukázkový přepis, aby šel vyzkoušet celý postup
// (vyfotit → zkontrolovat → uložit). Později se tu zavolá Supabase Edge Function,
// která ověří předplatné a limit a zavolá Claude. Klíč k AI nikdy nebude v aplikaci.
const AI = {
  testMode: EDICE.prevod === 'test',
  async convert(blobs) {
    if (this.testMode) {
      await new Promise((r) => setTimeout(r, 1200 + 400 * blobs.length));
      return { recipes: [AI_SAMPLE], comment: '' };
    }
    throw new Error('Převod přes AI zatím není připojený');
  },
};

// Ukázková odpověď ve stejném tvaru, jaký vrací AI (viz test-prevodu/prevod.mjs)
const AI_SAMPLE = {
  title: 'Slaný koláč s tortillou',
  ingredient_groups: [{ name: null, items: [
    { qty: 3, qty_text: '3', unit: '', name: 'vejce' },
    { qty: 2, qty_text: '2', unit: '', name: 'cottage' },
    { qty: null, qty_text: '', unit: '', name: 'sůl, pepř' },
    { qty: 1, qty_text: '1', unit: 'hrst', name: 'baby špenátu' },
    { qty: null, qty_text: '', unit: '', name: 'tortilla' },
    { qty: null, qty_text: '', unit: '', name: 'mozzarella (parmezán)' },
    { qty: null, qty_text: '', unit: '', name: 'oregáno' },
  ] }],
  steps: ['Vejce, cottage, sůl, pepř a špenát promíchat.', 'Do zapékací mísy dát tortillu a zalít směsí.',
    'Posypat mozzarellou (parmezánem) a oregánem.', 'Péct na 180 °C 30–40 minut.'],
  categories: ['Obědy', 'Večeře'],
  servings: null,
  time_minutes: null,
  notes: 'Pod nadpisem: 28–30 [?] (asi průměr mísy v cm)',
  origin: '',
  uncertain: ['Údaj „28–30 mm“ pod nadpisem: asi průměr mísy, první číslice může být i 2.'],
};

// Odpověď AI → recept aplikace
function aiToRecipe(a) {
  const ingredients = [];
  for (const g of a.ingredient_groups || []) {
    if (g.name) ingredients.push({ section: g.name });
    for (const i of g.items || []) ingredients.push({ qty: i.qty, unit: i.unit || '', name: i.name });
  }
  return normalizeRecipe({
    title: a.title, categories: a.categories, servings: a.servings, time_minutes: a.time_minutes,
    ingredients, steps: a.steps, notes: a.notes, source: a.origin,
  });
}

/* ================= Stav a směrování ================= */

// Edice s databází (Martinčina kuchařka) se přihlašuje; jinak (i při vývoji v režimu DEMO) jsou data jen v zařízení
const store = EDICE.supabase && !EDICE.demo && window.supabase ? new SupabaseStore(EDICE.supabase) : new DeviceStore();

const state = {
  recipes: null,
  shopping: [],
  query: '',
  filter: 'all',
  wakeLock: null,
};

async function loadRecipes(force) {
  if (!state.recipes || force) state.recipes = (await store.listRecipes()).map(normalizeRecipe);
  return state.recipes;
}

async function loadShopping() {
  try { state.shopping = await store.listShopping(); } catch { /* offline */ }
  updateShopBadge();
  return state.shopping;
}

function updateShopBadge() {
  const n = state.shopping.filter((i) => !i.checked).length;
  const b = $('#shopCount');
  b.hidden = !n;
  b.textContent = n;
}

const app = $('#app');

async function route() {
  releaseWakeLock();
  app.ontouchstart = app.ontouchend = null;
  $$('.sheet-wrap').forEach((s) => s.remove());
  window.scrollTo(0, 0);
  const [, view = '', id] = (location.hash.slice(1) || '/').split('/');
  const tab = { '': 'list', tyden: 'tyden', new: 'new', foto: 'new', shop: 'shop', more: 'more' }[view] || '';
  $$('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));

  if (store.mode === 'supabase' && !(await store.session())) return renderLogin();
  $('#tabbar').hidden = false;
  // Štítek nahoře: testovací převod fotek, nebo edice s databází spuštěná jen v zařízení (zkušební)
  const badge = EDICE.supabase && store.mode !== 'supabase' ? 'DEMO' : AI.testMode ? 'TEST AI' : '';
  $('#modeBadge').textContent = badge;
  $('#modeBadge').hidden = !badge;

  try {
    if (view === 'r') await renderDetail(decodeURIComponent(id));
    else if (view === 'vareni') await renderCook(decodeURIComponent(id));
    else if (view === 'edit') await renderEdit(decodeURIComponent(id));
    else if (view === 'new') await renderEdit(null);
    else if (view === 'foto') await renderFoto();
    else if (view === 'shop') await renderShop();
    else if (view === 'doma') await renderDoma();
    else if (view === 'tyden') await renderPlan(id ? decodeURIComponent(id) : null);
    else if (view === 'more') await renderMore();
    else await renderList();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="empty"><b>Něco se nepovedlo</b>${esc(e.message || e)}<br><br><button class="btn" onclick="location.reload()">Zkusit znovu</button></div>`;
  }
}

/* ================= Přihlášení ================= */

function renderLogin() {
  setTitle(APP_NAME);
  $('#tabbar').hidden = true;
  $('#modeBadge').hidden = true;
  app.innerHTML = `
    <form class="login form" id="loginForm">
      ${bouquet()}
      <h2 class="script">${esc(APP_NAME)}</h2>
      <p>${esc(EDICE.prihlaseni || 'Přihlaste se ke svým receptům.')}</p>
      <label for="em">E-mail</label>
      <input type="email" id="em" autocomplete="username" required>
      <label for="pw">Heslo</label>
      <input type="password" id="pw" autocomplete="current-password" required>
      <div class="row"><button class="btn primary block" type="submit">Přihlásit</button></div>
      <div class="err" id="loginErr"></div>
    </form>`;
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    try {
      await store.signIn($('#em').value.trim(), $('#pw').value);
      route();
    } catch (err) {
      $('#loginErr').textContent = err.message;
      btn.disabled = false;
    }
  };
}

/* ================= Seznam receptů ================= */

function matches(r, words) {
  const hay = norm([r.title, r.categories.join(' '), r.tags.join(' '), r.ingredients.map((i) => i.name || '').join(' '), r.source].join(' '));
  return words.every((w) => hay.includes(w));
}

async function renderList() {
  setTitle(APP_NAME);
  const recipes = await loadRecipes();
  const cats = sortCats(recipes.flatMap((r) => r.categories));
  if (state.filter !== 'all' && state.filter !== 'fav' && !cats.includes(state.filter)) state.filter = 'all';

  app.innerHTML = `
    <div class="hero">
      <div><div class="script hello">Co dnes uvaříme?</div>
      <div class="sub">${recipes.length} ${plural(recipes.length, 'recept', 'recepty', 'receptů')} v kuchařce</div></div>
      ${bouquet()}
    </div>
    <div class="search">${ICON.search}<input id="q" type="search" placeholder="Hledat recept nebo ingredienci…" value="${esc(state.query)}" autocomplete="off"></div>
    <div class="chips" id="chips">
      <button class="chip" data-f="all">Vše</button>
      <button class="chip" data-f="fav">★ Oblíbené</button>
      ${cats.map((c) => `<button class="chip" data-f="${esc(c)}">${esc(catLabel(c))}</button>`).join('')}
    </div>
    <a class="doma-link" href="#/doma">
      <span class="doma-ico">🧺</span>
      <span><b>Co uvařit z toho, co je doma?</b><small>Zadejte suroviny a najdu recepty</small></span>
      <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
    </a>
    <div class="result-info" id="info"></div>
    <div class="cards" id="cards"></div>`;

  const draw = async () => {
    $$('#chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.f === state.filter));
    const words = norm(state.query).split(/\s+/).filter(Boolean);
    const list = recipes.filter((r) =>
      (state.filter === 'all' || (state.filter === 'fav' ? r.favorite : r.categories.includes(state.filter))) && matches(r, words));

    if (!recipes.length) {
      $('#info').textContent = '';
      $('#cards').innerHTML = empty('Zatím tu nejsou žádné recepty', 'Přidejte první přes tlačítko Přidat, nebo je nahrajte v sekci Více → Import.');
      return;
    }
    $('#info').textContent = `${list.length} ${plural(list.length, 'recept', 'recepty', 'receptů')}`;
    if (!list.length) {
      $('#cards').innerHTML = empty('Nic nenalezeno', 'Zkuste jiné slovo, třeba jen část názvu.');
      return;
    }
    const urls = await store.photoUrls(list.map((r) => r.photos[0]).filter(Boolean));
    $('#cards').innerHTML = list.map((r) => {
      const meta = r.status === 'ceka' ? `✍️ ${PENDING}`
        : [r.categories.join(', '), formatMinutes(r.time_minutes), r.servings ? `${r.servings} ${plural(r.servings, 'porce', 'porce', 'porcí')}` : '']
          .filter(Boolean).join(' · ');
      const thumb = r.photos[0] && urls[r.photos[0]]
        ? `<img class="thumb" src="${esc(urls[r.photos[0]])}" alt="" loading="lazy">`
        : flowerThumb(r.title);
      return `<a class="card" href="#/r/${encodeURIComponent(r.id)}">${thumb}
        <div class="info"><div class="title">${esc(r.title)} ${r.favorite ? '<span class="star">★</span>' : ''}</div>
        <div class="meta">${esc(meta || 'Bez kategorie')}</div></div></a>`;
    }).join('');
  };

  $('#q').oninput = (e) => { state.query = e.target.value; draw(); };
  $('#chips').onclick = (e) => {
    const f = e.target.closest('.chip')?.dataset.f;
    if (f) { state.filter = state.filter === f ? 'all' : f; draw(); }
  };
  await draw();
}

/* ================= Detail receptu ================= */

async function renderDetail(id) {
  const recipes = await loadRecipes();
  const r = recipes.find((x) => x.id === id);
  if (!r) { location.hash = '#/'; return; }
  setTitle(r.title, true);
  loadShopping();

  // Přepočet porcí je vypnutý (množství typu „2⅓ vejce“ nedávají smysl) – vše podle receptu
  const servings = r.servings || null;
  const selected = new Set();
  const doneSteps = new Set();
  const urls = await store.photoUrls(r.photos);

  const inList = (ing) => state.shopping.some((s) => !s.checked && norm(s.name) === norm(ing.name));

  const drawIngredients = () => {
    const factor = r.servings && servings ? servings / r.servings : 1;
    $('#ings').innerHTML = r.ingredients.map((ing, i) => ing.section
      ? `<li class="sec">${esc(ing.section)}</li>`
      : `<li class="ing ${selected.has(i) ? 'sel' : ''}" data-i="${i}">
          <span class="box">${ICON.check}</span>
          <span>${ing.qty != null ? `<span class="qty">${esc(ingredientAmount(ing, factor))}</span> ` : ''}${esc(ing.name)}</span>
          ${inList(ing) ? '<span class="tag-in">v nákupu</span>' : ''}
        </li>`).join('');
    const n = selected.size;
    $('#addSel').hidden = !n;
    $('#addSel').innerHTML = `${ICON.cart} Přidat do nákupu (${n})`;
  };

  app.innerHTML = `
    ${r.photos.length ? `<div class="photos">${r.photos.map((p) => `<img src="${esc(urls[p] || '')}" alt="Fotka receptu">`).join('')}</div>` : ''}
    <div class="detail-head">
      <h2>${esc(r.title)}</h2>
      <button class="fav-btn ${r.favorite ? 'on' : ''}" id="fav" aria-label="Oblíbené">${ICON.star}</button>
    </div>
    <div class="pills">
      ${r.categories.map((c) => `<span class="pill">${esc(catLabel(c))}</span>`).join('')}
      ${r.time_minutes ? `<span class="pill">⏱ ${esc(formatMinutes(r.time_minutes))}</span>` : ''}
      ${r.tags.map((t) => `<span class="pill">#${esc(t)}</span>`).join('')}
    </div>

    ${r.status === 'ceka' ? `<div class="notice">✍️ <div><b>${PENDING}</b>Recept je zatím jen nafocený.${BY_CLAUDE ? ' Claude ho přepíše do ingrediencí a postupu.' : ''} Do té doby můžete vařit podle fotky (ťukněte na ni pro zvětšení).
      ${BY_CLAUDE ? '' : '<div class="row"><button class="btn primary" id="convertNow">Převést teď</button></div>'}</div></div>` : ''}

    ${r.ingredients.length ? `<div class="section">
      ${h3('Ingredience')} <span class="spacer"></span>
        ${servings ? `<span class="srv-info">${servings} ${plural(servings, 'porce', 'porce', 'porcí')}</span>` : ''}
      </h3>
      <p class="hint">Ťukněte na to, co vám chybí, a přidejte to do nákupu. <button class="link-btn" id="selAll">Vybrat vše</button></p>
      <ul class="ingredients" id="ings"></ul>
    </div>` : ''}

    ${r.steps.length ? `<div class="section">${h3('Postup')}</h3>
      <p class="hint">Hotový krok si můžete odškrtnout ťuknutím.</p>
      <ol class="steps" id="steps">${r.steps.map((s, i) => `<li data-i="${i}">${esc(s)}</li>`).join('')}</ol></div>` : ''}

    ${r.notes ? `<div class="section">${h3('Poznámky')}</h3><div class="notes">${esc(r.notes)}</div></div>` : ''}
    ${r.source ? `<p class="kv" style="margin-top:14px">Původ: <b>${esc(r.source)}</b></p>` : ''}

    <div class="row">
      ${r.steps.length ? `<a class="btn primary" href="#/vareni/${encodeURIComponent(r.id)}">👩‍🍳 Vařit krok za krokem</a>` : ''}
      <a class="btn" href="#/edit/${encodeURIComponent(r.id)}">${ICON.edit} Upravit</a>
      <a class="btn" href="#/tyden/${encodeURIComponent(r.id)}">${ICON.calendar} Naplánovat</a>
      <button class="btn" id="shareBtn">${ICON.share} Sdílet</button>
      ${'wakeLock' in navigator ? `<button class="btn" id="wake">${ICON.sun} Nevypínat displej</button>` : ''}
    </div>
    <div class="sticky-action"><button class="btn primary" id="addSel" hidden></button></div>`;

  if (r.ingredients.length) {
    drawIngredients();
    $('#ings').onclick = (e) => {
      const li = e.target.closest('li.ing');
      if (!li) return;
      const i = +li.dataset.i;
      selected.has(i) ? selected.delete(i) : selected.add(i);
      drawIngredients();
    };
    $('#selAll').onclick = () => {
      const all = r.ingredients.map((x, i) => (x.section ? null : i)).filter((i) => i != null);
      if (selected.size === all.length) selected.clear(); else all.forEach((i) => selected.add(i));
      drawIngredients();
    };
    $('#addSel').onclick = async () => {
      const factor = r.servings && servings ? servings / r.servings : 1;
      const items = [...selected].sort((a, b) => a - b).map((i) => r.ingredients[i])
        .map((ing) => ({ name: ing.name, qty: ing.qty == null ? null : ing.qty * factor, unit: ing.unit,
          amount: ingredientAmount(ing, factor) || null, recipe_id: r.id, recipe_title: r.title }));
      try {
        toast(shopMsg(await addToShopping(items)));
        selected.clear();
        drawIngredients();
      } catch (e) { toast('Nepodařilo se přidat: ' + e.message); }
    };
  }

  if (r.steps.length) {
    $('#steps').onclick = (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      const i = +li.dataset.i;
      doneSteps.has(i) ? doneSteps.delete(i) : doneSteps.add(i);
      li.classList.toggle('done', doneSteps.has(i));
    };
  }

  $('#fav').onclick = async () => {
    r.favorite = !r.favorite;
    $('#fav').classList.toggle('on', r.favorite);
    try { await store.saveRecipe(r); } catch (e) { toast('Nepodařilo se uložit: ' + e.message); }
  };

  $$('.photos img').forEach((img) => (img.onclick = () => openLightbox(img.src)));

  const conv = $('#convertNow');
  if (conv) conv.onclick = async () => {
    conv.disabled = true;
    conv.textContent = 'Čtu recept z fotky…';
    try {
      await convertToDraft((await Promise.all(r.photos.map((p) => store.photoBlob(p)))).filter(Boolean), r);
    } catch (err) {
      toast('Převod se nepovedl: ' + err.message);
      conv.disabled = false;
      conv.textContent = 'Převést teď';
    }
  };

  // Sdílí se v počtu porcí, který je právě nastavený
  $('#shareBtn').onclick = () => openShare(r, servings, urls);

  const wake = $('#wake');
  if (wake) wake.onclick = async () => {
    if (state.wakeLock) { releaseWakeLock(); wake.classList.remove('on'); return; }
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      wake.classList.add('on');
      toast('Displej zůstane rozsvícený, dokud recept neopustíte');
    } catch { toast('Telefon to nepovolil'); }
  };
}

/* ================= Sdílení receptu ================= */

// Aplikace je česky; samotné recepty mohou mít překlady (recipes.translations.<jazyk>).
// Které jazyky edice nabízí, určuje config.js (jazykyReceptu). Další jazyk = nový záznam v LANGS.
const LANGS = {
  cs: { label: '🇨🇿 Česky', name: 'česká', ing: 'Ingredience', steps: 'Postup',
    photo: '(recept je na fotce)', portions: ['porce', 'porce', 'porcí'], h: 'h', min: 'min', cats: {} },
  vi: { label: '🇻🇳 Vietnamsky', name: 'vietnamská', ing: 'Nguyên liệu', steps: 'Cách làm',
    photo: '(công thức nằm trong ảnh)', portions: ['phần', 'phần', 'phần'], h: 'giờ', min: 'phút',
    cats: { 'Snídaně': 'Bữa sáng', 'Polévky': 'Súp & canh', 'Obědy': 'Bữa trưa', 'Večeře': 'Bữa tối', 'Přílohy': 'Món ăn kèm',
      'Omáčky': 'Nước sốt', 'Saláty': 'Salad', 'Zákusky': 'Món tráng miệng', 'Pečivo': 'Bánh mì & bánh nướng', 'Nápoje': 'Đồ uống',
      'Zavařování': 'Mứt & đồ muối', 'Ostatní': 'Khác' } },
};
const RECIPE_LANGS = (EDICE.jazykyReceptu || []).filter((l) => LANGS[l]);
const hasLang = (r, l) => l === 'cs' || !!r.translations?.[l]?.title;
// Texty pro sdílení v daném jazyce včetně názvu a patičky edice
function shareTexts(lang) {
  const t = LANGS[lang] || LANGS.cs, ed = EDICE.sdileni?.[lang] || EDICE.sdileni?.cs || {};
  return { ...t, brand: ed.brand || APP_NAME, footer: ed.footer || `— z aplikace ${APP_NAME} 🌸` };
}

// Recept v daném jazyce: překlad, pokud existuje, jinak český originál
function loc(r, lang) {
  const v = lang !== 'cs' && hasLang(r, lang) && r.translations[lang];
  if (!v) return r;
  const cats = LANGS[lang]?.cats || {};
  return {
    ...r,
    title: v.title,
    categories: r.categories.map((c) => cats[c] || c),
    ingredients: Array.isArray(v.ingredients) && v.ingredients.length ? v.ingredients.map(normalizeIngredient).filter(Boolean) : r.ingredients,
    steps: Array.isArray(v.steps) && v.steps.length ? v.steps.map(String) : r.steps,
    notes: v.notes ?? r.notes,
  };
}

function shareMeta(r, servings, L, sep) {
  const time = r.time_minutes
    ? (Math.floor(r.time_minutes / 60) ? `${Math.floor(r.time_minutes / 60)} ${L.h}${r.time_minutes % 60 ? ` ${r.time_minutes % 60} ${L.min}` : ''}` : `${r.time_minutes} ${L.min}`)
    : '';
  return [r.categories.join(', '), time, servings ? `${servings} ${plural(servings, ...L.portions)}` : ''].filter(Boolean).join(sep);
}

// Recept jako čitelný text do zprávy (WhatsApp, Messenger, e-mail…)
function recipeText(orig, servings, lang = 'cs') {
  const r = loc(orig, lang), L = shareTexts(lang);
  const factor = r.servings && servings ? servings / r.servings : 1;
  const meta = shareMeta(r, servings, L, ' · ');
  const ingHead = `🛒 ${L.ing.toUpperCase()}`;
  const out = [`🌸 ${r.title.toUpperCase()}`];
  if (meta) out.push(meta);
  if (r.ingredients.length) {
    out.push('', ingHead);
    for (const ing of r.ingredients) {
      if (ing.section) out.push(...(out.at(-1) === ingHead ? [] : ['']), `${ing.section}:`);
      else out.push(`• ${[ingredientAmount(ing, factor), ing.name].filter(Boolean).join(' ')}`);
    }
  }
  if (r.steps.length) {
    out.push('', `👩‍🍳 ${L.steps.toUpperCase()}`);
    r.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  }
  if (r.notes) out.push('', `📝 ${r.notes}`);
  if (r.status === 'ceka' && !r.ingredients.length) out.push('', L.photo);
  out.push('', L.footer);
  return out.join('\n');
}

// Zalomí text do řádků dané šířky (pro kreslení na plátno)
function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Recept jako jeden obrázek: nahoře hlavní fotka, pod ní ingredience a postup.
// Messenger a další aplikace u sdílení s fotkou text často zahodí – v obrázku zůstane všechno.
async function recipeCard(orig, servings, photoBlob, lang = 'cs') {
  const r = loc(orig, lang), L = shareTexts(lang);
  await document.fonts?.ready;
  const W = 1080, PAD = 70, TW = W - PAD * 2;
  const factor = r.servings && servings ? servings / r.servings : 1;
  const C = { brand: '#800020', text: '#3a1f25', muted: '#86656d', gold: '#d4a24c', bg: '#fbf5ee', card: '#fffdf9' };
  const font = (size, weight = 400, family = 'Nunito, sans-serif') => `${weight} ${size}px ${family}`;

  // Obsah jako seznam bloků; nejdřív se změří výška, pak se kreslí
  const blocks = [];
  const add = (text, size, weight, color, opts = {}) => blocks.push({ text, size, weight, color, ...opts });
  add(r.title, 66, 800, C.brand, { gap: 0 });
  const meta = shareMeta(r, servings, L, '  ·  ');
  if (meta) add(meta, 34, 600, C.muted, { gap: 10 });
  if (r.ingredients.length) {
    add(L.ing, 46, 800, C.brand, { gap: 50, rule: true });
    for (const ing of r.ingredients) {
      if (ing.section) add(ing.section.toUpperCase(), 32, 800, C.gold, { gap: 22 });
      else add(`${ingredientAmount(ing, factor)} ${ing.name}`.trim(), 38, 400, C.text, { gap: 12, bullet: '•', amount: ingredientAmount(ing, factor) });
    }
  }
  if (r.steps.length) {
    add(L.steps, 46, 800, C.brand, { gap: 50, rule: true });
    r.steps.forEach((s, i) => add(s, 38, 400, C.text, { gap: 18, bullet: `${i + 1}.` }));
  }
  if (r.notes) add(r.notes, 34, 400, C.muted, { gap: 40, italic: true });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const layout = () => {
    let y = 0;
    for (const b of blocks) {
      ctx.font = font(b.size, b.weight);
      const indent = b.bullet ? 56 : 0;
      b.lines = wrapLines(ctx, b.text, TW - indent);
      b.lineH = Math.round(b.size * 1.32);
      y += b.gap + (b.rule ? 24 : 0);
      b.y = y;
      y += b.lines.length * b.lineH;
    }
    return y;
  };

  let photo = null;
  if (photoBlob) { try { photo = await createImageBitmap(photoBlob); } catch { /* bez fotky */ } }
  const photoH = photo ? 760 : 0;
  const contentH = layout();
  const footerH = 150;
  canvas.width = W;
  canvas.height = photoH + PAD + contentH + PAD + footerH;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, canvas.height);
  if (photo) {
    // Fotka „cover“ – vyplní horní pruh a ořízne přebytek
    const s = Math.max(W / photo.width, photoH / photo.height);
    const sw = W / s, sh = photoH / s;
    ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, 0, 0, W, photoH);
  }
  ctx.fillStyle = C.brand;
  ctx.fillRect(0, photoH, W, 14);
  ctx.fillStyle = C.gold;
  ctx.fillRect(0, photoH + 14, W, 5);

  const top = photoH + PAD;
  ctx.textBaseline = 'top';
  for (const b of blocks) {
    if (b.rule) { ctx.fillStyle = C.gold; ctx.fillRect(PAD, top + b.y - 18, 80, 5); }
    ctx.font = (b.italic ? 'italic ' : '') + font(b.size, b.weight);
    ctx.fillStyle = b.color;
    const indent = b.bullet ? 56 : 0;
    if (b.bullet) {
      ctx.fillStyle = C.brand;
      ctx.font = font(b.size, 800);
      ctx.fillText(b.bullet, PAD, top + b.y);
      ctx.font = font(b.size, b.weight);
      ctx.fillStyle = b.color;
    }
    b.lines.forEach((line, i) => {
      const x = PAD + indent, y = top + b.y + i * b.lineH;
      // Množství u ingrediencí tučně
      if (i === 0 && b.amount && line.startsWith(b.amount)) {
        ctx.font = font(b.size, 800);
        ctx.fillText(b.amount, x, y);
        const w = ctx.measureText(b.amount + ' ').width;
        ctx.font = font(b.size, b.weight);
        ctx.fillText(line.slice(b.amount.length).trimStart(), x + w, y);
      } else ctx.fillText(line, x, y);
    });
  }

  const fy = canvas.height - footerH;
  ctx.fillStyle = C.brand;
  ctx.fillRect(0, fy, W, footerH);
  ctx.fillStyle = C.bg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(64, 700, '"Dancing Script", cursive');
  ctx.fillText(L.brand, W / 2, fy + footerH / 2);

  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
}

async function openShare(r, servings, urls) {
  // Jazyk se nabízí jen u receptů s překladem; poslední volba se pamatuje
  const langs = ['cs', ...RECIPE_LANGS.filter((l) => hasLang(r, l))];
  let lang = 'cs';
  try { const saved = localStorage.getItem('rc_share_lang'); if (langs.includes(saved)) lang = saved; } catch { /* bez úložiště */ }
  let text = recipeText(r, servings, lang);
  const firstPhoto = r.photos[0] && urls[r.photos[0]];
  const canFiles = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] }));
  // „Jako obrázek“ se pamatuje celkově; „s fotkou“ u každého receptu zvlášť
  // (u receptů, kde je první fotka jen papírek, ji uživatel vypne a už to tak zůstane)
  const store_ = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
  let noPhotoIds = [];
  try { noPhotoIds = JSON.parse(store_('rc_share_nophoto')) || []; } catch { /* nic */ }
  let asImage = canFiles && store_('rc_share_image') === '1';
  let withPhoto = !!firstPhoto && !noPhotoIds.includes(r.id);
  let cardFile = null;
  let cardUrl = null;

  const sheet = document.createElement('div');
  sheet.className = 'sheet-wrap';
  document.body.appendChild(sheet);
  const close = () => { sheet.remove(); if (cardUrl) URL.revokeObjectURL(cardUrl); };

  const makeCard = async () => {
    const photoBlob = withPhoto ? await (await fetch(firstPhoto)).blob() : null;
    const card = await recipeCard(r, servings, photoBlob, lang);
    cardFile = new File([card], `${loc(r, lang).title}.jpg`, { type: 'image/jpeg' });
    if (cardUrl) URL.revokeObjectURL(cardUrl);
    cardUrl = URL.createObjectURL(card);
  };

  const draw = (busy = false) => {
    sheet.innerHTML = `<div class="sheet">
      <div class="sheet-head"><b>Sdílet recept</b><button class="icon-btn" data-act="close" aria-label="Zavřít">${ICON.x}</button></div>
      ${langs.length > 1 ? `<div class="seg share-lang">${langs.map((l) =>
        `<button class="chip ${lang === l ? 'on' : ''}" data-act="lang" data-lang="${l}" ${busy ? 'disabled' : ''}>${LANGS[l].label}</button>`).join('')}</div>
        ${lang !== 'cs' && r.translations[lang]?.stale ? `<p class="hint">Recept se po překladu změnil – ${LANGS[lang].name} verze nemusí odpovídat.</p>` : ''}` : ''}
      <button class="btn primary block" data-act="send" ${busy ? 'disabled' : ''}>${ICON.share} ${busy ? 'Připravuji obrázek…' : 'Poslat'}</button>
      <div class="share-opts">
        <span class="seg">
          ${canFiles ? `<button class="chip ${asImage ? 'on' : ''}" data-act="image" ${busy ? 'disabled' : ''}>${ICON.image} Jako obrázek</button>` : ''}
          ${asImage && firstPhoto ? `<button class="chip ${withPhoto ? 'on' : ''}" data-act="photo" ${busy ? 'disabled' : ''}>${withPhoto ? '✓' : '+'} s fotkou</button>` : ''}
        </span>
        <button class="link-btn" data-act="copy">📋 Kopírovat text</button>
      </div>
      ${asImage && cardUrl
        ? `<img class="share-card" src="${cardUrl}" alt="Náhled obrázku receptu">`
        : `<pre class="share-preview">${esc(text)}</pre>`}
    </div>`;
  };
  // Obrázek se připraví hned, aby Poslat fungovalo okamžitě (sdílení musí běžet přímo po ťuknutí)
  const rebuild = async () => {
    cardFile = null;
    if (asImage) { draw(true); await makeCard(); }
    draw();
  };
  if (asImage) rebuild().catch(() => { asImage = false; draw(); });
  else draw();

  sheet.onclick = async (e) => {
    if (e.target === sheet) return close();
    const act = e.target.closest('[data-act]')?.dataset.act;
    try {
      if (act === 'close') close();
      if (act === 'lang') {
        const l = e.target.closest('[data-lang]').dataset.lang;
        if (l !== lang) {
          lang = l;
          try { localStorage.setItem('rc_share_lang', lang); } catch { /* bez úložiště */ }
          text = recipeText(r, servings, lang);
          await rebuild();
        }
      }
      if (act === 'image') {
        asImage = !asImage;
        store_('rc_share_image', asImage ? '1' : '0');
        await rebuild();
      }
      if (act === 'photo') {
        withPhoto = !withPhoto;
        noPhotoIds = withPhoto ? noPhotoIds.filter((id) => id !== r.id) : [...new Set([...noPhotoIds, r.id])];
        store_('rc_share_nophoto', JSON.stringify(noPhotoIds));
        await rebuild();
      }
      if (act === 'send') {
        if (!navigator.share) {
          await navigator.clipboard.writeText(text);
          toast('Tady sdílení nejde – recept je zkopírovaný, vložte ho do zprávy');
          return;
        }
        if (asImage && cardFile) {
          // Text i do schránky – kdyby ho aplikace k obrázku nepřidala
          navigator.clipboard?.writeText(text).catch(() => {});
          await navigator.share({ files: [cardFile], title: loc(r, lang).title, text });
        } else {
          await navigator.share({ title: loc(r, lang).title, text });
        }
        close();
      }
      if (act === 'copy') { await navigator.clipboard.writeText(text); toast('Recept zkopírován – vložte ho do zprávy'); }
    } catch (err) {
      draw();
      if (err.name !== 'AbortError') toast('Sdílení se nepovedlo: ' + err.message);
    }
  };
}

function releaseWakeLock() {
  if (state.wakeLock) { state.wakeLock.release().catch(() => {}); state.wakeLock = null; }
}

function openLightbox(src) {
  const lb = $('#lightbox');
  $('img', lb).src = src;
  lb.hidden = false;
  lb.onclick = () => (lb.hidden = true);
}

/* ================= Režim vaření: krok za krokem ================= */

// Doby v textu kroku: „peč 40 minut“, „30–40 min“, „1 hodinu“, „1,5 h“ → minuty
const TIME_RE = /(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(minut[ay]?|min\.?|hodin[ya]?|hodinu|hod\.?|h)(?!\p{L})/giu;
function stepTimes(text) {
  const out = [];
  for (const m of String(text).matchAll(TIME_RE)) {
    const k = /^h/i.test(m[3]) ? 60 : 1;
    for (const v of [m[1], m[2]].filter(Boolean)) {
      const min = Math.round(parseFloat(v.replace(',', '.')) * k);
      if (min > 0 && min <= 24 * 60 && !out.includes(min)) out.push(min);
    }
  }
  return out;
}

// Minutky běží i po odchodu z režimu vaření; lišta s nimi je nahoře na každé obrazovce.
// Ukládají se do zařízení, takže přežijí i zavření nebo obnovení aplikace.
const timers = (() => {
  try { return JSON.parse(localStorage.getItem('bk_timers')) || []; } catch { return []; }
})();
let timerTick = null;
const saveTimers = () => { try { localStorage.setItem('bk_timers', JSON.stringify(timers)); } catch { /* bez úložiště */ } };

function startTimer(label, minutes) {
  timers.push({ id: uuid(), label, end: Date.now() + minutes * 60000, done: false });
  saveTimers();
  drawTimers();
  toast(`Minutka nastavená na ${formatMinutes(minutes)}`);
}

function drawTimers() {
  let bar = $('#timerBar');
  saveTimers();
  if (timers.length && !timerTick) timerTick = setInterval(drawTimers, 1000);
  if (!timers.length) {
    bar?.remove();
    clearInterval(timerTick);
    timerTick = null;
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'timerBar';
    bar.className = 'timer-bar';
    $('.topbar').after(bar);
    bar.onclick = (e) => {
      const id = e.target.closest('[data-tid]')?.dataset.tid;
      const t = timers.find((x) => x.id === id);
      if (!t || (!t.done && !confirm(`Zrušit minutku „${t.label}“?`))) return;
      timers.splice(timers.indexOf(t), 1);
      drawTimers();
    };
  }
  const now = Date.now();
  for (const t of timers) if (!t.done && t.end <= now) { t.done = true; ring(t); }
  bar.innerHTML = timers.map((t) => {
    const s = Math.max(0, Math.round((t.end - now) / 1000));
    const left = s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
      : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    return `<button class="timer ${t.done ? 'done' : ''}" data-tid="${t.id}">
      ⏱ <b>${t.done ? 'Hotovo!' : left}</b> <small>${esc(t.label)}</small> ${ICON.x}</button>`;
  }).join('');
}

// Upozornění: zvuk a vibrace (při zhasnutém displeji to zařídí až Android aplikace)
function ring(t) {
  toast(`⏰ Čas vypršel: ${t.label}`);
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  try {
    const ctx = new AudioContext();
    [0, 0.5, 1, 1.5].forEach((d) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime + d);
      g.gain.setValueAtTime(0, ctx.currentTime + d + 0.3);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.35);
    });
  } catch { /* bez zvuku */ }
}

async function keepScreenOn() {
  if (!('wakeLock' in navigator) || (state.wakeLock && !state.wakeLock.released)) return;
  try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch { /* telefon nepovolil */ }
}

async function renderCook(id) {
  const r = (await loadRecipes()).find((x) => x.id === id);
  if (!r || !r.steps.length) { location.replace('#/'); return; }
  setTitle(r.title, true);
  $('#tabbar').hidden = true;
  keepScreenOn();
  let i = state.cookStep?.id === id ? Math.min(state.cookStep.i, r.steps.length - 1) : 0;
  const short = r.title.length > 24 ? r.title.slice(0, 22) + '…' : r.title;

  const draw = () => {
    state.cookStep = { id, i };
    const times = stepTimes(r.steps[i]);
    app.innerHTML = `<div class="cook">
      <div class="cook-progress" aria-hidden="true"><span style="width:${((i + 1) / r.steps.length) * 100}%"></span></div>
      <div class="cook-head"><b>Krok ${i + 1} z ${r.steps.length}</b>
        ${r.ingredients.length ? `<button class="btn small" id="cookIngs">🛒 Suroviny</button>` : ''}</div>
      <p class="cook-step">${esc(r.steps[i]).replace(/(\d) (?=°|%|min|hod|h\b|dkg|kg|g\b|ml|dl|l\b)/g, '$1&nbsp;')}</p>
      ${times.length ? `<div class="cook-timers">${times.map((m) =>
        `<button class="btn" data-min="${m}">⏱ Minutka ${formatMinutes(m)}</button>`).join('')}</div>` : ''}
      <div class="cook-nav">
        <button class="btn" id="cPrev" ${i === 0 ? 'disabled' : ''}>‹ Zpět</button>
        ${i < r.steps.length - 1
          ? '<button class="btn primary" id="cNext">Další krok ›</button>'
          : '<button class="btn primary" id="cDone">Hotovo ✓</button>'}
      </div>
    </div>`;
    $('#cPrev').onclick = () => go(-1);
    const next = $('#cNext');
    if (next) next.onclick = () => go(1);
    const done = $('#cDone');
    if (done) done.onclick = () => { state.cookStep = null; toast('Dobrou chuť!'); location.hash = '#/r/' + encodeURIComponent(r.id); };
    $$('[data-min]').forEach((b) => (b.onclick = () => startTimer(`${short}, krok ${i + 1}`, +b.dataset.min)));
    const ings = $('#cookIngs');
    if (ings) ings.onclick = showIngredients;
  };
  const go = (d) => {
    const n = i + d;
    if (n < 0 || n >= r.steps.length) return;
    i = n;
    draw();
    window.scrollTo(0, 0);
  };

  const showIngredients = () => {
    const sheet = document.createElement('div');
    sheet.className = 'sheet-wrap';
    sheet.innerHTML = `<div class="sheet">
      <div class="sheet-head"><b>Suroviny</b><button class="icon-btn" data-close aria-label="Zavřít">${ICON.x}</button></div>
      <ul class="cook-ings">${r.ingredients.map((ing) => ing.section
        ? `<li class="sec">${esc(ing.section)}</li>`
        : `<li>${ing.qty != null ? `<b>${esc(ingredientAmount(ing))}</b> ` : ''}${esc(ing.name)}</li>`).join('')}</ul>
    </div>`;
    document.body.appendChild(sheet);
    sheet.onclick = (e) => { if (e.target === sheet || e.target.closest('[data-close]')) sheet.remove(); };
  };

  // Přejetí prstem doleva/doprava = další/předchozí krok (ruce od těsta, stačí jeden tah)
  let x0 = null;
  app.ontouchstart = (e) => { x0 = location.hash.startsWith('#/vareni/') ? e.touches[0].clientX : null; };
  app.ontouchend = (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1);
  };
  draw();
}

// Po návratu do aplikace znovu zapnout „nezhasínat displej“ (prohlížeč ho při odchodu vypne)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash.startsWith('#/vareni/')) keepScreenOn();
});
document.addEventListener('keydown', (e) => {
  if (!location.hash.startsWith('#/vareni/') || $('.sheet-wrap')) return;
  if (e.key === 'ArrowRight') $('#cNext')?.click();
  if (e.key === 'ArrowLeft') $('#cPrev')?.click();
});

function releaseWakeLock() {
  if (state.wakeLock) { state.wakeLock.release().catch(() => {}); state.wakeLock = null; }
}

function openLightbox(src) {
  const lb = $('#lightbox');
  $('img', lb).src = src;
  lb.hidden = false;
  lb.onclick = () => (lb.hidden = true);
}

/* ================= Úprava / nový recept ================= */

async function renderEdit(id) {
  const recipes = await loadRecipes();
  // 'draft' = návrh receptu z převodu fotky, který uživatel kontroluje
  const draft = id === 'draft' ? state.draft : null;
  if (id === 'draft' && !draft) { location.replace('#/foto'); return; }
  const orig = draft ? recipes.find((x) => x.id === draft.recipe.id) || null : id ? recipes.find((x) => x.id === id) : null;
  if (id && !draft && !orig) { location.hash = '#/'; return; }
  const r = draft ? structuredClone(draft.recipe) : orig ? structuredClone(orig) : normalizeRecipe({ title: '' });
  if (!orig && !draft) r.title = '';
  setTitle(draft ? 'Zkontrolujte přepis' : orig ? 'Upravit recept' : 'Nový recept', true);

  const keptPhotos = [...r.photos];
  const newPhotos = (draft?.blobs || []).map((file) => ({ file, url: URL.createObjectURL(file) })); // {file, url}
  const urls = await store.photoUrls(keptPhotos);
  const chosenCats = new Set(r.categories);
  const allCats = sortCats([...CATEGORIES.map(([c]) => c), ...recipes.flatMap((x) => x.categories), ...r.categories]);

  const reviewNotice = draft ? `<div class="notice">🔎 <div><b>Zkontrolujte přepis</b>
      Porovnejte ho s fotkou (ťukněte na ni pro zvětšení), opravte, co nesedí, a uložte.
      ${draft.uncertain.length ? `<ul class="uncertain">${draft.uncertain.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
      ${AI.testMode ? '<br><i>Testovací režim: ukázkový přepis, AI zatím není připojená.</i>' : ''}
      ${state.draftQueue?.length ? `<br>Na fotce ${plural(state.draftQueue.length + 1, 'je', 'jsou', 'je')} ještě ${state.draftQueue.length} ${plural(state.draftQueue.length, 'další recept', 'další recepty', 'dalších receptů')}, ukážu ${plural(state.draftQueue.length, 'ho', 'je', 'je')} po uložení.` : ''}
    </div></div>` : '';

  app.innerHTML = `
    ${draft ? reviewNotice : orig ? '' : `<a class="doma-link" href="#/foto">
      <span class="doma-ico">📷</span>
      ${BY_CLAUDE ? '<span><b>Jen nafotit papírek</b><small>Zadáte název a fotku, Claude recept přepíše za vás</small></span>'
        : '<span><b>Vyfotit papírek</b><small>Recept z fotky přepíšu, vy ho jen zkontrolujete</small></span>'}
      <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
    </a>
    <p class="hint" style="margin:14px 2px 0">…nebo recept napište rovnou sem:</p>`}
    <form class="form has-sticky" id="ef">
      <label for="f-title">Název</label>
      <input type="text" id="f-title" required value="${esc(r.title)}" placeholder="např. Svíčková">

      <label>Fotky <span class="help">– až ${MAX_PHOTOS}: hotové jídlo, papírek s receptem…</span></label>
      <div class="photo-edit" id="phs"></div>

      <label>Kategorie <span class="help">– ťukněte na všechny, kam recept patří</span></label>
      <div class="cat-pick" id="catPick">
        ${allCats.map((c) => `<button type="button" class="chip ${chosenCats.has(c) ? 'on' : ''}" data-c="${esc(c)}">${esc(catLabel(c))}</button>`).join('')}
        <input type="text" id="f-newcat" class="chip-input" placeholder="+ jiná…">
      </div>

      <div class="grid2">
        <div><label for="f-tags">Štítky <span class="help">(čárkou)</span></label>
          <input type="text" id="f-tags" value="${esc(r.tags.join(', '))}" placeholder="rychlé, vánoce"></div>
        <div><label for="f-srv">Počet porcí</label>
          <input type="number" id="f-srv" min="1" inputmode="numeric" value="${r.servings ?? ''}"></div>
        <div><label for="f-time">Čas (minuty)</label>
          <input type="number" id="f-time" min="0" inputmode="numeric" value="${r.time_minutes ?? ''}"></div>
      </div>

      <label for="f-ing">Ingredience <span class="help">– každá na nový řádek, např. „200 g mouky“. Nadpis skupiny ukončete dvojtečkou („Těsto:“).</span></label>
      <textarea id="f-ing" rows="8">${esc(r.ingredients.map(ingredientToLine).join('\n'))}</textarea>

      <label for="f-steps">Postup <span class="help">– každý krok na nový řádek</span></label>
      <textarea id="f-steps" rows="8">${esc(r.steps.join('\n'))}</textarea>

      <label for="f-notes">Poznámky</label>
      <textarea id="f-notes" rows="3" style="min-height:70px">${esc(r.notes)}</textarea>

      <label for="f-src">Původ <span class="help">– od koho a odkud recept je</span></label>
      <input type="text" id="f-src" value="${esc(r.source)}" placeholder="např. od babičky Marie, 1975">
      <div class="sticky-action"><button class="btn primary" type="submit" id="saveBtn">Uložit recept</button></div>
      ${orig ? '<div class="row"><button class="btn danger" type="button" id="delBtn">Smazat recept</button></div>' : ''}
    </form>`;

  const drawPhotos = () => {
    $('#phs').innerHTML =
      keptPhotos.map((p, i) => `<div class="ph"><img src="${esc(urls[p] || '')}" alt=""><button type="button" data-k="${i}" aria-label="Odebrat">×</button></div>`).join('') +
      newPhotos.map((p, i) => `<div class="ph"><img src="${esc(p.url)}" alt=""><button type="button" data-n="${i}" aria-label="Odebrat">×</button></div>`).join('') +
      (keptPhotos.length + newPhotos.length < MAX_PHOTOS
        ? photoPickers()
        : '');
    $$('#phs input[type=file]').forEach((input) => (input.onchange = (e) => {
      const free = MAX_PHOTOS - keptPhotos.length - newPhotos.length;
      const files = [...e.target.files];
      if (files.length > free) toast(`K receptu jdou nejvýš ${MAX_PHOTOS} fotek`);
      for (const file of files.slice(0, free)) newPhotos.push({ file, url: URL.createObjectURL(file) });
      drawPhotos();
    }));
    $$('#phs .ph img').forEach((img) => (img.onclick = () => openLightbox(img.src)));
  };
  drawPhotos();
  $('#catPick').onclick = (e) => {
    const b = e.target.closest('button[data-c]');
    if (!b) return;
    const c = b.dataset.c;
    chosenCats.has(c) ? chosenCats.delete(c) : chosenCats.add(c);
    b.classList.toggle('on', chosenCats.has(c));
  };
  $('#phs').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.k != null) keptPhotos.splice(+b.dataset.k, 1);
    if (b.dataset.n != null) newPhotos.splice(+b.dataset.n, 1);
    drawPhotos();
  };

  $('#ef').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#saveBtn');
    btn.disabled = true;
    btn.textContent = 'Ukládám…';
    try {
      const uploaded = [];
      for (const p of newPhotos) {
        // Vyšší rozlišení, aby šel rukopis na fotce papírku dobře přečíst
        uploaded.push(await store.uploadPhoto(r.id, await compressImage(p.file, 2200, 0.85)));
      }
      const removed = (orig?.photos || []).filter((p) => !keptPhotos.includes(p));
      const rec = normalizeRecipe({
        ...r,
        title: $('#f-title').value,
        categories: [...chosenCats, $('#f-newcat').value.trim()].filter(Boolean),
        tags: $('#f-tags').value,
        servings: $('#f-srv').value,
        time_minutes: $('#f-time').value,
        ingredients: $('#f-ing').value.split('\n'),
        steps: $('#f-steps').value.split('\n').map((s) => s.replace(/^\s*\d+[.)]\s*/, '')),
        notes: $('#f-notes').value.trim(),
        source: $('#f-src').value.trim(),
        photos: [...keptPhotos, ...uploaded],
      });
      // Kdo nafocený recept ručně dopíše, tím ho zároveň zpracoval
      if (rec.ingredients.length || rec.steps.length) rec.status = 'hotovo';
      // Změněný obsah = překlady jsou zastaralé (Claude je při /cms-recepty přeloží znovu)
      const content = (x) => JSON.stringify([x.title, x.ingredients, x.steps, x.notes]);
      if (orig && content(rec) !== content(orig)) {
        for (const [l, t] of Object.entries(rec.translations)) if (t?.title) rec.translations[l] = { ...t, stale: true };
      }
      await store.saveRecipe(rec);
      await store.removePhotos(removed);
      await loadRecipes(true);
      if (draft) {
        // Víc receptů na jedné fotce: po uložení jednoho rovnou ukázat další
        state.draft = state.draftQueue?.shift() || null;
        if (state.draft) { toast('Recept uložen, další z fotky'); route(); return; }
      }
      toast('Recept uložen');
      location.replace('#/r/' + encodeURIComponent(rec.id));
    } catch (err) {
      toast('Uložení se nepovedlo: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Uložit recept';
    }
  };

  const del = $('#delBtn');
  if (del) del.onclick = async () => {
    if (!confirm(`Opravdu smazat recept „${orig.title}“? Tohle nejde vrátit.`)) return;
    try {
      await store.deleteRecipe(orig);
      await loadRecipes(true);
      toast('Recept smazán');
      location.replace('#/');
    } catch (err) { toast('Smazání se nepovedlo: ' + err.message); }
  };
}

/* ================= Co je doma: hledání podle surovin ================= */

// Česká slova se skloňují (mouka/mouky, vejce/vejci), proto se porovnávají podle kmene
function wordMatches(have, iw) {
  if (have.length <= 3) return iw.startsWith(have) && iw.length <= have.length + 2;
  if (have.length === 4) return iw.startsWith(have.slice(0, 3)) && iw.length <= 4;
  return iw.startsWith(have.slice(0, have.length === 5 ? 4 : have.length - 2));
}
const words = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

function domaScore(r, haves, useStaples) {
  const ings = r.ingredients.filter((i) => !i.section);
  let matched = 0;
  const missing = [];
  for (const ing of ings) {
    const iws = words(ing.name);
    const byHave = haves.some((h) => h.every((hw) => iws.some((iw) => wordMatches(hw, iw))));
    const staple = useStaples && iws.some((iw) => STAPLES.includes(iw));
    if (byHave) matched++;
    else if (!staple) missing.push(ing);
  }
  return { matched, missing, total: ings.length };
}

async function renderDoma() {
  setTitle('Co je doma', true);
  const recipes = await loadRecipes();
  let haves = [];
  try { haves = JSON.parse(localStorage.getItem('rc_doma')) || []; } catch { /* nic */ }
  let useStaples = localStorage.getItem('rc_doma_staples') !== '0';
  const suggestions = [...new Set(recipes.flatMap((r) => r.ingredients.filter((i) => i.name).map((i) => i.name.toLowerCase())))]
    .filter((n) => n.length < 30).sort((a, b) => a.localeCompare(b, 'cs'));

  app.innerHTML = `
    <div class="hero"><div><div class="script hello">Co je doma?</div>
      <div class="sub">Ťukněte nebo napište, co máte, a najdu, co z toho uvařit.</div></div></div>
    <form class="add-row form" id="haveForm">
      <input type="text" id="haveIn" list="haveSug" placeholder="např. vejce, mouka, cuketa" autocomplete="off">
      <datalist id="haveSug">${suggestions.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
      <button class="btn primary" type="submit">Přidat</button>
    </form>
    <div class="haves" id="haves"></div>
    <label class="check"><input type="checkbox" id="staples" ${useStaples ? 'checked' : ''}> Sůl, pepř, olej, vodu a ocet mám vždycky</label>
    <div id="domaRes"></div>
    <div class="haves" id="quick"></div>`;

  const save = () => localStorage.setItem('rc_doma', JSON.stringify(haves));
  const draw = () => {
    const has = (q) => haves.some((h) => words(h).every((hw) => words(q).some((qw) => wordMatches(hw, qw))));
    const quick = QUICK_HAVES.filter((q) => !has(q));
    $('#haves').innerHTML = haves.length
      ? `<div class="group-title"><span>Mám doma (${haves.length})</span><button class="link-btn" type="button" id="clearHaves">Vymazat vše</button></div>
        <div class="chips wrap">${haves.map((h, i) => `<button class="chip on" data-del="${i}">${esc(h)} ✕</button>`).join('')}</div>`
      : '';
    $('#quick').innerHTML = `<div class="group-title"><span>${haves.length ? 'Přidat další' : 'Rychlý výběr'}</span></div>
       <div class="chips wrap">${quick.map((q) => `<button class="chip" data-add="${esc(q)}">+ ${esc(q)}</button>`).join('')}</div>`;
    const clear = $('#clearHaves');
    if (clear) clear.onclick = () => { haves = []; save(); draw(); };
    drawResults();
  };

  const drawResults = () => {
    const res = $('#domaRes');
    if (!haves.length) { res.innerHTML = ''; return; }
    const hw = haves.map(words).filter((h) => h.length);
    const found = recipes.map((r) => ({ r, ...domaScore(r, hw, useStaples) }))
      .filter((x) => x.matched > 0)
      .sort((a, b) => a.missing.length - b.missing.length || b.matched - a.matched || a.r.title.localeCompare(b.r.title, 'cs'));
    if (!found.length) {
      res.innerHTML = empty('Žádný recept nenalezen', 'Zkuste přidat další suroviny, nebo jiný tvar slova.');
      return;
    }
    res.innerHTML = `<div class="group-title"><span>Můžete uvařit (${found.length})</span></div>
      <div class="cards">${found.map(({ r, matched, missing }) => `
        <div class="card doma-card">
          <a class="info" href="#/r/${encodeURIComponent(r.id)}">
            <div class="title">${esc(r.title)}</div>
            ${missing.length
              ? `<div class="meta">Máte ${matched} ${plural(matched, 'surovinu', 'suroviny', 'surovin')} · <span class="miss">chybí: ${esc(missing.map((m) => m.name).join(', '))}</span></div>`
              : `<div class="meta ok">✓ Všechno máte doma</div>`}
          </a>
          ${missing.length ? `<button class="btn small" data-shop="${esc(r.id)}">${ICON.cart} ${missing.length}</button>` : ''}
        </div>`).join('')}</div>`;
    $$('[data-shop]', res).forEach((b) => (b.onclick = async () => {
      const x = found.find((f) => f.r.id === b.dataset.shop);
      try {
        toast(shopMsg(await addToShopping(x.missing.map((ing) => ({ name: ing.name, qty: ing.qty, unit: ing.unit,
          amount: ingredientAmount(ing) || null, recipe_id: x.r.id, recipe_title: x.r.title })))));
        b.disabled = true;
      } catch (e) { toast('Nepodařilo se přidat: ' + e.message); }
    }));
  };

  const add = (text) => {
    for (const t of String(text).split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!haves.some((h) => norm(h) === norm(t))) haves.push(t);
    }
    save();
    draw();
  };
  $('#haveForm').onsubmit = (e) => { e.preventDefault(); add($('#haveIn').value); $('#haveIn').value = ''; };
  $('#haves').onclick = $('#quick').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.add) add(b.dataset.add);
    if (b.dataset.del != null) { haves.splice(+b.dataset.del, 1); save(); draw(); }
  };
  $('#staples').onchange = (e) => {
    useStaples = e.target.checked;
    localStorage.setItem('rc_doma_staples', useStaples ? '1' : '0');
    drawResults();
  };
  draw();
}

/* ================= Recept z fotky papírku (převod přes AI) ================= */

// Pošle fotky k převodu a výsledek otevře ke kontrole (#/edit/draft).
// base = už uložený nafocený recept („čeká na převod“): zůstanou mu jeho fotky i id.
async function convertToDraft(blobs, base = null) {
  const res = await AI.convert(blobs);
  const list = (res.recipes || []).map((a) => {
    const rec = aiToRecipe(a);
    if (base) {
      Object.assign(rec, { id: base.id, photos: base.photos, favorite: base.favorite, tags: base.tags });
      rec.title = rec.title || base.title;
      rec.notes = [base.notes, rec.notes].filter(Boolean).join('\n');
    }
    return { recipe: rec, blobs: base ? [] : blobs, uncertain: a.uncertain || [] };
  });
  if (!list.length) throw new Error(res.comment || 'Na fotce se nepodařilo najít recept');
  if (base) list.length = 1;
  state.draft = list.shift();
  state.draftQueue = list;
  location.hash = '#/edit/draft';
}

async function renderFoto() {
  // Edice s přepisem přes Clauda: zadá se název a fotka, Claude recept přepíše později mimo aplikaci
  const title = BY_CLAUDE ? 'Nafotit recept' : 'Recept z papírku';
  setTitle(title, true);
  const photos = []; // {file, url}
  app.innerHTML = `
    <div class="hero"><div><div class="script hello">${title}</div>
      <div class="sub">${BY_CLAUDE ? 'Stačí název a fotka papírku. Claude z ní pak udělá ingredience a postup.'
        : 'Vyfoťte papírek nebo stránku ze sešitu. Recept přepíšu a vy ho jen zkontrolujete.'}</div></div></div>
    <div class="form has-sticky">
      ${BY_CLAUDE ? `<label for="ff-title">Název jídla</label>
        <input type="text" id="ff-title" placeholder="např. Babiččina bábovka" autocomplete="off">` : ''}
      <label>Fotky <span class="help">– až ${MAX_PHOTOS}, třeba přední a zadní strana</span></label>
      <div class="photo-edit" id="ffPhs"></div>
      <p class="hint">Tip: celý papírek na rovné ploše, dobré světlo, bez stínu ruky nebo telefonu.</p>
      ${BY_CLAUDE ? `<label for="ff-note">Poznámka pro Clauda <span class="help">(nepovinné)</span></label>
        <input type="text" id="ff-note" placeholder="např. od maminky, dělám dvojnásobek" autocomplete="off">
        <div class="sticky-action"><button class="btn primary" type="button" id="ffLater">Uložit k přepisu</button></div>`
      : `${AI.testMode ? '<p class="hint"><b>Testovací režim:</b> AI zatím není připojená, místo přepisu se ukáže ukázkový recept.</p>' : ''}
        <div class="sticky-action"><button class="btn primary" type="button" id="ffGo">Převést na recept</button></div>
        <div class="row"><button class="btn" type="button" id="ffLater">Jen uložit fotku, převést později</button></div>`}
    </div>`;

  const draw = () => {
    $('#ffPhs').innerHTML =
      photos.map((p, i) => `<div class="ph"><img src="${esc(p.url)}" alt=""><button type="button" data-n="${i}" aria-label="Odebrat">×</button></div>`).join('') +
      (photos.length < MAX_PHOTOS ? photoPickers() : '');
    $$('#ffPhs input[type=file]').forEach((input) => (input.onchange = (e) => {
      const files = [...e.target.files];
      const free = MAX_PHOTOS - photos.length;
      if (files.length > free) toast(`K receptu jdou nejvýš ${MAX_PHOTOS} fotek`);
      for (const file of files.slice(0, free)) photos.push({ file, url: URL.createObjectURL(file) });
      draw();
    }));
  };
  draw();
  $('#ffPhs').onclick = (e) => {
    const b = e.target.closest('button[data-n]');
    if (b) { photos.splice(+b.dataset.n, 1); draw(); }
  };

  const laterText = $('#ffLater').textContent;
  const busy = (on, text) => {
    $('#ffLater').disabled = on;
    if (BY_CLAUDE) { $('#ffLater').textContent = text || laterText; return; }
    $('#ffGo').disabled = on;
    $('#ffGo').textContent = text || 'Převést na recept';
  };
  // Vyšší rozlišení, aby šel rukopis dobře přečíst
  const blobs = () => Promise.all(photos.map((p) => compressImage(p.file, 2200, 0.85)));

  if (!BY_CLAUDE) $('#ffGo').onclick = async () => {
    if (!photos.length) { toast('Přidejte aspoň jednu fotku'); return; }
    busy(true, 'Čtu recept z fotky…');
    try {
      await convertToDraft(await blobs());
    } catch (err) {
      toast('Převod se nepovedl: ' + err.message + '. Fotku můžete uložit a převést později.');
      busy(false);
    }
  };

  // Uložit jen fotku (stav „čeká“): přepíše ji Claude, nebo ji uživatel převede později z detailu receptu
  $('#ffLater').onclick = async () => {
    const name = BY_CLAUDE ? $('#ff-title').value.trim() : '';
    if (BY_CLAUDE && !name) { toast('Napište název jídla'); $('#ff-title').focus(); return; }
    if (!photos.length) { toast('Přidejte aspoň jednu fotku'); return; }
    busy(true, 'Ukládám…');
    try {
      const rec = normalizeRecipe({
        title: name || `Nafocený recept ${new Date().toLocaleDateString('cs-CZ')}`,
        notes: BY_CLAUDE ? $('#ff-note').value.trim() : '', status: 'ceka',
      });
      for (const b of await blobs()) rec.photos.push(await store.uploadPhoto(rec.id, b));
      await store.saveRecipe(rec);
      await loadRecipes(true);
      toast(BY_CLAUDE ? 'Uloženo – Claude ho přepíše' : 'Fotka uložena, převést ji můžete později');
      location.replace('#/r/' + encodeURIComponent(rec.id));
    } catch (err) {
      toast('Uložení se nepovedlo: ' + err.message);
      busy(false);
    }
  };
}

/* ================= Týden: jídelníček ================= */

const DAY_NAMES = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const MEALS = [['obed', 'Oběd'], ['vecere', 'Večeře']];
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const shortDate = (d) => `${d.getDate()}. ${d.getMonth() + 1}.`;

async function renderPlan(preselectRecipeId) {
  setTitle('Jídelníček');
  const recipes = await loadRecipes();
  if (!state.week) state.week = mondayOf(new Date());
  const today = isoDay(new Date());
  let plan = [];

  const load = async () => {
    // O týden dřív kvůli jídlům „na více dní“, která začala minulý týden
    plan = await store.listPlan(isoDay(addDays(state.week, -14)), isoDay(addDays(state.week, 6)));
  };

  // Které položky jídelníčku připadají na daný den (i pokračování vícedenních jídel)
  const entriesFor = (dayIso) => plan.filter((p) => {
    const offset = Math.round((parseDay(dayIso) - parseDay(p.day)) / 864e5);
    return offset >= 0 && offset < p.days;
  }).map((p) => ({ ...p, dayNo: Math.round((parseDay(dayIso) - parseDay(p.day)) / 864e5) + 1 }));

  const draw = () => {
    const end = addDays(state.week, 6);
    const isThisWeek = isoDay(state.week) === isoDay(mondayOf(new Date()));
    const weekEntries = plan.filter((p) => p.day >= isoDay(state.week) && p.day <= isoDay(end));
    const withRecipe = weekEntries.filter((p) => recipes.some((r) => r.id === p.recipe_id));
    app.innerHTML = `
      <div class="week-nav">
        <button class="icon-btn" id="prevW" aria-label="Předchozí týden"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div><b>${shortDate(state.week)} – ${shortDate(end)}</b><small>${isThisWeek ? 'tento týden' : `<button class="link-btn" id="thisW">zpět na tento týden</button>`}</small></div>
        <button class="icon-btn" id="nextW" aria-label="Další týden"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      ${withRecipe.length ? `<button class="btn block" id="shopWeek" style="margin-bottom:12px">${ICON.cart} Nakoupit suroviny na týden</button>` : ''}
      <div class="week">${DAY_NAMES.map((name, i) => {
        const d = addDays(state.week, i);
        const di = isoDay(d);
        const items = entriesFor(di);
        return `<div class="day ${di === today ? 'today' : ''}">
          <div class="day-head"><b>${name}</b> <span>${shortDate(d)}</span>
            <button class="link-btn" data-add="${di}">+ Přidat</button></div>
          ${MEALS.map(([key, label]) => {
            const list = items.filter((p) => p.meal === key);
            if (!list.length) return '';
            return `<div class="meal"><span class="meal-label">${label}</span><div class="meal-items">${list.map((p) => {
              const r = recipes.find((x) => x.id === p.recipe_id);
              const titleHtml = r ? `<a href="#/r/${encodeURIComponent(r.id)}">${esc(r.title)}</a>` : `<span>${esc(p.title)}</span>`;
              return `<div class="plan-item ${p.dayNo > 1 ? 'cont' : ''}">
                ${titleHtml}
                ${r ? '' : '<span class="idea">💡 nápad</span>'}
                ${p.days > 1 ? `<span class="days">${p.dayNo}. den z ${p.days}</span>` : ''}
                ${p.note ? `<small>${esc(p.note)}</small>` : ''}
                <button class="edit" data-edit="${esc(p.id)}" aria-label="Upravit">${ICON.edit}</button>
                <button class="del" data-del="${esc(p.id)}" aria-label="Odebrat">${ICON.x}</button>
              </div>`;
            }).join('')}</div></div>`;
          }).join('') || '<div class="day-empty">nic naplánováno</div>'}
        </div>`;
      }).join('')}</div>`;

    $('#prevW').onclick = async () => { state.week = addDays(state.week, -7); await load(); draw(); };
    $('#nextW').onclick = async () => { state.week = addDays(state.week, 7); await load(); draw(); };
    const tw = $('#thisW');
    if (tw) tw.onclick = async () => { state.week = mondayOf(new Date()); await load(); draw(); };
    $$('[data-add]').forEach((b) => (b.onclick = () => openAdd(b.dataset.add)));
    $$('[data-edit]').forEach((b) => (b.onclick = () => {
      const p = plan.find((x) => x.id === b.dataset.edit);
      openAdd(p.day, p.recipe_id, p);
    }));
    $$('[data-del]').forEach((b) => (b.onclick = async () => {
      const p = plan.find((x) => x.id === b.dataset.del);
      if (!confirm(`Odebrat „${p.title}“ z jídelníčku?`)) return;
      try { await store.deletePlan(p.id); await load(); draw(); } catch (e) { toast('Chyba: ' + e.message); }
    }));
    const sw = $('#shopWeek');
    if (sw) sw.onclick = () => shopWeek(withRecipe);
  };

  // Z plánu rovnou nákup: stejné suroviny se sečtou, co je doma, se přeskočí.
  // Jídla, ze kterých už nákup vznikl, se podruhé nepřidávají (jinak by se množství zdvojila).
  const shopWeek = async (entries) => {
    let done = [];
    try { done = JSON.parse(localStorage.getItem('bk_plan_shopped')) || []; } catch { /* nic */ }
    const fresh = entries.filter((p) => !done.includes(p.id));
    if (!fresh.length) { toast('Suroviny na tato jídla už v nákupu jsou'); return; }
    const atHome = homeFilter();
    const items = [], skipped = new Set();
    for (const p of fresh) {
      const r = recipes.find((x) => x.id === p.recipe_id);
      for (const ing of r.ingredients) {
        if (ing.section) continue;
        if (atHome(ing.name)) { skipped.add(ing.name); continue; }
        items.push({ name: ing.name, qty: ing.qty, unit: ing.unit, amount: ingredientAmount(ing) || null, recipe_id: r.id, recipe_title: r.title });
      }
    }
    const meals = `${fresh.length} ${plural(fresh.length, 'jídla', 'jídel', 'jídel')}`;
    const skip = skipped.size ? `\nPřeskočím, co máte doma: ${[...skipped].join(', ')}.` : '';
    if (!items.length) { toast('Všechno potřebné máte doma'); return; }
    if (!confirm(`Přidat do nákupu suroviny z ${meals}? Stejné suroviny sečtu.${skip}`)) return;
    try {
      toast(shopMsg(await addToShopping(items)));
      localStorage.setItem('bk_plan_shopped', JSON.stringify([...done, ...fresh.map((p) => p.id)].slice(-300)));
    } catch (e) { toast('Nepodařilo se přidat: ' + e.message); }
  };

  // Spodní panel pro přidání (nebo úpravu) jídla: z receptů, nebo jen nápad
  const openAdd = (dayIso, recipeId = null, editing = null) => {
    let meal = 'obed', days = 1, mode = 'recept', chosen = recipeId, q = '', idea = '', note = '';
    if (editing) {
      meal = editing.meal; days = editing.days; note = editing.note || '';
      if (!recipes.some((r) => r.id === editing.recipe_id)) { mode = 'napad'; idea = editing.title; }
    }
    // Vícedenní jídlo mohlo začít minulý týden – jeho den musí být v nabídce taky
    const dayOptions = DAY_NAMES.map((n, i) => [isoDay(addDays(state.week, i)), `${n} ${shortDate(addDays(state.week, i))}`]);
    if (!dayOptions.some(([di]) => di === dayIso)) {
      const d = parseDay(dayIso);
      dayOptions.unshift([dayIso, `${DAY_NAMES[(d.getDay() + 6) % 7]} ${shortDate(d)}`]);
    }
    const sheet = document.createElement('div');
    sheet.className = 'sheet-wrap';
    document.body.appendChild(sheet);
    const close = () => sheet.remove();

    const drawSheet = () => {
      const words = norm(q).split(/\s+/).filter(Boolean);
      const list = recipes.filter((r) => matches(r, words)).slice(0, 40);
      sheet.innerHTML = `<div class="sheet form">
        <div class="sheet-head"><b>${editing ? 'Upravit v jídelníčku' : 'Přidat do jídelníčku'}</b><button class="icon-btn" id="shClose" aria-label="Zavřít">${ICON.x}</button></div>
        <label>${editing && editing.days > 1 ? 'Od kterého dne' : 'Den'}</label>
        <select class="field" id="shDay">${dayOptions.map(([di, label]) => `<option value="${di}" ${di === dayIso ? 'selected' : ''}>${label}</option>`).join('')}</select>
        <div class="grid2">
          <div><label>Jídlo</label><div class="seg">${MEALS.map(([k, l]) => `<button type="button" class="chip ${meal === k ? 'on' : ''}" data-meal="${k}">${l}</button>`).join('')}</div></div>
          <div><label>Na kolik dní</label><div class="servings"><button type="button" id="dMinus">−</button><span>${days} ${plural(days, 'den', 'dny', 'dní')}</span><button type="button" id="dPlus">+</button></div></div>
        </div>
        <div class="seg tabs">
          <button type="button" class="chip ${mode === 'recept' ? 'on' : ''}" data-mode="recept">📖 Z receptů</button>
          <button type="button" class="chip ${mode === 'napad' ? 'on' : ''}" data-mode="napad">💡 Nápad</button>
        </div>
        ${mode === 'recept' ? `
          <input type="text" id="shQ" placeholder="Hledat recept…" value="${esc(q)}" autocomplete="off">
          <div class="pick-list">${list.map((r) => `<button type="button" class="pick ${chosen === r.id ? 'on' : ''}" data-r="${esc(r.id)}">${esc(r.title)}<small>${esc(r.categories.join(', '))}</small></button>`).join('') || '<div class="day-empty">Nic nenalezeno</div>'}</div>`
        : `
          <input type="text" id="shIdea" placeholder="např. Zkusit thajské kari" value="${esc(idea)}" autocomplete="off">`}
        <input type="text" id="shNote" placeholder="poznámka, odkaz… (nepovinné)" value="${esc(note)}" autocomplete="off" style="margin-top:8px">
        <div class="row"><button type="button" class="btn primary" id="shSave">${editing ? 'Uložit' : 'Přidat'}</button></div>
      </div>`;

      $('#shClose', sheet).onclick = close;
      $('#shDay', sheet).onchange = (e) => { dayIso = e.target.value; };
      $$('[data-meal]', sheet).forEach((b) => (b.onclick = () => { meal = b.dataset.meal; drawSheet(); }));
      $$('[data-mode]', sheet).forEach((b) => (b.onclick = () => { mode = b.dataset.mode; drawSheet(); }));
      $('#dMinus', sheet).onclick = () => { if (days > 1) { days--; drawSheet(); } };
      $('#dPlus', sheet).onclick = () => { if (days < 14) { days++; drawSheet(); } };
      const qi = $('#shQ', sheet);
      if (qi) qi.oninput = (e) => {
        q = e.target.value;
        const pos = e.target.selectionStart;
        drawSheet();
        const n = $('#shQ', sheet); n.focus(); n.setSelectionRange(pos, pos);
      };
      // Rozepsaný nápad si pamatujeme, aby ho překreslení panelu (dny, oběd/večeře) nesmazalo
      const ii = $('#shIdea', sheet);
      if (ii) ii.oninput = (e) => { idea = e.target.value; };
      const ni = $('#shNote', sheet);
      if (ni) ni.oninput = (e) => { note = e.target.value; };
      $$('[data-r]', sheet).forEach((b) => (b.onclick = () => { chosen = b.dataset.r; drawSheet(); }));
      $('#shSave', sheet).onclick = async () => {
        let item;
        if (mode === 'recept') {
          const r = recipes.find((x) => x.id === chosen);
          if (!r) { toast('Vyberte recept'); return; }
          item = { day: dayIso, meal, days, recipe_id: r.id, title: r.title, note: note.trim() || null };
        } else {
          const t = idea.trim();
          if (!t) { toast('Napište, co chcete zkusit'); return; }
          item = { day: dayIso, meal, days, recipe_id: null, title: t, note: note.trim() || null };
        }
        try {
          if (editing) await store.updatePlan(editing.id, item);
          else await store.addPlan(item);
          close();
          await load();
          draw();
          toast(editing ? 'Uloženo' : 'Přidáno do jídelníčku');
        } catch (e) { toast((editing ? 'Nepodařilo se uložit: ' : 'Nepodařilo se přidat: ') + e.message); }
      };
    };
    sheet.onclick = (e) => { if (e.target === sheet) close(); };
    drawSheet();
  };

  await load();
  draw();
  if (preselectRecipeId) {
    history.replaceState(null, '', '#/tyden');
    const todayInWeek = today >= isoDay(state.week) && today <= isoDay(addDays(state.week, 6)) ? today : isoDay(state.week);
    openAdd(todayInWeek, preselectRecipeId);
  }
}

/* ================= Nákup: oddělení obchodu a sčítání surovin ================= */

// Vlastní české rozdělení; klíčová slova bez diakritiky, vyhrává nejdelší shoda
// („mletá paprika“ je koření, ne zelenina). Pořadí si uživatel přeskládá podle svého obchodu.
const DEPTS = [
  ['zelenina', '🥕 Ovoce a zelenina', ['jablk', 'hrusk', 'banan', 'citron', 'limet', 'pomeranc', 'mandarin', 'hrozn', 'jahod', 'malin',
    'boruvk', 'svestk', 'merunk', 'broskv', 'kiwi', 'ananas', 'mrkev', 'mrkv', 'petrzel', 'celer', 'cibul', 'cesnek', 'brambor',
    'rajc', 'paprik', 'okurk', 'cuket', 'lilek', 'dyn', 'zeli', 'kapust', 'kvetak', 'brokolic', 'salat', 'spenat', 'porek', 'redkv',
    'hub', 'zampion', 'kopr', 'pazitk', 'bylink', 'avokad', 'zazvor', 'repa', 'fazolk', 'kedlubn', 'rukol', 'cerstv']],
  ['pecivo', '🥖 Pečivo', ['chleb', 'rohlik', 'housk', 'baget', 'veka', 'toust', 'tortil', 'pecivo', 'kolac', 'buchty']],
  ['mlecne', '🥛 Mléčné a chlazené', ['mlek', 'mleko', 'smetan', 'masl', 'syr', 'tvaroh', 'jogurt', 'vejce', 'vajec', 'vajic', 'cottage',
    'mozzarel', 'parmezan', 'eidam', 'niva', 'kefir', 'podmasl', 'zerve', 'lucin', 'ricott', 'mascarpon', 'slehack', 'drozd', 'hera', 'margarin']],
  ['maso', '🥩 Maso, uzeniny a ryby', ['maso', 'kure', 'kurec', 'vepr', 'hove', 'teleci', 'kruti', 'kachn', 'husi', 'mlete', 'slanin',
    'sunk', 'salam', 'klobas', 'parek', 'parky', 'spek', 'jatr', 'ryb', 'losos', 'filet', 'file', 'krevet', 'svickov', 'kotlet', 'zebir']],
  ['trvanlive', '🥫 Trvanlivé a koření', ['mouk', 'cukr', 'ryz', 'testovin', 'spaget', 'krupic', 'vlock', 'olej', 'ocet', 'octa', 'kaka',
    'cokolad', 'prasek do peciva', 'kypric', 'vanil', 'rozink', 'orech', 'mandl', 'med', 'dzem', 'konzerv', 'protlak', 'kecup', 'horcic',
    'majonez', 'strouhank', 'sul', 'soli', 'kmin', 'pepr', 'mleta paprik', 'sladka paprik', 'koreni', 'bobkov', 'skoric', 'hrebicek',
    'muskat', 'majoran', 'oregan', 'bazalk', 'tymian', 'bujon', 'vyvar', 'kureci vyvar', 'hovezi vyvar', 'cocka', 'cocky', 'fazol', 'hrach', 'cizrn', 'kukuric',
    'susene hub', 'susenych hub', 'piskot', 'kokos', 'tuna', 'tunak', 'sardink', 'zelatin', 'puding']],
  ['mrazene', '🧊 Mražené', ['mrazen', 'zmrzlin']],
  ['napoje', '🧃 Nápoje', ['vino', 'pivo', 'dzus', 'mineralk', 'rum', 'limonad', 'sirup', 'kava', 'caj']],
  ['ostatni', '🧺 Ostatní', []],
];
const DEPT_LABEL = Object.fromEntries(DEPTS.map(([k, l]) => [k, l]));

function deptOf(name) {
  const n = norm(name);
  let best = 'ostatni', len = 0;
  for (const [key, , kws] of DEPTS) {
    for (const kw of kws) if (kw.length > len && n.includes(kw)) { best = key; len = kw.length; }
  }
  return best;
}

function deptOrder() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('bk_dept_order')) || []; } catch { /* výchozí */ }
  const keys = DEPTS.map(([k]) => k);
  return [...saved.filter((k) => keys.includes(k)), ...keys.filter((k) => !saved.includes(k))];
}

// Množství v základní jednotce, aby šlo sčítat (25 dkg + 200 g = 450 g)
const UNIT_BASE = { g: ['g', 1], dkg: ['g', 10], kg: ['g', 1000], ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000],
  ks: ['ks', 1], kus: ['ks', 1], kusy: ['ks', 1], 'kusů': ['ks', 1] };
function baseQty(qty, unit) {
  const u = UNIT_BASE[String(unit || '').toLowerCase()];
  return u ? { q: qty * u[1], u: u[0] } : { q: qty, u: String(unit || '').toLowerCase() };
}
function prettyAmount(q, u) {
  if (u === 'g' && q >= 1000) return `${formatQty(q / 1000, 'kg')} kg`;
  if (u === 'ml' && q >= 1000) return `${formatQty(q / 1000, 'l')} l`;
  return [formatQty(q, u), u].filter(Boolean).join(' ');
}

// Stejná surovina i v jiném pádě („hladké mouky“ = „hladká mouka“), ale ne „mouka“ = „hrubá mouka“
function sameName(a, b) {
  const wa = words(a), wb = words(b);
  return wa.length === wb.length && wa.every((w, i) => wordMatches(w, wb[i]) || wordMatches(wb[i], w));
}

function mergeAmount(a, b) {
  if (b.qty == null) return a.amount || !b.amount ? {} : { amount: b.amount };
  if (a.qty == null) return a.amount ? { amount: `${a.amount} + ${b.amount}` } : { qty: b.qty, unit: b.unit, amount: b.amount };
  const x = baseQty(a.qty, a.unit), y = baseQty(b.qty, b.unit);
  if (x.u !== y.u) return { qty: null, unit: '', amount: `${a.amount} + ${b.amount}` };
  const q = x.q + y.q;
  return { qty: q, unit: x.u, amount: prettyAmount(q, x.u) };
}

// Přidá do nákupu; stejné suroviny, které už v seznamu jsou, sečte
async function addToShopping(items) {
  await loadShopping();
  const open = state.shopping.filter((s) => !s.checked);
  const adds = [], changed = new Set();
  for (const raw of items) {
    const it = { qty: null, unit: '', amount: null, ...raw };
    const ex = [...open, ...adds].find((s) => sameName(s.name, it.name));
    if (!ex) { adds.push({ ...it, dept: it.dept || deptOf(it.name) }); continue; }
    Object.assign(ex, mergeAmount(ex, it));
    const from = String(ex.recipe_title || '').split(', ').filter(Boolean);
    if (it.recipe_title && !from.includes(it.recipe_title)) ex.recipe_title = [...from, it.recipe_title].join(', ');
    if (!adds.includes(ex)) changed.add(ex);
  }
  if (adds.length) await store.addShopping(adds);
  for (const ex of changed) {
    await store.updateShopping(ex.id, { qty: ex.qty, unit: ex.unit, amount: ex.amount, recipe_title: ex.recipe_title });
  }
  await loadShopping();
  return { added: adds.length, merged: changed.size };
}

const shopMsg = ({ added, merged }) => {
  const parts = [
    added ? `${added} ${plural(added, 'nová položka', 'nové položky', 'nových položek')}` : '',
    merged ? `${merged} ${plural(merged, 'sečtená', 'sečtené', 'sečtených')} s tím, co už v seznamu bylo` : '',
  ].filter(Boolean);
  return parts.length ? `Do nákupu: ${parts.join(', ')}` : 'Vše už v nákupu je';
};

// Suroviny, které jsou doma (seznam z „Co je doma“ a volitelně sůl, pepř…)
function homeFilter() {
  let haves = [];
  try { haves = JSON.parse(localStorage.getItem('rc_doma')) || []; } catch { /* nic */ }
  const useStaples = localStorage.getItem('rc_doma_staples') !== '0';
  const hw = haves.map(words).filter((h) => h.length);
  return (name) => {
    const iws = words(name);
    return hw.some((h) => h.every((x) => iws.some((iw) => wordMatches(x, iw))))
      || (useStaples && iws.some((iw) => STAPLES.includes(iw)));
  };
}

/* ================= Nákupní seznam ================= */

async function renderShop() {
  setTitle('Nákupní seznam');
  app.innerHTML = `
    <form class="add-row form" id="addForm">
      <input type="text" id="newItem" placeholder="Přidat položku, např. 2 l mléka" autocomplete="off">
      <button class="btn primary" type="submit">Přidat</button>
    </form>
    <div id="shopBody"><div class="loading">Načítám…</div></div>`;

  // Položka, kterou právě upravujeme (název a množství – třeba „1 balení“ místo „2 ks“)
  let editing = null;

  const item = (i) => i.id === editing ? `
    <li class="editing" data-id="${esc(i.id)}">
      <form class="edit-item form" data-form="${esc(i.id)}">
        <div class="edit-fields">
          <input type="text" name="name" value="${esc(i.name)}" placeholder="Co koupit" aria-label="Název">
          <input type="text" name="amount" value="${esc(i.amount || '')}" placeholder="množství" aria-label="Množství">
        </div>
        <div class="quick-amt">
          <button type="button" class="chip" data-amt="">bez množství</button>
          <button type="button" class="chip" data-amt="1 balení">1 balení</button>
          <button type="button" class="chip" data-amt="1 ks">1 ks</button>
        </div>
        <label class="dept-pick">Oddělení
          <select name="dept">${DEPTS.map(([k, l]) => `<option value="${k}" ${(i.dept || deptOf(i.name)) === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </label>
        <div class="row">
          <button type="button" class="btn" data-act="cancel">Zrušit</button>
          <button type="submit" class="btn primary">Uložit</button>
        </div>
      </form>
    </li>` : `
    <li class="${i.checked ? 'checked' : ''}" data-id="${esc(i.id)}">
      <button class="chk" data-act="toggle" aria-label="Odškrtnout">${ICON.check}</button>
      <div class="txt" data-act="${i.checked ? 'toggle' : 'edit'}">
        <span class="nm">${esc(i.name)}</span>${i.amount ? ` <span class="amt">${esc(i.amount)}</span>` : ''}
        ${i.recipe_title ? `<span class="from">${esc(i.recipe_title)}</span>` : ''}
      </div>
      <button class="del" data-act="del" aria-label="Smazat">${ICON.x}</button>
    </li>`;

  const draw = () => {
    if (location.hash !== '#/shop') return;
    const open = state.shopping.filter((i) => !i.checked);
    const done = state.shopping.filter((i) => i.checked);
    updateShopBadge();
    // Nekoupené položky po odděleních v pořadí, jak jdou v obchodě
    const groups = deptOrder().map((k) => [k, open.filter((i) => (i.dept || deptOf(i.name)) === k)]).filter(([, l]) => l.length);
    $('#shopBody').innerHTML = !state.shopping.length
      ? empty('Seznam je prázdný', 'Přidejte položku nahoře, nebo v receptu ťukněte na ingredience, které chybí.')
      : `${open.length ? `<div class="group-title"><span>Koupit (${open.length})</span>
            <span>${navigator.share ? `<button class="link-btn" id="shareBtn">Poslat seznam</button> · ` : ''}<button class="link-btn" id="deptBtn">Pořadí oddělení</button></span></div>
          <p class="hint">Ťukněte na položku a upravte množství (třeba „1 balení“) nebo oddělení.</p>
          ${groups.map(([k, list]) => `<div class="dept-title">${DEPT_LABEL[k]}</div>
            <ul class="shop-list">${list.map(item).join('')}</ul>`).join('')}` : empty('Vše nakoupeno', 'Hezky jste to zvládli.')}
         ${done.length ? `<div class="group-title"><span>V košíku (${done.length})</span>
            <button class="link-btn" id="clearDone">Smazat odškrtnuté</button></div>
          <ul class="shop-list">${done.map(item).join('')}</ul>` : ''}`;
    const share = $('#shareBtn');
    if (share) share.onclick = () => navigator.share({
      title: 'Nákupní seznam',
      text: groups.map(([k, list]) => `${DEPT_LABEL[k]}\n${list.map((i) => `• ${i.name}${i.amount ? ` (${i.amount})` : ''}`).join('\n')}`).join('\n\n'),
    }).catch(() => {});
    const deptBtn = $('#deptBtn');
    if (deptBtn) deptBtn.onclick = openDeptOrder;
    const clear = $('#clearDone');
    if (clear) clear.onclick = async () => {
      const ids = done.map((i) => i.id);
      state.shopping = state.shopping.filter((i) => !i.checked);
      draw();
      try { await store.deleteShopping(ids); } catch (e) { toast('Chyba: ' + e.message); }
    };
    const form = $('[data-form]');
    if (form) {
      const fName = form.elements.namedItem('name'), fAmt = form.elements.namedItem('amount');
      fAmt.focus();
      form.onsubmit = async (e) => {
        e.preventDefault();
        const it = state.shopping.find((i) => i.id === form.dataset.form);
        const amount = fAmt.value.trim() || null;
        // Množství i jako číslo, aby šlo sčítat s dalšími přidanými surovinami
        const pa = amount ? parseIngredient(`${amount} _`) : null;
        const patch = { name: fName.value.trim() || it.name, amount, qty: pa?.qty ?? null, unit: pa?.unit || '',
          dept: form.elements.namedItem('dept').value };
        Object.assign(it, patch);
        editing = null;
        draw();
        try { await store.updateShopping(it.id, patch); } catch (err) { toast('Chyba: ' + err.message); }
      };
      $$('[data-amt]', form).forEach((b) => (b.onclick = () => { fAmt.value = b.dataset.amt; form.requestSubmit(); }));
    }
  };

  $('#shopBody').onclick = async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const id = e.target.closest('li')?.dataset.id;
    if (!act || !id) return;
    const it = state.shopping.find((i) => i.id === id);
    if (act === 'edit') { editing = id; draw(); return; }
    if (act === 'cancel') { editing = null; draw(); return; }
    try {
      if (act === 'toggle') {
        it.checked = !it.checked;
        draw();
        await store.updateShopping(id, { checked: it.checked });
      } else {
        state.shopping = state.shopping.filter((i) => i.id !== id);
        draw();
        await store.deleteShopping([id]);
      }
    } catch (err) { toast('Chyba: ' + err.message); }
  };

  $('#addForm').onsubmit = async (e) => {
    e.preventDefault();
    const v = $('#newItem').value.trim();
    if (!v) return;
    const p = parseIngredient(v);
    const amount = p.qty != null ? ingredientAmount(p) : null;
    $('#newItem').value = '';
    try {
      const res = await addToShopping([{ name: p.name, qty: p.qty, unit: p.unit, amount }]);
      if (res.merged) toast('Už v seznamu bylo, množství jsem sečetl');
      draw();
    } catch (err) { toast('Nepodařilo se přidat: ' + err.message); }
  };

  // Pořadí oddělení podle obchodu, kam chodíte (pamatuje se v zařízení)
  const openDeptOrder = () => {
    let order = deptOrder();
    const sheet = document.createElement('div');
    sheet.className = 'sheet-wrap';
    document.body.appendChild(sheet);
    const drawSheet = () => {
      sheet.innerHTML = `<div class="sheet">
        <div class="sheet-head"><b>Pořadí oddělení</b><button class="icon-btn" data-close aria-label="Zavřít">${ICON.x}</button></div>
        <p class="hint">Seřaďte oddělení tak, jak jimi procházíte v obchodě.</p>
        <ul class="dept-order">${order.map((k, n) => `<li><span>${DEPT_LABEL[k]}</span>
          <button class="btn small" data-up="${n}" ${n === 0 ? 'disabled' : ''} aria-label="Nahoru">↑</button>
          <button class="btn small" data-down="${n}" ${n === order.length - 1 ? 'disabled' : ''} aria-label="Dolů">↓</button></li>`).join('')}</ul>
        <div class="row"><button class="link-btn" data-reset>Výchozí pořadí</button></div>
      </div>`;
    };
    sheet.onclick = (e) => {
      if (e.target === sheet || e.target.closest('[data-close]')) { sheet.remove(); draw(); return; }
      const b = e.target.closest('button');
      if (!b) return;
      const swap = (a, c) => { [order[a], order[c]] = [order[c], order[a]]; };
      if (b.dataset.up != null) swap(+b.dataset.up, +b.dataset.up - 1);
      if (b.dataset.down != null) swap(+b.dataset.down, +b.dataset.down + 1);
      if (b.hasAttribute('data-reset')) order = DEPTS.map(([k]) => k);
      try { localStorage.setItem('bk_dept_order', JSON.stringify(order)); } catch { /* bez úložiště */ }
      drawSheet();
    };
    drawSheet();
  };

  // Změny z druhého telefonu nepřekreslují seznam, dokud se položka upravuje
  store.onShoppingChange(async () => { await loadShopping(); if (!editing) draw(); });
  await loadShopping();
  draw();
}

/* ================= Více: import, export, účet ================= */

async function renderMore() {
  setTitle('Více');
  const recipes = await loadRecipes();
  const email = store.mode === 'supabase' ? await store.userEmail() : '';
  const pending = recipes.filter((r) => r.status === 'ceka');
  app.innerHTML = `
    <div class="section">
      <h3>Účet</h3>
      ${store.mode === 'supabase'
        ? `<p class="kv">Přihlášen(a): <b>${esc(email)}</b></p>
           <div class="row"><button class="btn" id="logout">Odhlásit</button></div>`
        : '<p class="kv">Recepty jsou zatím uložené jen v tomto zařízení.</p>'}
      <p class="kv">Receptů celkem: <b>${recipes.length}</b></p>
    </div>

    <div class="section">
      <h3>${PENDING} (${pending.length})</h3>
      <p class="hint">${BY_CLAUDE ? 'Nafocené recepty, které Claude ještě nepřepsal. Na počítači se je dozví sám.'
        : 'Nafocené recepty, které jste uložili na později. V detailu receptu je tlačítko Převést teď.'}</p>
      ${pending.length ? `<ul class="pending">${pending.map((r) => `<li><a href="#/r/${encodeURIComponent(r.id)}">✍️ ${esc(r.title)}</a></li>`).join('')}</ul>` : ''}
      <div class="row"><a class="btn primary" href="#/foto">${ICON.camera} ${BY_CLAUDE ? 'Nafotit recept' : 'Recept z papírku'}</a></div>
    </div>

    <div class="section form">
      <h3>Import receptů</h3>
      <p class="hint">Nahrajte soubor s recepty (.json), třeba zálohu nebo recepty připravené Claudem. Recepty se stejným názvem se přeskočí.</p>
      <label class="btn block" style="margin:0">Vybrat soubor…<input type="file" accept=".json,application/json" id="impFile" hidden></label>
      <label for="impText">…nebo vložte text</label>
      <textarea id="impText" rows="4" placeholder='{"recipes": [ ... ]}'></textarea>
      <div class="row"><button class="btn primary" id="impBtn">Importovat</button></div>
      <div class="err" id="impMsg"></div>
    </div>

    <div class="section">
      <h3>Záloha</h3>
      <p class="hint">Stáhne všechny recepty (bez fotek) do jednoho souboru.</p>
      <div class="row"><button class="btn" id="expBtn">Stáhnout zálohu</button></div>
    </div>`;


  const lo = $('#logout');
  if (lo) lo.onclick = async () => { await store.signOut(); state.recipes = null; localStorage.removeItem('rc_cache_recipes'); route(); };

  $('#impFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (f) $('#impText').value = await f.text();
  };

  $('#impBtn').onclick = async () => {
    const btn = $('#impBtn'), msg = $('#impMsg');
    msg.textContent = '';
    let data;
    try { data = JSON.parse($('#impText').value); } catch { msg.textContent = 'Text není platný JSON.'; return; }
    const items = Array.isArray(data) ? data : data.recipes || (data.title ? [data] : []);
    if (!items.length) { msg.textContent = 'V souboru nejsou žádné recepty.'; return; }
    btn.disabled = true;
    const existing = new Set(recipes.map((r) => norm(r.title)));
    let added = 0, skipped = 0;
    try {
      for (const raw of items) {
        const rec = normalizeRecipe({ ...raw, id: undefined, photos: [] });
        if (existing.has(norm(rec.title))) { skipped++; continue; }
        btn.textContent = `Importuji ${added + 1}/${items.length}…`;
        for (const d of (raw.photo_data || []).slice(0, MAX_PHOTOS)) {
          const blob = await dataUrlToBlob(d);
          rec.photos.push(await store.uploadPhoto(rec.id, await compressImage(blob, 2200, 0.85)));
        }
        await store.saveRecipe(rec);
        existing.add(norm(rec.title));
        added++;
      }
      await loadRecipes(true);
      toast(`Importováno ${added} ${plural(added, 'recept', 'recepty', 'receptů')}${skipped ? `, přeskočeno ${skipped}` : ''}`);
      location.hash = '#/';
    } catch (err) {
      msg.textContent = `Import se zastavil po ${added} receptech: ${err.message}`;
      btn.disabled = false;
      btn.textContent = 'Importovat';
    }
  };

  $('#expBtn').onclick = () => {
    const out = { exported_at: new Date().toISOString(), recipes: recipes.map(({ photos, ...r }) => r) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = `recepty-zaloha-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
}

/* ================= Start ================= */

$('#appleTitle').content = EDICE.kratky || APP_NAME;
$('#backBtn').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
window.addEventListener('hashchange', route);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Edice s databází: nákup se po návratu do aplikace obnoví, po odhlášení zpět na přihlášení
if (store.mode === 'supabase') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadShopping(); });
  store.sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') route(); });
}

route().then(loadShopping);
drawTimers(); // rozběhnuté minutky z minula (a ty, které mezitím doběhly)
