// Azarraga Design Studio — core model, SVG markup, templates.
// A design is stored as data (shapes in millimetres), never as a picture,
// so it can be reopened, edited, resized and re-drawn sharply anywhere.

export type Sym = 'none' | 'louver' | 'F' | 'L' | 'R' | 'LR' | 'awning' | 'tilt' | 'swingL' | 'swingR';

export type Shape =
  | { id: string; t: 'rect'; x: number; y: number; w: number; h: number; sym: Sym }
  | { id: string; t: 'arch'; x: number; y: number; w: number; h: number; sym: Sym }
  | { id: string; t: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number }
  | { id: string; t: 'text'; x: number; y: number; text: string; size: number };

export interface Design {
  id: string;
  name: string;
  code: string;          // e.g. W1, D1
  description: string;   // e.g. "798 Sliding Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass"
  widthMm: number;
  heightMm: number;
  shapes: Shape[];
  updatedAt: string;
  unit?: Unit;           // how sizes are shown/typed (storage is always mm)
  spec?: Spec;           // glass, frame, profile, finish
  section?: Section;     // Windows | Doors | Others
  type?: string;         // catalog type, e.g. Sliding Windows
  series?: string;       // e.g. 798 Series
}

export type Unit = 'm' | 'mm' | 'ft';
export interface Spec { glassMm: number; glassType: string; frame: string; hardware: string; profileMm: number; finish: string }

export const INK = '#082a47';
export const BLUE = '#0F4C81';
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const R = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const NS = 'vector-effect="non-scaling-stroke"';
const FONT = `font-family="Hanken Grotesk, Helvetica, Arial, sans-serif"`;

export const SYMBOLS: { key: Sym; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'F', label: 'Fixed' },
  { key: 'louver', label: 'Louver' },
  { key: 'L', label: 'Slide ←' },
  { key: 'R', label: 'Slide →' },
  { key: 'LR', label: 'Slide ↔' },
  { key: 'awning', label: 'Awning' },
  { key: 'tilt', label: 'Tilt' },
  { key: 'swingL', label: 'Swing L' },
  { key: 'swingR', label: 'Swing R' },
];

function arrowPath(x1: number, y1: number, x2: number, y2: number, hs: number, both = false): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = (tx: number, ty: number, ang: number) =>
    `M${R(tx + hs * Math.cos(ang + Math.PI - 0.5))} ${R(ty + hs * Math.sin(ang + Math.PI - 0.5))} L${R(tx)} ${R(ty)} L${R(tx + hs * Math.cos(ang + Math.PI + 0.5))} ${R(ty + hs * Math.sin(ang + Math.PI + 0.5))}`;
  let d = `M${R(x1)} ${R(y1)} L${R(x2)} ${R(y2)} ${head(x2, y2, a)}`;
  if (both) d += ` ${head(x1, y1, a + Math.PI)}`;
  return d;
}

const path = (d: string, ink: string, sw: number) =>
  `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${NS}/>`;

/** Solid triangle arrowhead used by the invoice style (dir 1 = right, -1 = left). */
function tri(cx: number, cy: number, m: number, dir: 1 | -1, ink: string): string {
  const k = clamp(m * 0.12, 26, 60);
  return `<polygon points="${R(cx - dir * k * 0.6)},${R(cy - k * 0.7)} ${R(cx - dir * k * 0.6)},${R(cy + k * 0.7)} ${R(cx + dir * k * 0.8)},${R(cy)}" fill="${ink}"/>`;
}

