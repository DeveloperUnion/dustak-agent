import type { Slots, Item, ItemProviderAssignment } from './types';

/**
 * LLM が返す slotPatch を現在の slots に深くマージする。
 *
 * 配列（items / providerAssignments）は **id をキーに upsert**。
 * - 既存 id があれば差分マージ
 * - 新規 id なら追加
 * これにより LLM は毎ターン全配列を再生成せず、差分だけ返せばよい。
 */
export type SlotPatch = {
  occupation?: string;
  location?: Partial<Slots['location']>;
  items?: Array<Partial<Item> & { id: string }>;
  providerAssignments?: Array<Partial<ItemProviderAssignment> & { itemId: string }>;
  requester?: Partial<Slots['requester']>;
  meta?: Partial<Slots['meta']>;
};

export function applySlotPatch(slots: Slots, patch: SlotPatch | undefined | null): Slots {
  if (!patch) return slots;

  const next: Slots = {
    ...slots,
    occupation: patch.occupation ?? slots.occupation,
    location: { ...slots.location, ...(patch.location ?? {}) },
    requester: { ...slots.requester, ...(patch.requester ?? {}) },
    items: [...slots.items],
    providerAssignments: [...slots.providerAssignments],
    meta: { ...slots.meta, ...(patch.meta ?? {}) },
  };

  if (patch.items) {
    for (const p of patch.items) {
      const idx = next.items.findIndex((i) => i.id === p.id);
      if (idx >= 0) {
        next.items[idx] = { ...next.items[idx], ...p };
      } else {
        next.items.push({ label: '', ...p });
      }
    }
  }

  if (patch.providerAssignments) {
    for (const p of patch.providerAssignments) {
      const idx = next.providerAssignments.findIndex((a) => a.itemId === p.itemId);
      if (idx >= 0) {
        next.providerAssignments[idx] = { ...next.providerAssignments[idx], ...p };
      } else {
        next.providerAssignments.push({ ...p });
      }
    }
  }

  return next;
}
