import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addToCart: (productId: string, name: string, price: number, imageUrl?: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

function emitToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      addToCart: (productId, name, price, imageUrl) => {
        const items = get().items;
        const existing = items.find(item => item.productId === productId);
        
        if (existing) {
          set({
            items: items.map(item =>
              item.productId === productId
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          });
          emitToast(`${name} quantity updated in cart`, 'success');
        } else {
          set({
            items: [...items, { productId, name, price, imageUrl, quantity: 1 }]
          });
          emitToast(`${name} added to cart`, 'success');
        }
      },
      
      removeFromCart: (productId) => {
        set({ items: get().items.filter(item => item.productId !== productId) });
      },
      
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(productId);
          return;
        }
        set({
          items: get().items.map(item =>
            item.productId === productId ? { ...item, quantity } : item
          )
        });
      },
      
      clearCart: () => set({ items: [] }),
      
      getTotal: () => {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },
      
      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      }
    }),
    {
      name: 'paint-sip-cart'
    }
  )
);