/** Opening symbol drawn inside a panel (x,y,w,h in mm). */
export function symbolMarkup(x: number, y: number, w: number, h: number, sym: Sym, ink = INK, sw = 2, inv = false): string {
  const cx = x + w / 2, cy = y + h / 2, m = Math.min(w, h);
  const hs = clamp(m * 0.12, 20, 80);
  const s = sw * 0.75;
  switch (sym) {
    case 'F':
      return `<text x="${R(cx)}" y="${R(cy)}" font-size="${R(clamp(m * 0.28, 40, 150))}" text-anchor="middle" dominant-baseline="central" ${FONT} font-weight="600" fill="${ink}">F</text>`;
    case 'L': return inv ? tri(cx, cy, m, -1, ink) : path(arrowPath(x + w * 0.72, cy, x + w * 0.28, cy, hs), ink, s);
    case 'R': return inv ? tri(cx, cy, m, 1, ink) : path(arrowPath(x + w * 0.28, cy, x + w * 0.72, cy, hs), ink, s);
    case 'LR': return inv ? tri(cx - clamp(m * 0.16, 30, 80), cy, m, -1, ink) + tri(cx + clamp(m * 0.16, 30, 80), cy, m, 1, ink) : path(arrowPath(x + w * 0.25, cy, x + w * 0.75, cy, hs, true), ink, s);
    case 'louver': {
      const n = Math.max(3, Math.round(h / 110)); let d = '';
      for (let i = 1; i < n; i++) d += `M${R(x)} ${R(y + (h * i) / n)} H${R(x + w)} `;
      return path(d.trim(), ink, s);
    }
    case 'awning': return path(`M${R(x)} ${R(y + h)} L${R(cx)} ${R(y)} L${R(x + w)} ${R(y + h)}`, ink, s);
    case 'tilt': return path(`M${R(x)} ${R(y)} L${R(cx)} ${R(y + h)} L${R(x + w)} ${R(y)}`, ink, s);
    case 'swingL': return path(`M${R(x + w)} ${R(y)} L${R(x)} ${R(cy)} L${R(x + w)} ${R(y + h)}`, ink, s);
    case 'swingR': return path(`M${R(x)} ${R(y)} L${R(x + w)} ${R(cy)} L${R(x)} ${R(y + h)}`, ink, s);
    default: return '';
  }
}

const TINT = 'rgba(15,76,129,0.07)';

/** SVG inner markup for one shape. `hit` adds a fat invisible stroke to make thin lines easy to tap. */
export function shapeMarkup(s: Shape, o: { ink?: string; sw?: number; hit?: boolean; fill?: string; inv?: boolean } = {}): string {
  const ink = o.ink ?? INK, sw = o.sw ?? 2.5, fill = o.fill ?? TINT, inv = !!o.inv;
  switch (s.t) {
    case 'rect':
      return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fill}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round" ${NS}/>` + symbolMarkup(s.x, s.y, s.w, s.h, s.sym, ink, sw, inv);
    case 'arch': {
      const r = Math.min(s.w / 2, s.h);
      const d = `M${s.x} ${s.y + s.h} V${R(s.y + r)} A${R(r)} ${R(r)} 0 0 1 ${s.x + s.w} ${R(s.y + r)} V${s.y + s.h} Z`;
      return `<path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round" ${NS}/>` + symbolMarkup(s.x, s.y + r, s.w, s.h - r, s.sym, ink, sw, inv);
    }
    case 'line':
    case 'arrow': {
      const hs = clamp(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * 0.12, 20, 80);
      const d = s.t === 'arrow' ? arrowPath(s.x1, s.y1, s.x2, s.y2, hs) : `M${s.x1} ${s.y1} L${s.x2} ${s.y2}`;
      const hit = o.hit ? `<path d="M${s.x1} ${s.y1} L${s.x2} ${s.y2}" stroke="transparent" stroke-width="18" fill="none" ${NS}/>` : '';
      return path(d, ink, sw) + hit;
    }
    case 'text':
      return `<text x="${s.x}" y="${s.y}" font-size="${s.size}" text-anchor="middle" dominant-baseline="central" ${FONT} fill="${ink}">${esc(s.text)}</text>`;
  }
}

