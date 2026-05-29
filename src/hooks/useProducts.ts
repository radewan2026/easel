import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Product, ProductCategory, ProductOrder } from '../types/database';
import { logActivity } from '../lib/activityLog';

export function useProducts(filters?: { categoryId?: string; active?: boolean }) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, category:product_categories(*)')
        .order('name', { ascending: true });

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.active !== undefined) {
        query = query.eq('is_active', filters.active);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('products')
        .select('*, category:product_categories(*)')
        .eq('slug', slug)
        .single();
      if (error) return null;
      return data as Product;
    },
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as ProductCategory[];
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (product: Partial<Product>) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => {
      logActivity({ action: 'product.created', entityType: 'product' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...product }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update({ ...product, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: (_, variables) => {
      logActivity({ action: 'product.updated', entityType: 'product', entityId: variables.id, entityName: variables.name });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.slug] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      logActivity({ action: 'product.deleted', entityType: 'product' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCreateProductCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Partial<ProductCategory>) => {
      const { data, error } = await supabase
        .from('product_categories')
        .insert(category)
        .select()
        .single();
      if (error) throw error;
      return data as ProductCategory;
    },
    onSuccess: () => {
      logActivity({ action: 'product.category.created', entityType: 'product_category' });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
  });
}

export function useDeleteProductCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      logActivity({ action: 'product.category.deleted', entityType: 'product_category' });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
  });
}

export function useProductOrders() {
  return useQuery({
    queryKey: ['product-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_orders')
        .select('*, product:products(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProductOrder[];
    },
  });
}

export function useCreateProductOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: Partial<ProductOrder>) => {
      const { data, error } = await supabase
        .from('product_orders')
        .insert(order)
        .select()
        .single();
      if (error) throw error;
      return data as ProductOrder;
    },
    onSuccess: (_, order) => {
      logActivity({
        action: 'product.order.created',
        entityType: 'product_order',
        entityName: order.purchaser_name,
        details: {
          email: order.purchaser_email,
          productId: order.product_id,
          quantity: order.quantity,
          total: order.total_price,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['product-orders'] });
    },
  });
}

export function useUpdateProductOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('product_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ProductOrder;
    },
    onSuccess: () => {
      logActivity({ action: 'product.order.updated', entityType: 'product_order' });
      queryClient.invalidateQueries({ queryKey: ['product-orders'] });
    },
  });
}
