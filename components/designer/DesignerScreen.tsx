/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs, react/no-unescaped-entities, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BLUE, CATALOG, GRID_OPTIONS, INK, PRESETS, SPEC_OPTIONS, SYMBOLS, TEMPLATES, UNIT_LABEL, blankDesign, buildDescription, clamp, defaultSpec, designToSvg,
  formatLength, parseLength, rescale, shapeMarkup, splitRect, svgToPngDataUrl, symbolMarkup, uid,
  type Design, type Preset, type Section, type Shape, type Spec, type Sym, type Template, type Unit,
} from './designer-core';
import { apiStore, type DesignStore } from './designStore';

type Tool = 'select' | 'rect' | 'arch' | 'line' | 'arrow' | 'text';
type Snap = { w: number; h: number; shapes: Shape[] };
type Drag = { mode: 'move' | 'resize' | 'create'; id: string; orig: Shape; start: { x: number; y: number }; h?: string; changed: boolean };

export interface DesignerScreenProps {
  store?: DesignStore;
  initial?: Design;
  /** Called with the design and a transparent PNG data URL when the user taps "Use in quote". */
  onUseInQuote?: (design: Design, png: string) => void;
  /** Refreshes the shared catalog after an owner-designed product is published. */
  onProductSaved?: () => void | Promise<void>;
}

const TOOLS: { key: Tool; label: string; glyph: string }[] = [
  { key: 'select', label: 'Select', glyph: '↖' },
  { key: 'rect', label: 'Panel', glyph: '▭' },
  { key: 'arch', label: 'Arch', glyph: '◠' },
  { key: 'line', label: 'Line', glyph: '／' },
  { key: 'arrow', label: 'Arrow', glyph: '→' },
  { key: 'text', label: 'Text', glyph: 'T' },
];

function LengthField({ label, value, placeholder, onCommit }: { label: string; value: string; placeholder?: string; onCommit: (s: string) => boolean }) {
  const [v, setV] = useState(value);
  const [bad, setBad] = useState(false);
  useEffect(() => { setV(value); setBad(false); }, [value]);
  const commit = () => { if (v.trim() === value) { setBad(false); return; } setBad(!onCommit(v)); };
  return (
    <label className="dz-f dz-num"><span>{label}</span>
      <input className={bad ? 'bad' : ''} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
  );
}