/** Standalone SVG document. Used for thumbnails, PNG/SVG export and quote/invoice images. */
export function designToSvg(
  d: Pick<Design, 'widthMm' | 'heightMm' | 'shapes'>,
  o: { px?: number; ink?: string; bg?: string | null; dims?: boolean; sw?: number; style?: 'line' | 'invoice'; tone?: 'blue' | 'grey'; fmt?: (mm: number) => string } = {},
): string {
  const inv = o.style === 'invoice';
  const { px = 1200, bg = null } = o;
  const ink = o.ink ?? (inv ? '#000' : INK), dims = o.dims ?? !inv, sw = o.sw ?? (inv ? 4 : 3);
  const stops = o.tone === 'grey' ? ['#ffffff', '#b9bcc0'] : ['#eef5fd', '#6aa7e8'];
  const W = d.widthMm, H = d.heightMm, big = Math.max(W, H);
  const m = dims ? big * 0.17 : big * 0.04, p = dims ? big * 0.06 : big * 0.04;
  const vx = -m, vy = -p, vw = W + m + p, vh = H + m + p;
  const pxH = Math.round((px * vh) / vw);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${pxH}" viewBox="${R(vx)} ${R(vy)} ${R(vw)} ${R(vh)}">`;
  if (inv) out += `<defs><linearGradient id="invg-${o.tone ?? 'blue'}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/></linearGradient></defs>`;
  if (bg) out += `<rect x="${R(vx)}" y="${R(vy)}" width="${R(vw)}" height="${R(vh)}" fill="${bg}"/>`;
  out += d.shapes.map((s) => shapeMarkup(s, inv ? { ink, sw, fill: `url(#invg-${o.tone ?? 'blue'})`, inv: true } : { ink, sw })).join('');
  out += `<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${ink}" stroke-width="${sw * 1.8}" stroke-linejoin="miter" ${NS}/>`;
  if (dims) {
    const f = o.fmt ?? ((mm: number) => (mm / 1000).toFixed(2));
    const y0 = H + m * 0.45, x0 = -m * 0.45, t = m * 0.09, fs = m * 0.3;
    out += path(`M0 ${R(y0)} H${W} M0 ${R(y0 - t)} V${R(y0 + t)} M${W} ${R(y0 - t)} V${R(y0 + t)}`, ink, sw * 0.5);
    out += path(`M${R(x0)} 0 V${H} M${R(x0 - t)} 0 H${R(x0 + t)} M${R(x0 - t)} ${H} H${R(x0 + t)}`, ink, sw * 0.5);
    out += `<text x="${R(W / 2)}" y="${R(y0 + m * 0.3)}" font-size="${R(fs)}" text-anchor="middle" dominant-baseline="central" ${FONT} fill="${ink}">${esc(f(W))}</text>`;
    const tx = x0 - m * 0.22, ty = H / 2;
    out += `<text x="${R(tx)}" y="${R(ty)}" font-size="${R(fs)}" text-anchor="middle" dominant-baseline="central" ${FONT} fill="${ink}" transform="rotate(-90 ${R(tx)} ${R(ty)})">${esc(f(H))}</text>`;
  }
  return out + '</svg>';
}

