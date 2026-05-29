import { supabase } from './supabase';

function getActorName(user: { id: string; email?: string; user_metadata?: { name?: string; full_name?: string } } | null) {
  if (!user) return 'System';
  return user.user_metadata?.name || user.user_metadata?.full_name || user.email || user.id;
}

export async function logActivity(params: {
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const actorName = getActorName(user);

    await supabase.from('activity_log').insert({
      actor_id: user?.id || null,
      actor_name: actorName,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      entity_name: params.entityName || null,
      details: params.details || {},
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}
