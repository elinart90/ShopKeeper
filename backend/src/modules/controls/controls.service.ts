import { supabase } from '../../config/supabase';
import { getDefaultPermissionsForRole } from '../../middleware/requirePermission';
import { logAuditAction } from './audit';
import { logger } from '../../utils/logger';

function isMissingControlsTables(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  if (code === '42P01') return true;
  return (
    message.includes('relation') &&
    (
      message.includes('shift_sessions') ||
      message.includes('cash_discrepancies') ||
      message.includes('audit_logs') ||
      message.includes('staff_permissions')
    )
  );
}

export class ControlsService {
  async startShift(shopId: string, userId: string, openingCash: number, notes?: string) {
    const { data: existingOpen } = await supabase
      .from('shift_sessions')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .eq('status', 'open')
      .maybeSingle();
    if (existingOpen?.id) {
      throw new Error('You already have an open shift');
    }

    const { data: shift, error } = await supabase
      .from('shift_sessions')
      .insert({
        shop_id: shopId,
        user_id: userId,
        opening_cash: Number(openingCash || 0),
        notes: notes?.trim() || null,
        status: 'open',
      })
      .select('*')
      .single();
    if (error || !shift) throw new Error('Failed to start shift');

    await logAuditAction({
      shopId,
      userId,
      action: 'shift.start',
      entityType: 'shift_session',
      entityId: shift.id,
      after: shift,
    });
    return shift;
  }

  async endShift(shopId: string, userId: string, shiftId: string, closingCash: number, notes?: string) {
    const { data: shift, error: shiftError } = await supabase
      .from('shift_sessions')
      .select('*')
      .eq('id', shiftId)
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .eq('status', 'open')
      .single();
    if (shiftError || !shift) throw new Error('Open shift not found');

    const startedAt = String(shift.started_at);
    const { data: cashSales } = await supabase
      .from('sales')
      .select('final_amount')
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .eq('created_by', userId)
      .eq('payment_method', 'cash')
      .gte('created_at', startedAt);

    const cashTotal = (cashSales || []).reduce((sum: number, s: any) => sum + Number(s.final_amount || 0), 0);
    const expectedCash = Number(shift.opening_cash || 0) + cashTotal;
    const closedCash = Number(closingCash || 0);
    const discrepancy = Number((closedCash - expectedCash).toFixed(2));
    const endedAt = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('shift_sessions')
      .update({
        ended_at: endedAt,
        expected_cash: expectedCash,
        closing_cash: closedCash,
        discrepancy,
        notes: notes?.trim() || shift.notes || null,
        status: 'closed',
        updated_at: endedAt,
      })
      .eq('id', shiftId)
      .select('*')
      .single();
    if (error || !updated) throw new Error('Failed to end shift');

    let discrepancyRow: any = null;
    if (Math.abs(discrepancy) > 0.009) {
      const { data: row } = await supabase
        .from('cash_discrepancies')
        .insert({
          shop_id: shopId,
          shift_id: shiftId,
          user_id: userId,
          amount: discrepancy,
          reason: notes?.trim() || null,
          status: 'open',
        })
        .select('*')
        .single();
      discrepancyRow = row || null;
    }

    await logAuditAction({
      shopId,
      userId,
      action: 'shift.end',
      entityType: 'shift_session',
      entityId: shiftId,
      before: shift,
      after: updated,
      metadata: { expectedCash, closingCash: closedCash, discrepancy },
    });

    return { shift: updated, discrepancy: discrepancyRow };
  }

  async listShifts(shopId: string, opts?: { userId?: string; status?: string; limit?: number }) {
    let query = supabase
      .from('shift_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .order('started_at', { ascending: false })
      .limit(Number(opts?.limit || 50));

    if (opts?.userId) query = query.eq('user_id', opts.userId);
    if (opts?.status) query = query.eq('status', opts.status);

    const { data, error } = await query;
    if (error) {
      if (isMissingControlsTables(error)) {
        logger.warn('Staff controls tables missing. Run migration 011_staff_controls.sql');
        return [];
      }
      logger.error('listShifts query failed (fallback to empty):', error);
      return [];
    }
    return data || [];
  }

  async listDiscrepancies(shopId: string, status?: string) {
    let query = supabase
      .from('cash_discrepancies')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      if (isMissingControlsTables(error)) {
        logger.warn('Staff controls tables missing. Run migration 011_staff_controls.sql');
        return [];
      }
      logger.error('listDiscrepancies query failed (fallback to empty):', error);
      return [];
    }
    return data || [];
  }

  async reviewDiscrepancy(
    shopId: string,
    reviewerUserId: string,
    discrepancyId: string,
    status: 'approved' | 'rejected',
    reason?: string
  ) {
    const now = new Date().toISOString();
    const { data: row, error } = await supabase
      .from('cash_discrepancies')
      .update({
        status,
        reason: reason?.trim() || null,
        reviewed_by: reviewerUserId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', discrepancyId)
      .eq('shop_id', shopId)
      .select('*')
      .single();
    if (error || !row) throw new Error('Failed to review discrepancy');

    await logAuditAction({
      shopId,
      userId: reviewerUserId,
      action: 'cash_discrepancy.review',
      entityType: 'cash_discrepancy',
      entityId: discrepancyId,
      after: row,
    });
    return row;
  }

  async listAuditLogs(shopId: string, opts?: { userId?: string; action?: string; limit?: number }) {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(Number(opts?.limit || 100));
    if (opts?.userId) query = query.eq('user_id', opts.userId);
    if (opts?.action) query = query.ilike('action', `%${opts.action}%`);
    const { data, error } = await query;
    if (error) {
      if (isMissingControlsTables(error)) {
        logger.warn('Staff controls tables missing. Run migration 011_staff_controls.sql');
        return [];
      }
      logger.error('listAuditLogs query failed (fallback to empty):', error);
      return [];
    }
    return data || [];
  }

  async getPermissions(shopId: string, userId: string, role?: string) {
    const defaults = getDefaultPermissionsForRole(role);
    const { data, error } = await supabase
      .from('staff_permissions')
      .select('permission_key, allowed')
      .eq('shop_id', shopId)
      .eq('user_id', userId);
    if (error) {
      if (isMissingControlsTables(error)) {
        logger.warn('Staff controls tables missing. Run migration 011_staff_controls.sql');
        return { defaults, overrides: {} };
      }
      logger.error('getPermissions query failed (fallback to defaults):', error);
      return { defaults, overrides: {} };
    }
    const overrides = (data || []).reduce((acc: Record<string, boolean>, row: any) => {
      acc[String(row.permission_key)] = !!row.allowed;
      return acc;
    }, {});
    return { defaults, overrides };
  }

  async setPermissions(
    shopId: string,
    targetUserId: string,
    updatedBy: string,
    entries: Array<{ permissionKey: string; allowed: boolean }>
  ) {
    const now = new Date().toISOString();
    const rows = entries.map((e) => ({
      shop_id: shopId,
      user_id: targetUserId,
      permission_key: e.permissionKey,
      allowed: !!e.allowed,
      updated_by: updatedBy,
      updated_at: now,
    }));
    if (rows.length > 0) {
      const { error } = await supabase
        .from('staff_permissions')
        .upsert(rows, { onConflict: 'shop_id,user_id,permission_key' });
      if (error) throw new Error('Failed to save permissions');
    }

    await logAuditAction({
      shopId,
      userId: updatedBy,
      action: 'permissions.update',
      entityType: 'staff_permission',
      entityId: targetUserId,
      metadata: { entries: rows.length },
      after: rows,
    });
    return { updated: true };
  }
}