/** Rasterise an SVG string to a PNG data URL (transparent unless the SVG has a background). */
export function svgToPngDataUrl(svg: string, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const g = c.getContext('2d');
      if (!g) return reject(new Error('Canvas unavailable'));
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not render drawing'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

export const blankDesign = (): Design => ({
  id: uid(), name: '', code: '', description: '', section: 'Windows', type: '', series: '', unit: 'm', spec: defaultSpec('Windows'), widthMm: 1200, heightMm: 1100, updatedAt: new Date().toISOString(),
  shapes: [{ id: uid(), t: 'rect', x: 0, y: 0, w: 1200, h: 1100, sym: 'none' }],
});

/** Rescale every shape when the overall size changes. */
export function rescale(d: Design, W: number, H: number): Design {
  const sx = W / d.widthMm, sy = H / d.heightMm;
  const shapes = d.shapes.map((s): Shape => {
    switch (s.t) {
      case 'rect': case 'arch': return { ...s, x: Math.round(s.x * sx), y: Math.round(s.y * sy), w: Math.round(s.w * sx), h: Math.round(s.h * sy) };
      case 'line': case 'arrow': return { ...s, x1: Math.round(s.x1 * sx), y1: Math.round(s.y1 * sy), x2: Math.round(s.x2 * sx), y2: Math.round(s.y2 * sy) };
      case 'text': return { ...s, x: Math.round(s.x * sx), y: Math.round(s.y * sy) };
    }
  });
  return { ...d, widthMm: W, heightMm: H, shapes };
}

/** Split a panel into n equal panels. dir 'v' = side by side, 'h' = stacked. */
export function splitRect(s: Extract<Shape, { t: 'rect' }>, dir: 'v' | 'h', n: number): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i < n; i++) {
    if (dir === 'v') {
      const a = Math.round(s.x + (s.w * i) / n), b = Math.round(s.x + (s.w * (i + 1)) / n);
      out.push({ id: uid(), t: 'rect', x: a, y: s.y, w: b - a, h: s.h, sym: 'none' });
    } else {
      const a = Math.round(s.y + (s.h * i) / n), b = Math.round(s.y + (s.h * (i + 1)) / n);
      out.push({ id: uid(), t: 'rect', x: s.x, y: a, w: s.w, h: b - a, sym: 'none' });
    }
  }
  return out;
}

// ---------- Units: metres, millimetres, feet-inches with fractions ----------
export const UNIT_LABEL: Record<Unit, string> = { m: 'Metres', mm: 'Millimetres', ft: 'Feet-inches' };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Reads a typed size and returns millimetres (or null if unreadable).
 * Accepts: 1.15 · 1150 · 115cm · 3' · 3' 7 1/2" · 3'-7" · 42 1/2 · 1/2"
 * A bare number follows the selected unit (feet-inches mode: bare = inches).
 * Anything with ' or " or a fraction is read as feet/inches whatever the unit.
 */
