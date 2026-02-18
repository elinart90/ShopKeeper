import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

export async function logAuditAction(input: {
  shopId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from('audit_logs').insert({
      shop_id: input.shopId,
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      before_json: input.before ?? null,
      after_json: input.after ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    logger.warn('Audit log insert failed (non-blocking):', error);
  }
}
