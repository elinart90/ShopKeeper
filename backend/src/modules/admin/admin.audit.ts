import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

type JsonObject = Record<string, unknown>;

export interface AdminAuditInput {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeJson?: JsonObject | null;
  afterJson?: JsonObject | null;
  metadataJson?: JsonObject | null;
}

export async function writeAdminAuditLog(input: AdminAuditInput): Promise<void> {
  const payload = {
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    before_json: input.beforeJson || null,
    after_json: input.afterJson || null,
    metadata_json: input.metadataJson || null,
  };

  const { error } = await supabase.from('admin_audit_logs').insert(payload);
  if (error) {
    logger.error('Failed to write admin audit log:', error);
  }
}