export function parseLength(input: string, unit: Unit): number | null {
  const s = input.trim().toLowerCase().replace(/[′’`]/g, "'").replace(/[″”]/g, '"')
    .replace(/\b(feet|foot|ft)\b/g, "'").replace(/\b(inches|inch|in)\b/g, '"').replace(/\s+/g, ' ');
  if (!s) return null;
  let m = s.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m)$/);
  if (m) return Math.round(parseFloat(m[1]) * (m[2] === 'mm' ? 1 : m[2] === 'cm' ? 10 : 1000));
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*'\s*-?\s*)?(?:(\d+(?:\.\d+)?)\s*)?(?:(\d+)\s*\/\s*(\d+)\s*)?"?$/);
  if (!m) return null;
  const [, ft, whole, n, d] = m;
  if (ft === undefined && whole === undefined && n === undefined) return null;
  if (d !== undefined && parseInt(d, 10) === 0) return null;
  const marked = /['"]/.test(s), hasFrac = n !== undefined;
  if (!marked && !hasFrac) {
    const v = parseFloat(whole as string);
    return Math.round(unit === 'mm' ? v : unit === 'm' ? v * 1000 : v * 25.4);
  }
  const inches = (ft ? parseFloat(ft) * 12 : 0) + (whole ? parseFloat(whole) : 0) + (hasFrac ? parseInt(n, 10) / parseInt(d, 10) : 0);
  return Math.round(inches * 25.4);
}

/** Shows millimetres in the chosen unit. denom = smallest fraction (16 → nearest 1/16"). */
export function formatLength(mm: number, unit: Unit, denom = 16): string {
  if (unit === 'm') return (mm / 1000).toFixed(2);
  if (unit === 'mm') return String(Math.round(mm));
  const units = Math.round((mm / 25.4) * denom), per = 12 * denom;
  const feet = Math.floor(units / per), rem = units % per, whole = Math.floor(rem / denom);
  let n = rem % denom, dd = denom;
  if (n) { const g = gcd(n, dd); n /= g; dd /= g; }
  const inch = [whole ? String(whole) : '', n ? `${n}/${dd}` : ''].filter(Boolean).join(' ');
  const parts = [feet ? `${feet}'` : '', inch ? `${inch}"` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : '0"';
}

export const GRID_OPTIONS: Record<Unit, { mm: number; label: string }[]> = {
  m: [{ mm: 10, label: '10 mm' }, { mm: 25, label: '25 mm' }, { mm: 50, label: '50 mm' }, { mm: 100, label: '100 mm' }],
  mm: [{ mm: 10, label: '10 mm' }, { mm: 25, label: '25 mm' }, { mm: 50, label: '50 mm' }, { mm: 100, label: '100 mm' }],
  ft: [{ mm: 6.35, label: '1/4"' }, { mm: 12.7, label: '1/2"' }, { mm: 25.4, label: '1"' }, { mm: 50.8, label: '2"' }, { mm: 152.4, label: '6"' }],
};

// ---------- Glass / frame specification ----------
export const SPEC_OPTIONS = {
  glassMm: [5, 6, 8, 10, 12],
  glassType: ['Annealed Clear', 'Tempered', 'Laminated'],
  frame: ['1 x 3 Tubular Frame', '2 x 4 Frame', '4" Framing System'],
  profileMm: [1.2, 1.4, 1.6, 2.0],
  finish: ['Dark Bronze', 'White', 'Analok'],
};

export function defaultSpec(section: Section = 'Windows'): Spec {
  if (section === 'Doors') return { glassMm: 10, glassType: 'Annealed Clear', frame: '', hardware: 'HA', profileMm: 0, finish: '' };
  if (section === 'Others') return { glassMm: 10, glassType: 'Tempered', frame: '', hardware: '', profileMm: 0, finish: '' };
  return { glassMm: 6, glassType: 'Annealed Clear', frame: '1 x 3 Tubular Frame', hardware: 'HA', profileMm: 0, finish: '' };
}

// ---------- Catalog (matches the website: Windows / Doors / Others By Type) ----------
export type Section = 'Windows' | 'Doors' | 'Others';
export const CATALOG: Record<Section, { type: string; series: string[] }[]> = {
  Windows: [
    { type: 'Casement Windows', series: ['38 Series', '50 Series', '60 Series'] },
    { type: 'Awning Windows', series: ['38 Series', '50 Series', '60 Series'] },
    { type: 'Sliding Windows', series: ['798 Series', '900 Series', '868 Series', '130 Series'] },
    { type: 'Jalousie Windows', series: ['4" Blades (Local)', '6" Blades (Local)', '4" High-End', '6" High-End', 'Glass Ventilation', 'Glass Ventilation with Fan', 'Glass Louver with Exhaust Fan'] },
    { type: 'Fixed Windows', series: ['Low-End', 'Low/Middle-End', 'Frameless', 'High-End'] },
    { type: 'Folding Windows', series: [] },
  ],
  Doors: [
    { type: 'Bi-Fold Doors', series: ['High-End'] },
    { type: 'Sliding Doors', series: [] },
    { type: 'Casement/Swing Doors', series: ['Local', 'High-End'] },
    { type: 'Roll-Up Doors', series: [] },
    { type: 'Hanging Doors', series: [] },
    { type: 'Screen Doors', series: [] },
  ],
  Others: [
    { type: 'Skylight', series: [] }, { type: 'Glass Railings', series: [] }, { type: 'Sunroom', series: [] },
    { type: 'Stainless Steel Works', series: [] }, { type: 'ACP Cladding & Others', series: [] },
    { type: 'Shower Enclosures', series: [] }, { type: 'Tempered Glass Storefronts', series: [] },
    { type: 'Frameless Patch Fittings', series: [] }, { type: 'Glass Shelves & Table Tops', series: [] },
    { type: 'Mullion & Canopy', series: [] }, { type: 'Slide Up', series: [] }, { type: 'Cabinets (Glass / Aluminum)', series: [] },
  ],
};

/** Writes the quotation description line in the same wording as the invoice. */
export function buildDescription(d: Pick<Design, 'section' | 'type' | 'series' | 'widthMm' | 'heightMm' | 'shapes' | 'unit' | 'spec'>, o: { denom?: number } = {}): string {
  const unit = d.unit ?? 'm', denom = o.denom ?? 16;
  const size = `${formatLength(d.widthMm, unit, denom)} x ${formatLength(d.heightMm, unit, denom)}`;
  const sp = { ...defaultSpec(d.section), ...(d.spec ?? {}) };
  const glass = sp.glassMm ? `${sp.glassMm}mm ${sp.glassType ? sp.glassType + ' ' : ''}Glass` : '';
  const profile = sp.profileMm ? `${sp.profileMm}mm Profile` : '';
  const type = d.type || (d.section === 'Doors' ? 'Doors' : 'Windows');
  const single = type.replace(/([^s])s$/, '$1');
  const panels = d.shapes.filter((s) => s.t === 'rect' || s.t === 'arch').length;
  const join = (xs: string[]) => xs.filter(Boolean).join(', ');
  if (d.section === 'Doors') {
    let head: string;
    if (type === 'Casement/Swing Doors') {
      const leaves = d.shapes.filter((s) => s.t === 'rect' && (s.sym === 'swingL' || s.sym === 'swingR')).length;
      head = `${leaves >= 2 ? 'Double' : 'Single'} Leaf ED Door`;
    } else head = `${d.series ? d.series + ' ' : ''}${single}`;
    return join([head + (sp.frame ? ` with ${sp.frame}` : ''), sp.hardware, glass, profile, sp.finish, size]);
  }
  if (d.section === 'Others') return join([single, glass, sp.finish, size]);
  const series = type === 'Sliding Windows' ? (d.series ?? '').replace(' Series', '') : d.series ?? '';
  const prefix = /Awning/.test(type) && panels >= 3 ? `${panels} Panel ` : '';
  return join([`${prefix}${series ? series + ' ' : ''}${single}${sp.frame ? ` with ${sp.frame}` : ''}`, sp.hardware, glass, profile, sp.finish, size]);
}

// ---------- Templates: starting points, always editable ----------
export interface Template { key: string; name: string; cat: Section; type?: string; w: number; h: number; build: (w: number, h: number) => Shape[] }

const rc = (x: number, y: number, w: number, h: number, sym: Sym = 'none'): Shape =>
  ({ id: uid(), t: 'rect', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), sym });
const row = (w: number, h: number, syms: Sym[], y = 0, hh = h) => syms.map((s, i) => rc((w * i) / syms.length, y, w / syms.length, hh, s));
const col = (w: number, h: number, syms: Sym[]) => syms.map((s, i) => rc(0, (h * i) / syms.length, w, h / syms.length, s));
const grid = (w: number, h: number, rows: number, cols: number, s: Sym) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => rc((w * c) / cols, (h * r) / rows, w / cols, h / rows, s))).flat();

