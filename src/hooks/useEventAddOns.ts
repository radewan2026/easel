import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../types/database';

export interface EventAddOn {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  enabled: boolean;
  perSeat: boolean;
  maxQuantity: number;
  stock: number;
}

const EVENT_ADD_ONS_PREFIX = 'easel_event_add_ons';

function storageKey(eventSlug: string) {
  return `${EVENT_ADD_ONS_PREFIX}:${eventSlug}`;
}

function readStoredAddOns(eventSlug: string): EventAddOn[] {
  if (!eventSlug || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(eventSlug));
    return raw ? JSON.parse(raw) as EventAddOn[] : [];
  } catch {
    return [];
  }
}

function writeStoredAddOns(eventSlug: string, addOns: EventAddOn[]) {
  if (!eventSlug || typeof window === 'undefined') return;
  localStorage.setItem(storageKey(eventSlug), JSON.stringify(addOns));
}

export function mergeProductAddOns(products: Product[] = [], stored: EventAddOn[] = []) {
  const storedById = new Map(stored.map((addOn) => [addOn.productId, addOn]));

  return products.map((product) => {
    const existing = storedById.get(product.id);
    return {
      productId: product.id,
      name: product.name,
      price: existing?.price ?? product.price,
      imageUrl: product.image_url,
      enabled: existing?.enabled ?? false,
      perSeat: existing?.perSeat ?? false,
      maxQuantity: existing?.maxQuantity ?? Math.max(1, Math.min(product.stock || 12, 12)),
      stock: product.stock,
    };
  });
}

export function useEventAddOns(eventSlug: string, products: Product[] = []) {
  const [storedAddOns, setStoredAddOns] = useState<EventAddOn[]>(() => readStoredAddOns(eventSlug));

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setStoredAddOns(readStoredAddOns(eventSlug));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [eventSlug]);

  const addOns = useMemo(() => mergeProductAddOns(products, storedAddOns), [products, storedAddOns]);
  const enabledAddOns = useMemo(() => addOns.filter((addOn) => addOn.enabled), [addOns]);

  const saveAddOns = (next: EventAddOn[]) => {
    setStoredAddOns(next);
    writeStoredAddOns(eventSlug, next);
  };

  const updateAddOn = (productId: string, patch: Partial<EventAddOn>) => {
    const next = addOns.map((addOn) => addOn.productId === productId ? { ...addOn, ...patch } : addOn);
    saveAddOns(next);
  };

  return {
    addOns,
    enabledAddOns,
    saveAddOns,
    updateAddOn,
  };
}