export default function DesignerScreen({ store = apiStore, initial, onUseInQuote, onProductSaved }: DesignerScreenProps) {
  const [design, setDesign] = useState<Design>(() => initial ?? blankDesign());
  const dref = useRef(design); dref.current = design;
  const past = useRef<Snap[]>([]); const future = useRef<Snap[]>([]);
  const [, bump] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [grid, setGrid] = useState(50);
  const [dirty, setDirty] = useState(false);
  const [lib, setLib] = useState<Design[] | null>(null);
  const [toast, setToast] = useState('');
  const [splitN, setSplitN] = useState(2);
  const [dimsOn, setDimsOn] = useState(false);
  const [denom, setDenom] = useState(16);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);

  const W = design.widthMm, H = design.heightMm, big = Math.max(W, H);
  const mg = big * 0.16, pg = big * 0.05;
  const selShape = design.shapes.find((s) => s.id === sel) ?? null;
  const unit: Unit = design.unit ?? 'm';
  const fmt = (mm: number) => formatLength(mm, unit, denom);
  const spec: Spec = { ...defaultSpec(design.section ?? 'Windows'), ...(design.spec ?? {}) };
  const setSpec = (p: Partial<Spec>) => setMeta({ spec: { ...spec, ...p } });
  const section: Section = design.section ?? 'Windows';
  const tone = section === 'Doors' ? 'grey' : 'blue';
  const stops = tone === 'grey' ? ['#ffffff', '#b9bcc0'] : ['#eef5fd', '#6aa7e8'];
  const typeList = CATALOG[section];
  const seriesList = typeList.find((x) => x.type === design.type)?.series ?? [];
  const setMeta = (p: Partial<Design>) => { setDesign((d) => ({ ...d, ...p })); setDirty(true); };

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const cur = (): Snap => ({ w: dref.current.widthMm, h: dref.current.heightMm, shapes: dref.current.shapes });
  const snapshot = () => { past.current.push(cur()); if (past.current.length > 100) past.current.shift(); future.current = []; setDirty(true); bump((n) => n + 1); };
  const apply = (s: Snap) => { setDesign((d) => ({ ...d, widthMm: s.w, heightMm: s.h, shapes: s.shapes })); setSel(null); setDirty(true); bump((n) => n + 1); };
  const undo = () => { const p = past.current.pop(); if (!p) return; future.current.push(cur()); apply(p); };
  const redo = () => { const f = future.current.pop(); if (!f) return; past.current.push(cur()); apply(f); };
  const mapShapes = (fn: (s: Shape[]) => Shape[]) => setDesign((d) => ({ ...d, shapes: fn(d.shapes) }));
  const patch = (id: string, p: Partial<Shape>) => mapShapes((ss) => ss.map((s) => (s.id === id ? ({ ...s, ...p } as Shape) : s)));

  const del = () => { if (!sel) return; snapshot(); mapShapes((ss) => ss.filter((s) => s.id !== sel)); setSel(null); };
  const dup = () => {
    if (!selShape) return; snapshot();
    const c = { ...selShape, id: uid() } as Shape;
    if (c.t === 'rect' || c.t === 'arch') { c.x = clamp(c.x + 100, 0, W - c.w); c.y = clamp(c.y + 100, 0, H - c.h); }
    else if (c.t === 'line' || c.t === 'arrow') { c.x1 += 100; c.x2 += 100; c.y1 += 100; c.y2 += 100; }
    else if (c.t === 'text') { c.x += 100; c.y += 100; }
    mapShapes((ss) => [...ss, c]); setSel(c.id);
  };
  const setSym = (sym: Sym) => { if (!selShape || (selShape.t !== 'rect' && selShape.t !== 'arch')) return; snapshot(); patch(selShape.id, { sym }); };
  const split = (dir: 'v' | 'h') => {
    if (!selShape || selShape.t !== 'rect') return; snapshot();
    const parts = splitRect(selShape, dir, splitN);
    mapShapes((ss) => ss.flatMap((s) => (s.id === selShape.id ? parts : [s]))); setSel(null);
  };
  const applyTemplate = (t: Template) => {
    snapshot();
    setDesign((d) => ({ ...d, widthMm: t.w, heightMm: t.h, shapes: t.build(t.w, t.h), section: t.cat, type: t.type ?? '', series: '', spec: d.section === t.cat ? d.spec : defaultSpec(t.cat) }));
    setSel(null); setTool('select');
  };
  const applyPreset = (p: Preset) => {
    const t = TEMPLATES.find((x) => x.key === p.tpl)!; snapshot();
    setDesign((d) => ({ ...d, code: p.code, name: p.name, description: p.desc, section: p.section, type: p.type, series: p.series, spec: defaultSpec(p.section), widthMm: p.w, heightMm: p.h, shapes: t.build(p.w, p.h) }));
    setSel(null); setTool('select');
  };
  const changeSize = (nw: number, nh: number) => {
    if (nw === dref.current.widthMm && nh === dref.current.heightMm) return;
    snapshot(); setDesign((d) => rescale(d, nw, nh));
  };
  const commitSize = (axis: 'w' | 'h', text: string): boolean => {
    const mm = parseLength(text, unit);
    if (mm === null || mm < 200 || mm > 12000) { flash(`Couldn't read that size. Try 1.15, 1150 or 3' 7 1/2"`); return false; }
    if (axis === 'w') changeSize(mm, dref.current.heightMm); else changeSize(dref.current.widthMm, mm);
    return true;
  };
  const changeUnit = (u: Unit) => { setMeta({ unit: u }); setGrid(u === 'ft' ? 25.4 : 50); };

  // ---------- pointer handling ----------
  const pt = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!; const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const r = p.matrixTransform(svg.getScreenCTM()!.inverse()); return { x: r.x, y: r.y };
  };
  const sn = (v: number) => Math.round(Math.round(v / grid) * grid * 100) / 100;

  const onMove = (e: PointerEvent) => {
    const dr = drag.current; if (!dr) return;
    const { widthMm: w, heightMm: h } = dref.current; const p = pt(e);
    const o = dr.orig; let next: Shape | null = null;
    if (dr.mode === 'create') {
      const x = clamp(sn(p.x), 0, w), y = clamp(sn(p.y), 0, h);
      if (o.t === 'rect' || o.t === 'arch') next = { ...o, x: Math.min(dr.start.x, x), y: Math.min(dr.start.y, y), w: Math.abs(x - dr.start.x), h: Math.abs(y - dr.start.y) };
      else if (o.t === 'line' || o.t === 'arrow') next = { ...o, x2: x, y2: y };
    } else if (dr.mode === 'move') {
      const dx = p.x - dr.start.x, dy = p.y - dr.start.y;
      if (o.t === 'rect' || o.t === 'arch') next = { ...o, x: clamp(sn(o.x + dx), 0, w - o.w), y: clamp(sn(o.y + dy), 0, h - o.h) };
      else if (o.t === 'line' || o.t === 'arrow') { const ax = sn(o.x1 + dx) - o.x1, ay = sn(o.y1 + dy) - o.y1; next = { ...o, x1: o.x1 + ax, y1: o.y1 + ay, x2: o.x2 + ax, y2: o.y2 + ay }; }
      else if (o.t === 'text') next = { ...o, x: sn(o.x + dx), y: sn(o.y + dy) };
    } else {
      const nx = clamp(sn(p.x), 0, w), ny = clamp(sn(p.y), 0, h);
      if (o.t === 'rect' || o.t === 'arch') {
        const hd = dr.h!; const fx = hd.includes('w') ? o.x + o.w : o.x, fy = hd.includes('n') ? o.y + o.h : o.y;
        const rw = Math.abs(nx - fx), rh = Math.abs(ny - fy);
        if (rw >= grid && rh >= grid) next = { ...o, x: Math.min(fx, nx), y: Math.min(fy, ny), w: rw, h: rh };
      } else if (o.t === 'line' || o.t === 'arrow') next = dr.h === 'p1' ? { ...o, x1: nx, y1: ny } : { ...o, x2: nx, y2: ny };
    }
    if (next) { dr.changed = true; const n = next; mapShapes((ss) => ss.map((s) => (s.id === dr.id ? n : s))); }
  };
  const onUp = () => {
    const dr = drag.current; drag.current = null; if (!dr) return;
    const s = dref.current.shapes.find((x) => x.id === dr.id);
    const tiny = s && dr.mode === 'create' && (((s.t === 'rect' || s.t === 'arch') && (s.w < grid || s.h < grid)) || ((s.t === 'line' || s.t === 'arrow') && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < grid));
    if (tiny) { mapShapes((ss) => ss.filter((x) => x.id !== dr.id)); past.current.pop(); bump((n) => n + 1); return; }
    if (!dr.changed && dr.mode !== 'create') { past.current.pop(); bump((n) => n + 1); return; }
    if (dr.mode === 'create') { setSel(dr.id); setTool('select'); }
  };
  const listen = () => {
    const mv = (e: PointerEvent) => onMove(e);
    const up = () => { onUp(); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dref.current; const p = pt(e); const t = e.target as Element;
    if (tool === 'select') {
      const hEl = t.closest('[data-h]'); const gEl = t.closest('[data-id]');
      if (hEl && selShape) { snapshot(); drag.current = { mode: 'resize', id: selShape.id, orig: selShape, start: p, h: hEl.getAttribute('data-h')!, changed: false }; listen(); return; }
      if (gEl) {
        const id = gEl.getAttribute('data-id')!; const s = d.shapes.find((x) => x.id === id); if (!s) return;
        setSel(id); snapshot(); drag.current = { mode: 'move', id, orig: s, start: p, changed: false }; listen(); return;
      }
      setSel(null); return;
    }
    const x = clamp(sn(p.x), 0, d.widthMm), y = clamp(sn(p.y), 0, d.heightMm); const id = uid();
    snapshot();
    if (tool === 'text') {
      const s: Shape = { id, t: 'text', x, y, text: 'Text', size: Math.round(Math.max(d.widthMm, d.heightMm) * 0.05) };
      mapShapes((ss) => [...ss, s]); setSel(id); setTool('select'); return;
    }
    const s: Shape = tool === 'rect' || tool === 'arch' ? { id, t: tool, x, y, w: 0, h: 0, sym: 'none' } : { id, t: tool, x1: x, y1: y, x2: x, y2: y };
    mapShapes((ss) => [...ss, s]);
    drag.current = { mode: 'create', id, orig: s, start: { x, y }, changed: true }; listen();
  };

  const act = useRef({ del, undo, redo }); act.current = { del, undo, redo };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement; if (/input|textarea|select/i.test(tg.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act.current.del(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? act.current.redo() : act.current.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); act.current.redo(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  // ---------- save / library / export ----------
  const fname = (design.code || design.name || 'design').trim().replace(/[^\w-]+/g, '_');
  const download = (href: string, name: string) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  const symbolSvg = () => designToSvg(dref.current, { px: 800, style: 'invoice', tone: dref.current.section === 'Doors' ? 'grey' : 'blue', dims: dimsOn, fmt });
  const saveOpenProduct = async () => {
    const d: Design = { ...dref.current, name: dref.current.name.trim() || 'Untitled design', updatedAt: new Date().toISOString() };
    const png = await svgToPngDataUrl(symbolSvg(), 2);
    if (store.publish) {
      const published = await store.publish(d, png);
      await onProductSaved?.();
      flash(`Saved ${published.productKey} to Library and Products`);
    } else {
      await store.save(d);
      flash('Saved to library');
    }
    setDesign(d); setDirty(false);
    return { d, png };
  };
  const exportPng = async () => { try { const { png } = await saveOpenProduct(); download(png, fname + '.png'); } catch { flash('Could not save or create PNG'); } };
  const exportSvg = async () => { try { await saveOpenProduct(); download('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(symbolSvg()), fname + '.svg'); } catch { flash('Could not save or create SVG'); } };
  const useInQuote = async () => { try { onUseInQuote?.(dref.current, await svgToPngDataUrl(symbolSvg(), 2)); } catch { flash('Could not create image'); } };
  const save = async () => {
    try { await saveOpenProduct(); } catch { flash('Open Product save failed'); }
  };
  const openLib = async () => { try { setLib(await store.list()); } catch { flash('Could not load library'); } };
  const openDesign = (d: Design) => { past.current = []; future.current = []; setDesign(d); setSel(null); setDirty(false); setLib(null); };
  const newDesign = () => { if (dirty && !window.confirm('Start a new design? Unsaved changes will be lost.')) return; past.current = []; future.current = []; setDesign(blankDesign()); setSel(null); setDirty(false); };
  const libDelete = async (id: string) => { if (!window.confirm('Delete this design?')) return; await store.remove(id); setLib(await store.list()); };
  const libDup = async (d: Design) => { await store.save({ ...d, id: uid(), name: d.name + ' copy', updatedAt: new Date().toISOString() }); setLib(await store.list()); };

  const thumb = (w: number, h: number, shapes: Shape[], sec: Section, px = 110) => designToSvg({ widthMm: w, heightMm: h, shapes }, { px, style: 'invoice', tone: sec === 'Doors' ? 'grey' : 'blue', sw: 2 });
  const tplThumbs = useMemo(() => TEMPLATES.map((t) => ({ t, svg: thumb(t.w, t.h, t.build(t.w, t.h), t.cat) })), []);
  const presetThumbs = useMemo(() => PRESETS.map((p) => ({ p, svg: thumb(p.w, p.h, TEMPLATES.find((x) => x.key === p.tpl)!.build(p.w, p.h), p.section) })), []);
  const hr = big * 0.022;
  const cursor = tool === 'select' ? 'default' : 'crosshair';

  const handles = (s: Shape) => {
    const pts: [string, number, number][] =
      s.t === 'rect' || s.t === 'arch' ? [['nw', s.x, s.y], ['ne', s.x + s.w, s.y], ['sw', s.x, s.y + s.h], ['se', s.x + s.w, s.y + s.h]]
      : s.t === 'line' || s.t === 'arrow' ? [['p1', s.x1, s.y1], ['p2', s.x2, s.y2]] : [];
    return pts.map(([k, x, y]) => (
      <g key={k} data-h={k} style={{ cursor: 'pointer' }}>
        <circle cx={x} cy={y} r={hr * 2} fill="transparent" />
        <circle cx={x} cy={y} r={hr} fill="#fff" stroke={BLUE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </g>));
  };

  const isPanel = selShape && (selShape.t === 'rect' || selShape.t === 'arch');
  const dimText = (s: Shape) => (s.t === 'rect' || s.t === 'arch' ? `${fmt(s.w)} × ${fmt(s.h)}` : '');

  return (
    <div className="dz">
      <style>{CSS}</style>
      <div className="dz-in">
      <header className="dz-top">
        <div className="dz-meta">
          <label className="dz-f dz-wide"><span>Name</span><input value={design.name} placeholder="e.g. Bedroom sliding window" onChange={(e) => setMeta({ name: e.target.value })} /></label>
          <label className="dz-f dz-code"><span>Code</span><input value={design.code} placeholder="W1" onChange={(e) => setMeta({ code: e.target.value })} /></label>
          <LengthField label={`Width${unit === 'm' ? ' (m)' : unit === 'mm' ? ' (mm)' : ''}`} value={fmt(W)} placeholder={unit === 'ft' ? `3' 7 1/2"` : ''} onCommit={(s) => commitSize('w', s)} />
          <LengthField label={`Height${unit === 'm' ? ' (m)' : unit === 'mm' ? ' (mm)' : ''}`} value={fmt(H)} placeholder={unit === 'ft' ? `5' 0"` : ''} onCommit={(s) => commitSize('h', s)} />
          <label className="dz-f dz-unit"><span>Units</span>
            <select value={unit} onChange={(e) => changeUnit(e.target.value as Unit)}>
              {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select></label>
          {unit === 'ft' && (
            <label className="dz-f dz-unit"><span>Round to</span>
              <select value={denom} onChange={(e) => setDenom(+e.target.value)}><option value={16}>1/16"</option><option value={8}>1/8"</option><option value={4}>1/4"</option></select></label>)}
        </div>
        <div className="dz-meta">
          <label className="dz-f dz-sel"><span>Section</span>
            <select value={section} onChange={(e) => setMeta({ section: e.target.value as Section, type: '', series: '', spec: defaultSpec(e.target.value as Section) })}>
              {(['Windows', 'Doors', 'Others'] as Section[]).map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="dz-f dz-sel"><span>Type</span>
            <select value={design.type ?? ''} onChange={(e) => setMeta({ type: e.target.value, series: '' })}>
              <option value="">— choose —</option>{typeList.map((x) => <option key={x.type}>{x.type}</option>)}</select></label>
          <label className="dz-f dz-sel"><span>Series</span>
            <select value={design.series ?? ''} disabled={!seriesList.length} onChange={(e) => setMeta({ series: e.target.value })}>
              <option value="">{seriesList.length ? '— choose —' : 'n/a'}</option>{seriesList.map((s) => <option key={s}>{s}</option>)}</select></label>
          <div className="dz-acts">
            <button className="dz-b" onClick={undo} disabled={!past.current.length} aria-label="Undo">↶ Undo</button>
            <button className="dz-b" onClick={redo} disabled={!future.current.length} aria-label="Redo">↷ Redo</button>
            <button className="dz-b" onClick={newDesign}>New</button>
            <button className="dz-b" onClick={openLib}>Library</button>
            <button className="dz-b pri" onClick={save}>Save Open Product</button>
          </div>
        </div>
      </header>

      <div className="dz-body">
        <aside className="dz-left">
          <section className="dz-card">
            <h3>From your quotation</h3>
            <div className="dz-tpl">
              {presetThumbs.map(({ p, svg }) => (
                <button key={p.code} className="dz-t" onClick={() => applyPreset(p)} title={p.desc}>
                  <span dangerouslySetInnerHTML={{ __html: svg }} /><em><b>{p.code}</b> · {fmt(p.w)} × {fmt(p.h)}</em>
                </button>))}
            </div>
          </section>
          {(['Windows', 'Doors', 'Others'] as const).map((cat) => (
            <section key={cat} className="dz-card">
              <h3>{cat} — start from</h3>
              <div className="dz-tpl">
                {tplThumbs.filter((x) => x.t.cat === cat).map(({ t, svg }) => (
                  <button key={t.key} className="dz-t" onClick={() => applyTemplate(t)} title={t.name}>
                    <span dangerouslySetInnerHTML={{ __html: svg }} /><em>{t.name}</em>
                  </button>))}
              </div>
            </section>))}
        </aside>

        <main className="dz-stage">
          <div className="dz-tools" role="toolbar" aria-label="Drawing tools">
            {TOOLS.map((t) => (
              <button key={t.key} className={'dz-tool' + (tool === t.key ? ' on' : '')} onClick={() => setTool(t.key)}><i>{t.glyph}</i>{t.label}</button>))}
            <label className="dz-f dz-grid"><span>Snap</span>
              <select value={grid} onChange={(e) => setGrid(+e.target.value)}>
                {GRID_OPTIONS[unit].map((g) => <option key={g.mm} value={g.mm}>{g.label}</option>)}
              </select></label>
          </div>
          <div className="dz-canvas">
            <svg ref={svgRef} viewBox={`${-mg} ${-pg} ${W + mg + pg} ${H + mg + pg}`} onPointerDown={onDown} style={{ touchAction: 'none', cursor }} role="img" aria-label="Drawing canvas">
              <defs>
                <pattern id="dzg" width={grid} height={grid} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r={big / 500} fill="#0F4C81" opacity=".35" /></pattern>
                <linearGradient id={`invg-${tone}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={stops[0]} /><stop offset="1" stopColor={stops[1]} /></linearGradient>
              </defs>
              <rect x={-mg} y={-pg} width={W + mg + pg} height={H + mg + pg} fill="#fff" />
              <rect x={0} y={0} width={W} height={H} fill="url(#dzg)" pointerEvents="none" />
              {design.shapes.map((s) => (
                <g key={s.id} data-id={s.id} style={{ cursor: tool === 'select' ? 'move' : cursor }} dangerouslySetInnerHTML={{ __html: shapeMarkup(s, { ink: '#000', sw: 3, hit: true, fill: `url(#invg-${tone})`, inv: true }) }} />))}
              <rect x={0} y={0} width={W} height={H} fill="none" stroke="#000" strokeWidth={4.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              <g pointerEvents="none" stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill={INK} fontFamily="Hanken Grotesk, Arial, sans-serif" fontSize={mg * 0.2} textAnchor="middle" dominantBaseline="central">
                <path d={`M0 ${H + mg * 0.4} H${W} M0 ${H + mg * 0.34} V${H + mg * 0.46} M${W} ${H + mg * 0.34} V${H + mg * 0.46}`} fill="none" vectorEffect="non-scaling-stroke" />
                <path d={`M${-mg * 0.4} 0 V${H} M${-mg * 0.46} 0 H${-mg * 0.34} M${-mg * 0.46} ${H} H${-mg * 0.34}`} fill="none" vectorEffect="non-scaling-stroke" />
                <text x={W / 2} y={H + mg * 0.68} stroke="none">{fmt(W)}</text>
                <text x={-mg * 0.66} y={H / 2} stroke="none" transform={`rotate(-90 ${-mg * 0.66} ${H / 2})`}>{fmt(H)}</text>
              </g>
              {selShape && (
                <g>
                  {(selShape.t === 'rect' || selShape.t === 'arch') && <rect x={selShape.x} y={selShape.y} width={selShape.w} height={selShape.h} fill="none" stroke={BLUE} strokeWidth={2.5} strokeDasharray="7 5" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
                  {selShape.t === 'text' && <circle cx={selShape.x} cy={selShape.y} r={hr * 0.7} fill={BLUE} pointerEvents="none" />}
                  {handles(selShape)}
                </g>)}
            </svg>
          </div>
          <p className="dz-hint">
            {tool === 'select' ? 'Tap a panel to select it. Drag to move, drag the round handles to resize.' : tool === 'text' ? 'Tap the canvas to place a label.' : 'Drag on the canvas to draw. Lines snap to the grid.'}
          </p>
        </main>

        <aside className="dz-right">
          <section className="dz-card">
            <h3>{selShape ? (isPanel ? `Panel · ${dimText(selShape)}` : selShape.t === 'text' ? 'Label' : 'Line') : 'Selection'}</h3>
            {!selShape && <p className="dz-mute">Select a panel to change what it does, split it, or delete it.</p>}
            {isPanel && (
              <>
                <div className="dz-syms">
                  {SYMBOLS.map((s) => (
                    <button key={s.key} className={'dz-sym' + ((selShape as any).sym === s.key ? ' on' : '')} onClick={() => setSym(s.key)} title={s.label}>
                      <svg viewBox="0 0 100 100" dangerouslySetInnerHTML={{ __html: `<rect x="6" y="6" width="88" height="88" fill="none" stroke="${INK}" stroke-width="2" vector-effect="non-scaling-stroke"/>` + symbolMarkup(6, 6, 88, 88, s.key, INK, 2, true) }} />
                      <em>{s.label}</em>
                    </button>))}
                </div>
                {selShape!.t === 'rect' && (
                  <div className="dz-split">
                    <label className="dz-f"><span>Split into</span>
                      <select value={splitN} onChange={(e) => setSplitN(+e.target.value)}>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} panels</option>)}</select></label>
                    <button className="dz-b" onClick={() => split('v')}>Side by side</button>
                    <button className="dz-b" onClick={() => split('h')}>Stacked</button>
                  </div>)}
              </>)}
            {selShape?.t === 'text' && (
              <label className="dz-f"><span>Text</span>
                <input value={selShape.text} onFocus={snapshot} onChange={(e) => patch(selShape.id, { text: e.target.value })} /></label>)}
            {selShape?.t === 'text' && (
              <div className="dz-split">
                <button className="dz-b" onClick={() => { snapshot(); patch(selShape.id, { size: Math.round(selShape.size * 0.85) }); }}>A −</button>
                <button className="dz-b" onClick={() => { snapshot(); patch(selShape.id, { size: Math.round(selShape.size * 1.15) }); }}>A +</button>
              </div>)}
            {selShape && (
              <div className="dz-split">
                <button className="dz-b" onClick={dup}>Duplicate</button>
                <button className="dz-b danger" onClick={del}>Delete</button>
              </div>)}
          </section>

          <section className="dz-card">
            <h3>Glass &amp; frame</h3>
            <div className="dz-spec">
              <label className="dz-f"><span>Glass thickness</span>
                <select value={spec.glassMm} onChange={(e) => setSpec({ glassMm: +e.target.value })}>
                  <option value={0}>none</option>{SPEC_OPTIONS.glassMm.map((n) => <option key={n} value={n}>{n} mm</option>)}</select></label>
              <label className="dz-f"><span>Glass type</span>
                <select value={spec.glassType} onChange={(e) => setSpec({ glassType: e.target.value })}>
                  <option value="">—</option>{SPEC_OPTIONS.glassType.map((n) => <option key={n}>{n}</option>)}</select></label>
              <label className="dz-f dz-full"><span>Frame</span>
                <input list="dz-frames" value={spec.frame} placeholder="1 x 3 Tubular Frame" onChange={(e) => setSpec({ frame: e.target.value })} /></label>
              <label className="dz-f"><span>Profile wall</span>
                <select value={spec.profileMm} onChange={(e) => setSpec({ profileMm: +e.target.value })}>
                  <option value={0}>not stated</option>{SPEC_OPTIONS.profileMm.map((n) => <option key={n} value={n}>{n.toFixed(1)} mm</option>)}</select></label>
              <label className="dz-f"><span>Hardware</span>
                <input value={spec.hardware} placeholder="HA" onChange={(e) => setSpec({ hardware: e.target.value })} /></label>
              <label className="dz-f dz-full"><span>Finish</span>
                <input list="dz-finishes" value={spec.finish} placeholder="Dark Bronze, White, Analok…" onChange={(e) => setSpec({ finish: e.target.value })} /></label>
            </div>
            <datalist id="dz-frames">{SPEC_OPTIONS.frame.map((n) => <option key={n} value={n} />)}</datalist>
            <datalist id="dz-finishes">{SPEC_OPTIONS.finish.map((n) => <option key={n} value={n} />)}</datalist>
            <p className="dz-mute">You choose the glass and profile. The tool doesn't recommend thicknesses.</p>
          </section>

          <section className="dz-card">
            <h3>Description (for the quote)</h3>
            <textarea rows={4} value={design.description} placeholder="798 Sliding Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass, 1.15 x 1.50"
              onChange={(e) => setMeta({ description: e.target.value })} />
            <button className="dz-b full" onClick={() => setMeta({ description: buildDescription(design, { denom }) })}>Write it for me</button>
          </section>

          <section className="dz-card">
            <h3>Finished?</h3>
            <label className="dz-chk"><input type="checkbox" checked={dimsOn} onChange={(e) => setDimsOn(e.target.checked)} /> Add width × height labels</label>
            <div className="dz-split">
              <button className="dz-b pri" onClick={exportPng}>Download PNG</button>
              <button className="dz-b" onClick={exportSvg}>Download SVG</button>
            </div>
            {onUseInQuote && <button className="dz-b pri full" onClick={useInQuote}>Use in quote</button>}
            <p className="dz-mute">Saving or downloading creates an Open Product at the beginning of Choose Product, in this Library, and in Admin Products.</p>
          </section>
        </aside>
      </div>

      </div>
      {lib && (
        <div className="dz-modal" onClick={() => setLib(null)}>
          <div className="dz-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="dz-sheet-h"><h3>Design library</h3><button className="dz-b" onClick={() => setLib(null)}>Close</button></div>
            {lib.length === 0 && <p className="dz-mute">No saved designs yet. Draw one and tap Save.</p>}
            <div className="dz-lib">
              {lib.map((d) => (
                <div key={d.id} className="dz-li">
                  <div className="dz-li-t" dangerouslySetInnerHTML={{ __html: designToSvg(d, { px: 150, style: 'invoice', tone: d.section === 'Doors' ? 'grey' : 'blue', sw: 2 }) }} />
                  <div className="dz-li-i"><b>{d.code ? d.code + ' · ' : ''}{d.name || 'Untitled'}</b><span>{[d.type, d.series].filter(Boolean).join(' · ') || d.section}</span><span>{formatLength(d.widthMm, d.unit ?? 'm')} × {formatLength(d.heightMm, d.unit ?? 'm')}{(d.unit ?? 'm') === 'm' ? ' m' : ''}</span></div>
                  <div className="dz-li-a"><button className="dz-b pri" onClick={() => openDesign(d)}>Open</button><button className="dz-b" onClick={() => libDup(d)}>Copy</button><button className="dz-b danger" onClick={() => libDelete(d.id)}>Delete</button></div>
                </div>))}
            </div>
          </div>
        </div>)}
      {toast && <div className="dz-toast" role="status">{toast}</div>}
    </div>
  );
}

const CSS = `
.dz{--blue:#0F4C81;--ink:#082a47;--paper:#f3f1ea;--card:#fff;--rule:rgba(8,42,71,.18);--mute:#5a6b7c;
 font-family:'Hanken Grotesk','Helvetica Neue',Arial,sans-serif;color:var(--ink);background:var(--paper);min-height:100%;box-sizing:border-box}
.dz-in{padding:14px;max-width:1500px;margin:0 auto}
.dz *{box-sizing:border-box}
.dz button{font:inherit;cursor:pointer}
.dz-brand{background:#fff;border-bottom:3px solid var(--blue);box-shadow:0 6px 24px rgba(8,42,71,.10)}
.dz-brand-in{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 14px;min-height:84px;max-width:1500px;margin:0 auto}
.dz-logo{display:flex;align-items:center;gap:14px;text-decoration:none}
.dz-icon{height:62px;width:auto;display:block}
.dz-wm{display:flex;flex-direction:column;line-height:1}
.dz-wm-t{font-family:'Bodoni Moda',Georgia,serif;font-weight:600;font-size:1.7rem;letter-spacing:.3em;color:var(--blue)}
.dz-wm-b{margin-top:6px;background:var(--blue);color:#fff;font-family:'Bodoni Moda',Georgia,serif;font-weight:600;font-size:.6rem;letter-spacing:.46em;text-align:center;padding:5px 4px 5px calc(4px + .46em)}
.dz-title{text-align:right}
.dz-foot{background:#fff;border-top:3px solid var(--blue);margin-top:24px}
.dz-foot-in{display:flex;align-items:center;justify-content:space-between;gap:16px 28px;flex-wrap:wrap;padding:16px 14px;max-width:1500px;margin:0 auto}
.dz-foot-in img{height:58px;width:auto;display:block}
.dz-foot-t{display:flex;flex-direction:column;gap:2px;text-align:right;font-size:.86rem;color:var(--ink)}
.dz-foot-t span:last-child{color:var(--mute)}
.dz .dz-num input.bad{border-color:#a4262c;background:#fdf1f1}
.dz-unit{flex:0 1 130px}
.dz-spec{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dz-spec .dz-full{grid-column:1/-1}
.dz-chk{display:flex;align-items:center;gap:8px;font-size:.9rem;margin-bottom:4px}
.dz .dz-chk input{width:auto;padding:0;flex:0 0 auto}
.dz-sel{flex:1 1 150px}
.dz-t em b{color:var(--blue)}
.dz-top{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.dz-top .dz-meta{align-items:flex-end;flex:0 0 auto}
.dz-top .dz-meta .dz-acts{margin-left:auto}
.dz-title b{display:block;font-family:'Bodoni Moda',Georgia,serif;font-size:1.35rem;letter-spacing:.02em;line-height:1.1}
.dz-title span{font:500 .68rem 'DM Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.dz-meta{display:flex;flex-wrap:wrap;gap:10px;flex:1 1 420px}
.dz-f{display:flex;flex-direction:column;gap:3px;min-width:0}
.dz-f>span{font:500 .62rem 'DM Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.dz input,.dz select,.dz textarea{font:inherit;font-size:16px;color:var(--ink);background:#fff;border:1px solid var(--ink);padding:9px 10px;border-radius:0;width:100%}
.dz textarea{resize:vertical}
.dz-wide{flex:2 1 200px}.dz-code{flex:0 1 90px}.dz-num{flex:0 1 130px}.dz-grid{margin-left:auto;flex:0 0 100px}
.dz-acts{display:flex;flex-wrap:wrap;gap:8px}
.dz-b{background:#fff;color:var(--ink);border:1px solid var(--ink);padding:10px 14px;font-size:.88rem;font-weight:500;min-height:42px;transition:.15s}
.dz-b:hover:not(:disabled){background:var(--ink);color:#fff}
.dz-b:disabled{opacity:.4;cursor:default}
.dz-b.pri{background:var(--blue);border-color:var(--blue);color:#fff}
.dz-b.pri:hover:not(:disabled){background:var(--ink)}
.dz-b.danger{color:#a4262c;border-color:#a4262c}.dz-b.danger:hover{background:#a4262c;color:#fff}
.dz-b.full{width:100%;margin-top:10px}
.dz-body{display:grid;grid-template-columns:250px minmax(0,1fr) 290px;gap:16px;align-items:start}
.dz-card{background:var(--card);border:1px solid var(--ink);padding:14px;margin-bottom:14px}
.dz-card h3{margin:0 0 12px;font:500 .7rem 'DM Mono',ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--blue)}
.dz-mute{color:var(--mute);font-size:.86rem;margin:8px 0 0;line-height:1.45}
.dz-tpl{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dz-t{background:#fff;border:1px solid var(--rule);padding:6px 6px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--ink)}
.dz-t:hover{border-color:var(--blue);box-shadow:3px 3px 0 var(--blue)}
.dz-t span{display:block;width:100%;height:76px}.dz-t span svg{width:100%;height:100%;display:block}
.dz-t em{font-style:normal;font-size:.72rem;line-height:1.2;text-align:center}
.dz-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:10px}
.dz-tool{background:#fff;border:1px solid var(--ink);padding:8px 12px;min-height:44px;min-width:60px;display:flex;flex-direction:column;align-items:center;gap:0;font-size:.74rem;color:var(--ink)}
.dz-tool i{font-style:normal;font-size:1.15rem;line-height:1.1}
.dz-tool.on{background:var(--blue);border-color:var(--blue);color:#fff}
.dz-canvas{background:#fff;border:1px solid var(--ink);box-shadow:8px 8px 0 var(--blue);max-height:calc(100vh - 230px);display:flex;justify-content:center}
.dz-canvas svg{display:block;width:100%;height:auto;max-height:calc(100vh - 232px)}
.dz-hint{font-size:.82rem;color:var(--mute);margin:16px 0 0}
.dz-syms{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.dz-sym{background:#fff;border:1px solid var(--rule);padding:6px;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--ink)}
.dz-sym svg{width:38px;height:38px}
.dz-sym em{font-style:normal;font-size:.66rem}
.dz-sym.on{border-color:var(--blue);background:rgba(15,76,129,.1);box-shadow:inset 0 0 0 1px var(--blue)}
.dz-split{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:12px}
.dz-split .dz-f{flex:1 1 100%}.dz-split .dz-b{flex:1}
.dz-modal{position:fixed;inset:0;background:rgba(6,20,34,.7);display:flex;align-items:flex-end;justify-content:center;z-index:50;padding:0}
.dz-sheet{background:var(--paper);border:1px solid var(--ink);width:100%;max-width:820px;max-height:88vh;overflow:auto;padding:16px}
.dz-sheet-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.dz-sheet-h h3{margin:0;font-family:'Bodoni Moda',Georgia,serif;font-size:1.4rem}
.dz-lib{display:grid;gap:10px}
.dz-li{background:#fff;border:1px solid var(--ink);padding:10px;display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center}
.dz-li-t svg{width:100%;height:auto;max-height:90px}
.dz-li-i b{display:block}.dz-li-i span{color:var(--mute);font-size:.84rem}
.dz-li-a{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.dz-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:12px 20px;z-index:60;font-size:.9rem}
@media(min-width:721px){.dz-modal{align-items:center;padding:20px}}
@media(max-width:1020px){
 .dz-body{grid-template-columns:1fr;gap:12px}
 .dz-left{order:1;display:flex;gap:12px;overflow-x:auto;padding-bottom:4px}
 .dz-left .dz-card{flex:0 0 auto;margin:0;min-width:0}
 .dz-tpl{display:flex;gap:8px}.dz-t{flex:0 0 104px}
 .dz-stage{order:2}.dz-right{order:3}
 .dz-canvas{max-height:none}.dz-canvas svg{max-height:62vh}
}
@media(max-width:720px){
 .dz-in{padding:10px}
 .dz-icon{height:46px}.dz-wm-t{font-size:1.15rem}.dz-wm-b{font-size:.48rem}.dz-brand-in{min-height:68px}
 .dz-foot-t{text-align:left}
 .dz-title b{display:none}
 .dz-top .dz-meta .dz-acts{margin-left:0;width:100%}
 .dz-li{grid-template-columns:90px 1fr}.dz-li-a{grid-column:1/-1;justify-content:flex-start}
 .dz-tool{flex:1 1 0;min-width:52px;padding:8px 4px}
 .dz-grid{margin-left:0;flex:1 0 100%}
 .dz-acts .dz-b{flex:1 1 auto;padding:10px 8px}
}
`;