const SW = 'Sliding Windows', AW = 'Awning Windows', CW = 'Casement Windows', FW = 'Fixed Windows', JW = 'Jalousie Windows';
const SD = 'Sliding Doors', CD = 'Casement/Swing Doors';

export const TEMPLATES: Template[] = [
  { key: 's2', name: 'Sliding 2 panel', cat: 'Windows', type: SW, w: 1150, h: 1500, build: (w, h) => row(w, h, ['R', 'L']) },
  { key: 's3', name: 'Sliding 3 panel', cat: 'Windows', type: SW, w: 1800, h: 1200, build: (w, h) => row(w, h, ['R', 'LR', 'L']) },
  { key: 's4', name: 'Sliding 4 panel', cat: 'Windows', type: SW, w: 2400, h: 1200, build: (w, h) => row(w, h, ['F', 'L', 'R', 'F']) },
  { key: 'counter', name: 'Fixed-sliding counter', cat: 'Windows', type: SW, w: 1500, h: 1200, build: (w, h) => [rc(0, 0, w, h * 0.4, 'F'), ...row(w, h, ['R', 'L'], h * 0.4, h * 0.6)] },
  { key: 'stop', name: 'Sliding + top light', cat: 'Windows', type: SW, w: 1200, h: 1400, build: (w, h) => [rc(0, 0, w, h * 0.25, 'F'), ...row(w, h, ['R', 'L'], h * 0.25, h * 0.75)] },
  { key: 'a1', name: 'Awning 1', cat: 'Windows', type: AW, w: 600, h: 600, build: (w, h) => [rc(0, 0, w, h, 'awning')] },
  { key: 'a2', name: 'Awning 2 high', cat: 'Windows', type: AW, w: 600, h: 1200, build: (w, h) => col(w, h, ['awning', 'awning']) },
  { key: 'a3', name: 'Awning 3 high', cat: 'Windows', type: AW, w: 600, h: 1800, build: (w, h) => col(w, h, ['awning', 'awning', 'awning']) },
  { key: 'a3h', name: 'Awning 3 wide', cat: 'Windows', type: AW, w: 1500, h: 500, build: (w, h) => row(w, h, ['awning', 'awning', 'awning']) },
  { key: 'a22', name: 'Awning 2 × 2', cat: 'Windows', type: AW, w: 1200, h: 1000, build: (w, h) => grid(w, h, 2, 2, 'awning') },
  { key: 'a23', name: 'Awning 3 × 2', cat: 'Windows', type: AW, w: 1800, h: 1000, build: (w, h) => grid(w, h, 2, 3, 'awning') },
  { key: 'c1', name: 'Casement 1', cat: 'Windows', type: CW, w: 800, h: 1100, build: (w, h) => [rc(0, 0, w, h, 'swingL')] },
  { key: 'c2', name: 'Casement 2', cat: 'Windows', type: CW, w: 1200, h: 1100, build: (w, h) => row(w, h, ['swingL', 'swingR']) },
  { key: 'tilt', name: 'Tilt', cat: 'Windows', type: CW, w: 800, h: 600, build: (w, h) => [rc(0, 0, w, h, 'tilt')] },
  { key: 'jal', name: 'Jalousie 1', cat: 'Windows', type: JW, w: 600, h: 1200, build: (w, h) => [rc(0, 0, w, h, 'louver')] },
  { key: 'jal2', name: 'Jalousie 2', cat: 'Windows', type: JW, w: 1200, h: 1200, build: (w, h) => row(w, h, ['louver', 'louver']) },
  { key: 'fx', name: 'Fixed', cat: 'Windows', type: FW, w: 1000, h: 1200, build: (w, h) => [rc(0, 0, w, h, 'F')] },
  { key: 'arch', name: 'Arched fixed', cat: 'Windows', type: FW, w: 900, h: 1500, build: (w, h) => [{ id: uid(), t: 'arch', x: 0, y: 0, w, h, sym: 'F' }] },
  { key: 'd1', name: 'Single swing door', cat: 'Doors', type: CD, w: 900, h: 2100, build: (w, h) => [rc(0, 0, w, h, 'swingL')] },
  { key: 'd2', name: 'Double swing door', cat: 'Doors', type: CD, w: 1650, h: 2100, build: (w, h) => row(w, h, ['swingL', 'swingR']) },
  { key: 'dt', name: 'Door + transom', cat: 'Doors', type: CD, w: 900, h: 2400, build: (w, h) => [rc(0, 0, w, h * 0.2, 'F'), rc(0, h * 0.2, w, h * 0.8, 'swingL')] },
  { key: 'sd2', name: 'Sliding door 2', cat: 'Doors', type: SD, w: 1800, h: 2100, build: (w, h) => row(w, h, ['R', 'L']) },
  { key: 'sd3', name: 'Sliding door 3', cat: 'Doors', type: SD, w: 2700, h: 2100, build: (w, h) => row(w, h, ['R', 'LR', 'L']) },
  { key: 'sd4', name: 'Sliding + fixed sides', cat: 'Doors', type: SD, w: 3000, h: 2100, build: (w, h) => row(w, h, ['F', 'L', 'R', 'F']) },
  { key: 'bf4', name: 'Bi-fold 4', cat: 'Doors', type: 'Bi-Fold Doors', w: 2400, h: 2100, build: (w, h) => row(w, h, ['swingL', 'swingR', 'swingL', 'swingR']) },
  { key: 'rail', name: 'Glass railing', cat: 'Others', type: 'Glass Railings', w: 3000, h: 1000, build: (w, h) => row(w, h, ['F', 'F', 'F', 'F']) },
  { key: 'shower', name: 'Shower enclosure', cat: 'Others', type: 'Shower Enclosures', w: 1200, h: 2000, build: (w, h) => [rc(0, 0, w * 0.45, h, 'F'), rc(w * 0.45, 0, w * 0.55, h, 'swingR')] },
  { key: 'store', name: 'Glass storefront', cat: 'Others', type: 'Tempered Glass Storefronts', w: 4000, h: 2400, build: (w, h) => [rc(0, 0, w * 0.3, h, 'F'), rc(w * 0.3, 0, w * 0.2, h, 'swingL'), rc(w * 0.5, 0, w * 0.2, h, 'swingR'), rc(w * 0.7, 0, w * 0.3, h, 'F')] },
];

