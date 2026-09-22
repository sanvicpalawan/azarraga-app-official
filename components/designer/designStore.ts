import type { Design } from './designer-core';

export interface DesignStore {
  list(): Promise<Design[]>;
  save(d: Design): Promise<void>;
  publish?(d: Design, imageDataUrl: string): Promise<{ productId: number; productKey: string }>;
  remove(id: string): Promise<void>;
}

const KEY = 'azarraga.designs.v1';

/** Browser-only store: works with zero setup (good for prototyping). */
export const localStore: DesignStore = {
  async list() {
    try { return (JSON.parse(localStorage.getItem(KEY) || '[]') as Design[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
    catch { return []; }
  },
  async save(d) {
    const all = (await localStore.list()).filter((x) => x.id !== d.id);
    localStorage.setItem(KEY, JSON.stringify([d, ...all]));
  },
  async remove(id) {
    const all = (await localStore.list()).filter((x) => x.id !== id);
    localStorage.setItem(KEY, JSON.stringify(all));
  },
};

/** Neon-backed store exposed through the app's Next.js API routes. */
export const apiStore: DesignStore = {
  async list() {
    const response = await fetch('/api/designs', { cache: 'no-store' });
    const payload = (await response.json()) as { designs?: Design[]; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Could not load designs.');
    return payload.designs ?? [];
  },
  async save(design) {
    const response = await fetch('/api/designs', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(design),
    });
    if (!response.ok) throw new Error('Could not save design.');
  },
  async publish(design, imageDataUrl) {
    const response = await fetch('/api/designs/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ design, imageDataUrl }),
    });
    const payload = (await response.json()) as { productId?: number; productKey?: string; error?: string };
    if (!response.ok || !payload.productId || !payload.productKey) {
      throw new Error(payload.error || 'Could not save open product.');
    }
    return { productId: payload.productId, productKey: payload.productKey };
  },
  async remove(id) {
    const response = await fetch(`/api/designs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Could not delete design.');
  },
};
