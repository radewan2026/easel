import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Gallery, GalleryCategory, GalleryImage } from '../types/database';

export function useGalleries() {
  return useQuery({
    queryKey: ['galleries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('galleries')
        .select('*, images:gallery_images(*), category:gallery_categories(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Gallery[];
    },
  });
}

export function useGalleryCategories() {
  return useQuery({
    queryKey: ['galleryCategories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gallery_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as GalleryCategory[];
    },
  });
}

export function useCreateGallery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gallery: Partial<Gallery>) => {
      const { data, error } = await supabase
        .from('galleries')
        .insert(gallery)
        .select()
        .single();
      if (error) throw error;
      return data as Gallery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}

export function useUpdateGallery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...gallery }: Partial<Gallery> & { id: string }) => {
      const { data, error } = await supabase
        .from('galleries')
        .update(gallery)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Gallery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}

export function useDeleteGallery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('gallery_images').delete().eq('gallery_id', id);
      const { error } = await supabase.from('galleries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}

export function useTrashGallery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('galleries').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
      queryClient.invalidateQueries({ queryKey: ['trashedGalleries'] });
    },
  });
}

export function useRestoreGallery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('galleries').update({ is_deleted: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
      queryClient.invalidateQueries({ queryKey: ['trashedGalleries'] });
    },
  });
}

export function usePermanentDeleteGallery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('gallery_images').delete().eq('gallery_id', id);
      const { error } = await supabase.from('galleries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trashedGalleries'] });
    },
  });
}

export function useTrashedGalleries() {
  return useQuery({
    queryKey: ['trashedGalleries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('galleries')
        .select('*, images:gallery_images(*), category:gallery_categories(*)')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Gallery[];
    },
  });
}

export function useCreateGalleryCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Partial<GalleryCategory>) => {
      const { data, error } = await supabase
        .from('gallery_categories')
        .insert(category)
        .select()
        .single();
      if (error) throw error;
      return data as GalleryCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleryCategories'] });
    },
  });
}

export function useUpdateGalleryCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...category }: Partial<GalleryCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('gallery_categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as GalleryCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleryCategories'] });
    },
  });
}

export function useDeleteGalleryCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('galleries').update({ category_id: null }).eq('category_id', id);
      const { error } = await supabase.from('gallery_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleryCategories'] });
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}

export function useAddGalleryImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (image: Partial<GalleryImage>) => {
      const { data, error } = await supabase
        .from('gallery_images')
        .insert(image)
        .select()
        .single();
      if (error) throw error;
      return data as GalleryImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}

export function useUpdateGalleryImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...image }: Partial<GalleryImage> & { id: string }) => {
      const { data, error } = await supabase
        .from('gallery_images')
        .update(image)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as GalleryImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}

export function useDeleteGalleryImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gallery_images').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}

export function useSetDefaultImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ galleryId, imageUrl }: { galleryId: string; imageUrl: string }) => {
      const { data, error } = await supabase
        .from('galleries')
        .update({ default_image_url: imageUrl })
        .eq('id', galleryId)
        .select()
        .single();
      if (error) throw error;
      return data as Gallery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}