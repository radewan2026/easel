import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { BlogPost, BlogCategory } from '../types/database';

export function useBlogPosts(filters?: { categoryId?: string; published?: boolean }) {
  return useQuery({
    queryKey: ['blogPosts', filters],
    queryFn: async () => {
      let query = supabase
        .from('blog_posts')
        .select('*')
        .order('published_at', { ascending: false });

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.published !== undefined) {
        query = query.eq('is_published', filters.published);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BlogPost[];
    },
    staleTime: 0,
  });
}

export function useBlogPost(slug: string) {
  return useQuery({
    queryKey: ['blogPost', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .single();
      if (error) {
        console.error('useBlogPost error:', error);
        return null;
      }
      return data as BlogPost;
    },
    staleTime: 0,
  });
}

export function useBlogCategories() {
  return useQuery({
    queryKey: ['blogCategories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as BlogCategory[];
    },
  });
}

export function useCreateBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: Partial<BlogPost>) => {
      const { data, error } = await supabase.from('blog_posts').insert(post).select().single();
      if (error) throw error;
      return data as BlogPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
    },
  });
}

export function useUpdateBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...post }: Partial<BlogPost> & { id: string }) => {
      const { data, error } = await supabase
        .from('blog_posts')
        .update(post)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as BlogPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
    },
  });
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
    },
  });
}

export function useTrashBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_posts').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
      queryClient.invalidateQueries({ queryKey: ['trashedBlogPosts'] });
    },
  });
}

export function useRestoreBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_posts').update({ is_deleted: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
      queryClient.invalidateQueries({ queryKey: ['trashedBlogPosts'] });
    },
  });
}

export function usePermanentDeleteBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trashedBlogPosts'] });
    },
  });
}

export function useTrashedBlogPosts() {
  return useQuery({
    queryKey: ['trashedBlogPosts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as BlogPost[];
    },
  });
}

export function useCreateBlogCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Partial<BlogCategory>) => {
      const { data, error } = await supabase.from('blog_categories').insert(category).select().single();
      if (error) throw error;
      return data as BlogCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogCategories'] });
    },
  });
}

export function useUpdateBlogCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...category }: Partial<BlogCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('blog_categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as BlogCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogCategories'] });
    },
  });
}

export function useDeleteBlogCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogCategories'] });
    },
  });
}