/** The 8 items from the quotation, ready to drop in with the exact wording. */
export interface Preset { code: string; name: string; tpl: string; section: Section; type: string; series: string; w: number; h: number; desc: string }
export const PRESETS: Preset[] = [
  { code: 'D1', name: 'Double Leaf ED Door', tpl: 'd2', section: 'Doors', type: CD, series: '', w: 1650, h: 2100, desc: 'Double Leaf ED Door, HA, 10mm Annealed Clear Glass, 1.65 x 2.10' },
  { code: 'D9', name: 'Single Leaf ED Door', tpl: 'd1', section: 'Doors', type: CD, series: '', w: 900, h: 2100, desc: 'Single Leaf ED Door, HA, 10mm Annealed Clear Glass, 0.90 x 2.10' },
  { code: 'W1', name: '798 Sliding Window', tpl: 's2', section: 'Windows', type: SW, series: '798 Series', w: 1150, h: 1500, desc: '798 Sliding Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass, 1.15 x 1.50' },
  { code: 'W2', name: '798 Sliding Window', tpl: 's2', section: 'Windows', type: SW, series: '798 Series', w: 1150, h: 800, desc: '798 Sliding Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass, 1.15 x 0.80' },
  { code: 'W3', name: '3 Panel 38 Awning', tpl: 'a3', section: 'Windows', type: AW, series: '38 Series', w: 600, h: 1800, desc: '3 Panel 38 Series Awning Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass, 0.60 x 1.80' },
  { code: 'W4', name: '3 Panel 38 Awning', tpl: 'a3h', section: 'Windows', type: AW, series: '38 Series', w: 1500, h: 500, desc: '3 Panel 38 Series Awning Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass, 1.50 x 0.50' },
  { code: 'W5', name: '38 Awning', tpl: 'a1', section: 'Windows', type: AW, series: '38 Series', w: 500, h: 600, desc: '38 Series Awning Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass, 0.50 x 0.60' },
  { code: 'W6', name: 'Fixed-Sliding Counter', tpl: 'counter', section: 'Windows', type: SW, series: '', w: 1500, h: 1200, desc: 'Fixed-Sliding Counter Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass, 1.50 x 1.20' },
];
