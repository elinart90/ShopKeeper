import { supabase } from '../../config/supabase';
import { env } from '../../config/env';
import { getDefaultPermissionsForRole } from '../../middleware/requirePermission';
import { logAuditAction } from './audit';
import { logger } from '../../utils/logger';
import { InventoryService } from '../inventory/inventory.service';
import { ReportsService } from '../reports/reports.service';
import { MembersService } from '../members/members.service';
import { sendGenericEmail } from '../../utils/email';

const inventoryService = new InventoryService();
const reportsService = new ReportsService();
const membersService = new MembersService();

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
      message.includes('staff_permissions') ||
      message.includes('stock_snapshots') ||
      message.includes('stock_snapshot_items') ||
      message.includes('stock_movements') ||
      message.includes('stock_variances') ||
      message.includes('stock_count_sessions') ||
      message.includes('stock_count_items') ||
      message.includes('stock_locations') ||
      message.includes('stock_location_balances') ||
      message.includes('stock_transfers') ||
      message.includes('supplier_deliveries') ||
      message.includes('purchase_plans') ||
      message.includes('purchase_plan_items')
    )
  );
}

const STOCK_REASON_CODES = {
  operational: ['counting_error', 'system_error', 'transfer'],
  shrinkage: ['customer_theft', 'employee_theft_suspected', 'supplier_shortage'],
  waste: ['damaged_goods', 'expired_products', 'quality_issue'],
  other: ['opening_stock_adjustment', 'returned_to_supplier'],
} as const;

const ALLOWED_STOCK_REASON_CODES: Set<string> = new Set(
  Object.values(STOCK_REASON_CODES).flat().map((v) => String(v))
);

function getPeriodKey(periodType: 'daily' | 'weekly' | 'monthly', now = new Date()) {
  const dateUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (periodType === 'daily') return dateUtc.toISOString().slice(0, 10);
  if (periodType === 'monthly') return dateUtc.toISOString().slice(0, 7);

  const day = dateUtc.getUTCDay() || 7;
  dateUtc.setUTCDate(dateUtc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dateUtc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dateUtc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${dateUtc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getVariancePercent(expectedQty: number, varianceQty: number) {
  if (expectedQty === 0) return varianceQty === 0 ? 0 : 100;
  return Math.abs((varianceQty / expectedQty) * 100);
}

function classifyVarianceSeverity(variancePercent: number, varianceValueAbs: number) {
  if (variancePercent > 10 || varianceValueAbs > 500) return 'severe';
  if (variancePercent > 5 || varianceValueAbs > 100) return 'critical';
  if (variancePercent >= 2 || varianceValueAbs >= 20) return 'moderate';
  return 'minor';
}

function resolveApprovalLevel(varianceQtyAbs: number, varianceValueAbs: number) {
  if (varianceQtyAbs < 2 || varianceValueAbs < 20) return 'auto' as const;
  if (varianceQtyAbs >= 10 || varianceValueAbs > 200) return 'owner' as const;
  return 'supervisor' as const;
}

function shouldRequireTwoPersonVerification(sellingPrice: number, costPrice: number) {
  return Number(sellingPrice || 0) > 100 || Number(costPrice || 0) > 100;
}

export class ControlsService {
  private normalizePhoneForWhatsApp(phone?: string | null) {
    const raw = String(phone || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^\d+]/g, '');
    if (!digits) return '';
    if (digits.startsWith('+')) return digits.slice(1);
    if (digits.startsWith('233')) return digits;
    if (digits.startsWith('0')) return `233${digits.slice(1)}`;
    return digits;
  }

  private buildWhatsAppLink(phone: string | undefined, message: string) {
    const normalized = this.normalizePhoneForWhatsApp(phone || '');
    if (!normalized) return '';
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message || '')}`;
  }

  private async getShopOwnerContact(shopId: string) {
    const { data: shop, error: shopErr } = await supabase
      .from('shops')
      .select('id,name,owner_id')
      .eq('id', shopId)
      .single();
    if (shopErr || !shop?.owner_id) throw new Error('Shop owner not found');

    const { data: owner } = await supabase
      .from('users')
      .select('id,name,email')
      .eq('id', shop.owner_id)
      .maybeSingle();
    return {
      shopName: String(shop.name || 'ShopKeeper Shop'),
      ownerId: String(shop.owner_id),
      ownerName: String(owner?.name || 'Owner'),
      ownerEmail: owner?.email ? String(owner.email) : '',
      ownerPhone: '',
    };
  }

  private normalizeCurrencyText(text: string, currencyCode: string = 'GHS') {
    return String(text || '')
      .replace(/\$/g, `${currencyCode} `)
      .replace(/\bUSD\b/gi, currencyCode)
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private async callOpenAiText(prompt: string): Promise<string> {
    if (!env.openaiApiKey) throw new Error('OPENAI_API_KEY not configured');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: env.openaiModel || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are a risk and fraud analyst for retail POS systems.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`OpenAI failed (${response.status}): ${errorText.slice(0, 300)}`);
    }
    const data: any = await response.json();
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new Error('OpenAI returned empty content');
    return text;
  }

  private async callClaudeText(prompt: string): Promise<string> {
    if (!env.claudeApiKey) throw new Error('CLAUDE_API_KEY not configured');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.claudeApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.claudeModel || 'claude-3-5-sonnet-latest',
        max_tokens: 900,
        temperature: 0.2,
        system: 'You are a retail risk and fraud assistant. Be concise and practical.',
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Claude failed (${response.status}): ${errorText.slice(0, 300)}`);
    }
    const data: any = await response.json();
    const textBlock = Array.isArray(data?.content) ? data.content.find((b: any) => b?.type === 'text') : null;
    const text = String(textBlock?.text || '').trim();
    if (!text) throw new Error('Claude returned empty content');
    return text;
  }

  private async callOpenAiThenClaude(prompt: string) {
    try {
      const text = await this.callOpenAiText(prompt);
      return { provider: 'openai' as const, text };
    } catch (openErr: any) {
      logger.warn('OpenAI risk/fraud call failed; trying Claude fallback', {
        message: String(openErr?.message || openErr),
      });
      const text = await this.callClaudeText(prompt);
      return { provider: 'claude' as const, text };
    }
  }

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

  async createStockSnapshot(
    shopId: string,
    userId: string,
    input: { periodType: 'daily' | 'weekly' | 'monthly'; periodKey?: string; notes?: string }
  ) {
    const periodType = input.periodType;
    const periodKey = input.periodKey?.trim() || getPeriodKey(periodType);
    const { data: snapshot, error: snapshotError } = await supabase
      .from('stock_snapshots')
      .upsert({
        shop_id: shopId,
        period_type: periodType,
        period_key: periodKey,
        locked: true,
        notes: input.notes?.trim() || null,
        created_by: userId,
      }, { onConflict: 'shop_id,period_type,period_key' })
      .select('*')
      .single();

    if (snapshotError || !snapshot) {
      throw new Error('Failed to create stock snapshot. Ensure migration 012_stock_controls_foundation.sql is applied.');
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock_quantity, cost_price, selling_price')
      .eq('shop_id', shopId)
      .eq('is_active', true);
    if (productsError) throw new Error('Failed to read products for snapshot');

    const rows = (products || []).map((p: any) => ({
      snapshot_id: snapshot.id,
      product_id: p.id,
      product_name: p.name || 'Unnamed product',
      stock_quantity: Number(p.stock_quantity || 0),
      cost_price: Number(p.cost_price || 0),
      selling_price: Number(p.selling_price || 0),
      stock_value: Number(p.stock_quantity || 0) * Number(p.cost_price || 0),
    }));

    if (rows.length > 0) {
      const { error: itemsError } = await supabase
        .from('stock_snapshot_items')
        .upsert(rows, { onConflict: 'snapshot_id,product_id' });
      if (itemsError) throw new Error('Failed to save snapshot items');
    }

    await logAuditAction({
      shopId,
      userId,
      action: 'stock.snapshot.create',
      entityType: 'stock_snapshot',
      entityId: snapshot.id,
      metadata: { periodType, periodKey, products: rows.length },
      after: snapshot,
    });

    return { ...snapshot, itemsCount: rows.length };
  }

  async listStockSnapshots(shopId: string, limit = 20) {
    const { data, error } = await supabase
      .from('stock_snapshots')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(Number(limit || 20));

    if (error) {
      if (isMissingControlsTables(error)) {
        logger.warn('Stock controls tables missing. Run migration 012_stock_controls_foundation.sql');
        return [];
      }
      logger.error('listStockSnapshots query failed (fallback to empty):', error);
      return [];
    }
    return data || [];
  }

  async listStockMovements(shopId: string, opts?: { productId?: string; limit?: number }) {
    let query = supabase
      .from('stock_movements')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(Number(opts?.limit || 100));
    if (opts?.productId) query = query.eq('product_id', opts.productId);
    const { data, error } = await query;

    if (error) {
      if (isMissingControlsTables(error)) {
        logger.warn('Stock controls tables missing. Run migration 012_stock_controls_foundation.sql');
        return [];
      }
      logger.error('listStockMovements query failed (fallback to empty):', error);
      return [];
    }
    return data || [];
  }

  async listStockVariances(
    shopId: string,
    opts?: { status?: string; severity?: string; limit?: number }
  ) {
    let query = supabase
      .from('stock_variances')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(Number(opts?.limit || 100));
    if (opts?.status) query = query.eq('status', opts.status);
    if (opts?.severity) query = query.eq('severity', opts.severity);
    const { data, error } = await query;
    if (error) {
      if (isMissingControlsTables(error)) {
        logger.warn('Stock controls tables missing. Run migration 012_stock_controls_foundation.sql');
        return [];
      }
      logger.error('listStockVariances query failed (fallback to empty):', error);
      return [];
    }
    return data || [];
  }

  async recordStockVariance(
    shopId: string,
    userId: string,
    input: {
      productId: string;
      countedQty: number;
      expectedQty?: number;
      reasonCode: string;
      reasonNote?: string;
      evidenceUrl?: string;
    }
  ) {
    if (!ALLOWED_STOCK_REASON_CODES.has(input.reasonCode)) {
      throw new Error('Invalid reason code');
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, stock_quantity, cost_price')
      .eq('shop_id', shopId)
      .eq('id', input.productId)
      .maybeSingle();
    if (productError || !product) throw new Error('Product not found');

    const expectedQty = Number(
      Number.isFinite(input.expectedQty) ? input.expectedQty : Number(product.stock_quantity || 0)
    );
    const countedQty = Number(input.countedQty || 0);
    const varianceQty = Number((countedQty - expectedQty).toFixed(3));
    const unitCost = Number(product.cost_price || 0);
    const varianceValue = Number((varianceQty * unitCost).toFixed(2));
    const variancePercent = Number(getVariancePercent(expectedQty, varianceQty).toFixed(2));
    const varianceQtyAbs = Math.abs(varianceQty);
    const varianceValueAbs = Math.abs(varianceValue);
    const severity = classifyVarianceSeverity(variancePercent, varianceValueAbs);
    const approvalLevel = resolveApprovalLevel(varianceQtyAbs, varianceValueAbs);
    const autoApproved = approvalLevel === 'auto';

    const now = new Date().toISOString();
    const { data: row, error } = await supabase
      .from('stock_variances')
      .insert({
        shop_id: shopId,
        product_id: product.id,
        product_name: product.name || 'Unnamed product',
        expected_qty: expectedQty,
        counted_qty: countedQty,
        variance_qty: varianceQty,
        unit_cost: unitCost,
        variance_value: varianceValue,
        variance_percent: variancePercent,
        severity,
        reason_code: input.reasonCode,
        reason_note: input.reasonNote?.trim() || null,
        evidence_url: input.evidenceUrl?.trim() || null,
        status: autoApproved ? 'auto_approved' : 'pending_review',
        approval_level: approvalLevel,
        reviewed_by: autoApproved ? userId : null,
        reviewed_at: autoApproved ? now : null,
        created_by: userId,
      })
      .select('*')
      .single();
    if (error || !row) throw new Error('Failed to record stock variance');

    if (autoApproved && Math.abs(varianceQty) > 0.0001) {
      await supabase.from('stock_movements').insert({
        shop_id: shopId,
        product_id: product.id,
        product_name: product.name || 'Unnamed product',
        action: 'adjustment',
        quantity: varianceQty,
        previous_quantity: expectedQty,
        new_quantity: countedQty,
        movement_type: 'adjustment',
        quantity_before: expectedQty,
        quantity_change: varianceQty,
        quantity_after: countedQty,
        reason_code: input.reasonCode,
        reason_note: input.reasonNote?.trim() || null,
        notes: input.reasonNote?.trim() || 'Stock variance adjustment',
        reference_type: 'stock_variance',
        reference_id: row.id,
        created_by: userId,
      });
    }

    await logAuditAction({
      shopId,
      userId,
      action: 'stock.variance.record',
      entityType: 'stock_variance',
      entityId: row.id,
      after: row,
    });

    return row;
  }

  async reviewStockVariance(
    shopId: string,
    reviewerUserId: string,
    varianceId: string,
    status: 'approved' | 'rejected',
    note?: string
  ) {
    const now = new Date().toISOString();
    const { data: rowBefore, error: beforeError } = await supabase
      .from('stock_variances')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', varianceId)
      .single();
    if (beforeError || !rowBefore) throw new Error('Stock variance not found');

    const { data: row, error } = await supabase
      .from('stock_variances')
      .update({
        status,
        reason_note: note?.trim() || rowBefore.reason_note || null,
        reviewed_by: reviewerUserId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('shop_id', shopId)
      .eq('id', varianceId)
      .select('*')
      .single();
    if (error || !row) throw new Error('Failed to review stock variance');

    if (status === 'approved' && Math.abs(Number(row.variance_qty || 0)) > 0.0001) {
      const { data: existing } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('shop_id', shopId)
        .eq('reference_type', 'stock_variance')
        .eq('reference_id', varianceId)
        .maybeSingle();
      if (!existing?.id) {
        await supabase.from('stock_movements').insert({
          shop_id: shopId,
          product_id: row.product_id,
          product_name: row.product_name,
          action: 'adjustment',
          quantity: row.variance_qty,
          previous_quantity: row.expected_qty,
          new_quantity: row.counted_qty,
          movement_type: 'adjustment',
          quantity_before: row.expected_qty,
          quantity_change: row.variance_qty,
          quantity_after: row.counted_qty,
          reason_code: row.reason_code,
          reason_note: row.reason_note,
          notes: row.reason_note || 'Approved stock variance adjustment',
          reference_type: 'stock_variance',
          reference_id: row.id,
          created_by: reviewerUserId,
        });
      }
    }

    await logAuditAction({
      shopId,
      userId: reviewerUserId,
      action: 'stock.variance.review',
      entityType: 'stock_variance',
      entityId: varianceId,
      before: rowBefore,
      after: row,
    });
    return row;
  }

  getStockVarianceConfig() {
    return {
      reasonCodes: STOCK_REASON_CODES,
      thresholds: {
        autoApprove: { maxUnitsExclusive: 2, maxValueExclusive: 20 },
        ownerReview: { minUnitsInclusive: 10, minValueExclusive: 200 },
      },
      severity: {
        minor: '<2% or <GHS 20',
        moderate: '2-5% or GHS 20-100',
        critical: '>5% or >GHS 100',
        severe: '>10% or >GHS 500',
      },
    };
  }

  async startStockCountSession(
    shopId: string,
    userId: string,
    input: { title?: string; scopeType?: 'all' | 'category' | 'section' | 'product_list'; scopeValue?: string }
  ) {
    const now = new Date().toISOString();
    const scopeType = input.scopeType || 'all';
    const title = input.title?.trim() || `Stock count ${now.slice(0, 10)}`;
    const scopeValue = input.scopeValue?.trim() || null;
    const { data, error } = await supabase
      .from('stock_count_sessions')
      .insert({
        shop_id: shopId,
        title,
        scope_type: scopeType,
        scope_value: scopeValue,
        status: 'open',
        started_by: userId,
        started_at: now,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error('Failed to start stock count session');

    await logAuditAction({
      shopId,
      userId,
      action: 'stock.count.start',
      entityType: 'stock_count_session',
      entityId: data.id,
      after: data,
    });
    return data;
  }

  async listStockCountSessions(shopId: string, limit = 30) {
    const { data, error } = await supabase
      .from('stock_count_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .order('started_at', { ascending: false })
      .limit(Number(limit || 30));
    if (error) {
      if (isMissingControlsTables(error)) {
        logger.warn('Stock count tables missing. Run migration 013_stock_count_workflow.sql');
        return [];
      }
      logger.error('listStockCountSessions query failed (fallback to empty):', error);
      return [];
    }
    return data || [];
  }

  async getStockCountProgress(shopId: string, sessionId: string) {
    const { data: session, error: sessionError } = await supabase
      .from('stock_count_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', sessionId)
      .single();
    if (sessionError || !session) throw new Error('Stock count session not found');

    let productsQuery = supabase
      .from('products')
      .select('id')
      .eq('shop_id', shopId)
      .eq('is_active', true);
    if (session.scope_type === 'category' && session.scope_value) {
      productsQuery = productsQuery.eq('category_id', session.scope_value);
    }

    const { data: products } = await productsQuery;
    const totalProducts = (products || []).length;

    const { data: items } = await supabase
      .from('stock_count_items')
      .select('id,verification_status')
      .eq('shop_id', shopId)
      .eq('session_id', sessionId);
    const counted = (items || []).length;
    const mismatches = (items || []).filter((i: any) => i.verification_status === 'mismatch').length;
    const pendingSecond = (items || []).filter((i: any) => i.verification_status === 'pending_second_count').length;
    const percent = totalProducts > 0 ? Number(((counted / totalProducts) * 100).toFixed(1)) : 0;
    return {
      session,
      totalProducts,
      countedProducts: counted,
      remainingProducts: Math.max(0, totalProducts - counted),
      progressPercent: percent,
      mismatches,
      pendingSecondCount: pendingSecond,
      progressText: `${counted} of ${totalProducts} products counted`,
    };
  }

  async recordStockCountItem(
    shopId: string,
    userId: string,
    sessionId: string,
    input: { productId: string; countedQty: number; photoUrl?: string; notes?: string }
  ) {
    const now = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('stock_count_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', sessionId)
      .single();
    if (sessionError || !session) throw new Error('Stock count session not found');
    if (session.status !== 'open') throw new Error('Stock count session is not open');

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id,name,stock_quantity,cost_price,selling_price,category_id,is_active')
      .eq('shop_id', shopId)
      .eq('id', input.productId)
      .eq('is_active', true)
      .single();
    if (productError || !product) throw new Error('Product not found');

    if (session.scope_type === 'category' && session.scope_value && String(product.category_id) !== String(session.scope_value)) {
      throw new Error('Product does not belong to selected category');
    }

    const countedQty = Number(input.countedQty || 0);
    if (!Number.isFinite(countedQty)) throw new Error('countedQty is required');

    const requiresVerification = shouldRequireTwoPersonVerification(Number(product.selling_price), Number(product.cost_price));
    const { data: existing } = await supabase
      .from('stock_count_items')
      .select('*')
      .eq('shop_id', shopId)
      .eq('session_id', sessionId)
      .eq('product_id', product.id)
      .maybeSingle();

    let row: any;
    if (!existing) {
      const verificationStatus = requiresVerification ? 'pending_second_count' : 'not_required';
      const { data, error } = await supabase
        .from('stock_count_items')
        .insert({
          session_id: sessionId,
          shop_id: shopId,
          product_id: product.id,
          product_name: product.name || 'Unnamed product',
          expected_qty: Number(product.stock_quantity || 0),
          counted_qty_primary: countedQty,
          requires_verification: requiresVerification,
          verification_status: verificationStatus,
          counted_by_primary: userId,
          counted_at_primary: now,
          photo_url: input.photoUrl?.trim() || null,
          notes: input.notes?.trim() || null,
          last_counted_at: now,
          updated_at: now,
        })
        .select('*')
        .single();
      if (error || !data) throw new Error('Failed to record count');
      row = data;
    } else {
      if (!existing.requires_verification) {
        const { data, error } = await supabase
          .from('stock_count_items')
          .update({
            counted_qty_primary: countedQty,
            counted_by_primary: userId,
            counted_at_primary: now,
            photo_url: input.photoUrl?.trim() || existing.photo_url || null,
            notes: input.notes?.trim() || existing.notes || null,
            last_counted_at: now,
            updated_at: now,
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error || !data) throw new Error('Failed to update count');
        row = data;
      } else {
        if (!existing.counted_by_primary || String(existing.counted_by_primary) === String(userId)) {
          const { data, error } = await supabase
            .from('stock_count_items')
            .update({
              counted_qty_primary: countedQty,
              counted_by_primary: userId,
              counted_at_primary: now,
              verification_status: 'pending_second_count',
              photo_url: input.photoUrl?.trim() || existing.photo_url || null,
              notes: input.notes?.trim() || existing.notes || null,
              last_counted_at: now,
              updated_at: now,
            })
            .eq('id', existing.id)
            .select('*')
            .single();
          if (error || !data) throw new Error('Failed to update primary count');
          row = data;
        } else {
          const primary = Number(existing.counted_qty_primary || 0);
          const matched = Math.abs(primary - countedQty) < 0.0001;
          const { data, error } = await supabase
            .from('stock_count_items')
            .update({
              counted_qty_secondary: countedQty,
              counted_by_secondary: userId,
              counted_at_secondary: now,
              verification_status: matched ? 'matched' : 'mismatch',
              photo_url: input.photoUrl?.trim() || existing.photo_url || null,
              notes: input.notes?.trim() || existing.notes || null,
              last_counted_at: now,
              updated_at: now,
            })
            .eq('id', existing.id)
            .select('*')
            .single();
          if (error || !data) throw new Error('Failed to record secondary verification');
          row = data;
        }
      }
    }

    await logAuditAction({
      shopId,
      userId,
      action: 'stock.count.item',
      entityType: 'stock_count_item',
      entityId: row.id,
      after: row,
      metadata: { sessionId, productId: product.id },
    });
    return row;
  }

  async submitStockCountSession(shopId: string, userId: string, sessionId: string) {
    const now = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('stock_count_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', sessionId)
      .single();
    if (sessionError || !session) throw new Error('Stock count session not found');
    if (session.status !== 'open') throw new Error('Session is not open');

    const { data: items, error: itemsError } = await supabase
      .from('stock_count_items')
      .select('*')
      .eq('shop_id', shopId)
      .eq('session_id', sessionId);
    if (itemsError) throw new Error('Failed to read counted items');

    const hasPending = (items || []).some((i: any) => i.verification_status === 'pending_second_count');
    const hasMismatch = (items || []).some((i: any) => i.verification_status === 'mismatch');
    if (hasPending || hasMismatch) {
      const { data: updated, error } = await supabase
        .from('stock_count_sessions')
        .update({
          status: 'reconciliation_required',
          submitted_at: now,
          updated_at: now,
        })
        .eq('shop_id', shopId)
        .eq('id', sessionId)
        .select('*')
        .single();
      if (error || !updated) throw new Error('Failed to mark reconciliation required');
      return { session: updated, variancesCreated: 0, needsReconciliation: true };
    }

    let created = 0;
    for (const item of items || []) {
      const expectedQty = Number(item.expected_qty || 0);
      const countedQty = Number(item.counted_qty_secondary ?? item.counted_qty_primary ?? expectedQty);
      if (Math.abs(countedQty - expectedQty) < 0.0001) continue;
      const { data: product } = await supabase
        .from('products')
        .select('id,name,cost_price')
        .eq('shop_id', shopId)
        .eq('id', item.product_id)
        .maybeSingle();
      if (!product?.id) continue;
      await this.recordStockVariance(shopId, userId, {
        productId: product.id,
        countedQty,
        expectedQty,
        reasonCode: 'counting_error',
        reasonNote: `Physical count session ${sessionId}`,
      });
      created += 1;
    }

    const { data: completed, error: completeError } = await supabase
      .from('stock_count_sessions')
      .update({
        status: 'completed',
        submitted_at: now,
        completed_at: now,
        completed_by: userId,
        updated_at: now,
      })
      .eq('shop_id', shopId)
      .eq('id', sessionId)
      .select('*')
      .single();
    if (completeError || !completed) throw new Error('Failed to complete stock count session');

    await logAuditAction({
      shopId,
      userId,
      action: 'stock.count.submit',
      entityType: 'stock_count_session',
      entityId: sessionId,
      after: completed,
      metadata: { variancesCreated: created },
    });

    return { session: completed, variancesCreated: created, needsReconciliation: false };
  }

  async listStockCountSessionItems(shopId: string, sessionId: string) {
    const { data, error } = await supabase
      .from('stock_count_items')
      .select('*')
      .eq('shop_id', shopId)
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error('Failed to load stock count items');
    return data || [];
  }

  async getStockCountReminders(shopId: string, thresholdDays = 14) {
    const sessions = await this.listStockCountSessions(shopId, 200);
    const completed = sessions.filter((s: any) => s.status === 'completed');
    const nowMs = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const thresholdMs = Number(thresholdDays || 14) * 24 * 60 * 60 * 1000;

    const latestCompleted = completed
      .map((s: any) => new Date(s.completed_at || s.submitted_at || s.started_at).getTime())
      .sort((a: number, b: number) => b - a)[0];

    const reminders: Array<{ type: string; message: string; severity: 'info' | 'warning'; daysSinceLastCount?: number }> = [];
    if (!latestCompleted || (nowMs - latestCompleted) > weekMs) {
      const days = latestCompleted ? Math.floor((nowMs - latestCompleted) / (24 * 60 * 60 * 1000)) : null;
      reminders.push({
        type: 'weekly',
        severity: 'info',
        message: days == null
          ? 'Time for weekly stock count'
          : `Time for weekly stock count (last completed ${days} day(s) ago)`,
        daysSinceLastCount: days == null ? undefined : days,
      });
    }

    const bySection = new Map<string, number>();
    for (const s of completed) {
      if (s.scope_type !== 'section' || !s.scope_value) continue;
      const ts = new Date(s.completed_at || s.submitted_at || s.started_at).getTime();
      const prev = bySection.get(String(s.scope_value));
      if (!prev || ts > prev) bySection.set(String(s.scope_value), ts);
    }
    for (const [section, ts] of bySection.entries()) {
      if (nowMs - ts > thresholdMs) {
        const days = Math.floor((nowMs - ts) / (24 * 60 * 60 * 1000));
        reminders.push({
          type: 'section_stale',
          severity: 'warning',
          message: `${section} section not counted in ${days} days`,
          daysSinceLastCount: days,
        });
      }
    }
    return reminders;
  }

  async createStockLocation(
    shopId: string,
    userId: string,
    input: { name: string; locationType?: string }
  ) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Location name is required');
    const { data, error } = await supabase
      .from('stock_locations')
      .insert({
        shop_id: shopId,
        name,
        location_type: input.locationType?.trim() || 'store',
        created_by: userId,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error('Failed to create stock location');
    return data;
  }

  async listStockLocations(shopId: string) {
    const { data, error } = await supabase
      .from('stock_locations')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingControlsTables(error)) return [];
      throw new Error('Failed to load stock locations');
    }
    return data || [];
  }

  async setLocationBalance(
    shopId: string,
    userId: string,
    input: { locationId: string; productId: string; quantity: number }
  ) {
    const quantity = Number(input.quantity || 0);
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Quantity must be zero or greater');
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('stock_location_balances')
      .upsert(
        {
          shop_id: shopId,
          location_id: input.locationId,
          product_id: input.productId,
          quantity,
          updated_by: userId,
          updated_at: now,
        },
        { onConflict: 'shop_id,location_id,product_id' }
      )
      .select('*')
      .single();
    if (error || !data) throw new Error('Failed to set location balance');
    return data;
  }

  async getLocationBalances(shopId: string, locationId?: string) {
    let query = supabase
      .from('stock_location_balances')
      .select('*, location:stock_locations(id,name,location_type), product:products(id,name,barcode,sku)')
      .eq('shop_id', shopId)
      .order('updated_at', { ascending: false });
    if (locationId) query = query.eq('location_id', locationId);
    const { data, error } = await query;
    if (error) {
      if (isMissingControlsTables(error)) return [];
      throw new Error('Failed to load location balances');
    }
    return data || [];
  }

  async transferStock(
    shopId: string,
    userId: string,
    input: { fromLocationId: string; toLocationId: string; productId: string; quantity: number; notes?: string }
  ) {
    if (input.fromLocationId === input.toLocationId) throw new Error('Source and destination must be different');
    const qty = Number(input.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Valid quantity is required');

    const { data: fromRow, error: fromErr } = await supabase
      .from('stock_location_balances')
      .select('*')
      .eq('shop_id', shopId)
      .eq('location_id', input.fromLocationId)
      .eq('product_id', input.productId)
      .maybeSingle();
    if (fromErr) throw new Error('Failed to read source location balance');
    const fromQty = Number(fromRow?.quantity || 0);
    if (fromQty + 0.0001 < qty) throw new Error(`Insufficient stock at source location. Available ${fromQty}`);

    const { data: toRow, error: toErr } = await supabase
      .from('stock_location_balances')
      .select('*')
      .eq('shop_id', shopId)
      .eq('location_id', input.toLocationId)
      .eq('product_id', input.productId)
      .maybeSingle();
    if (toErr) throw new Error('Failed to read destination location balance');
    const toQty = Number(toRow?.quantity || 0);

    const now = new Date().toISOString();
    await this.setLocationBalance(shopId, userId, {
      locationId: input.fromLocationId,
      productId: input.productId,
      quantity: Number((fromQty - qty).toFixed(3)),
    });
    await this.setLocationBalance(shopId, userId, {
      locationId: input.toLocationId,
      productId: input.productId,
      quantity: Number((toQty + qty).toFixed(3)),
    });

    const { data: transfer, error } = await supabase
      .from('stock_transfers')
      .insert({
        shop_id: shopId,
        from_location_id: input.fromLocationId,
        to_location_id: input.toLocationId,
        product_id: input.productId,
        quantity: qty,
        notes: input.notes?.trim() || null,
        status: 'completed',
        created_by: userId,
        approved_by: userId,
        created_at: now,
      })
      .select('*')
      .single();
    if (error || !transfer) throw new Error('Failed to create stock transfer');

    const { data: product } = await supabase
      .from('products')
      .select('id,name,stock_quantity')
      .eq('shop_id', shopId)
      .eq('id', input.productId)
      .maybeSingle();
    const productName = product?.name || 'Unknown product';
    await supabase.from('stock_movements').insert([
      {
        shop_id: shopId,
        product_id: input.productId,
        product_name: productName,
        action: 'transfer_out',
        quantity: qty,
        previous_quantity: fromQty,
        new_quantity: Number((fromQty - qty).toFixed(3)),
        movement_type: 'transfer_out',
        quantity_before: fromQty,
        quantity_change: -qty,
        quantity_after: Number((fromQty - qty).toFixed(3)),
        reason_code: 'transfer',
        reason_note: input.notes?.trim() || null,
        notes: `Transfer out to location ${input.toLocationId}`,
        reference_type: 'stock_transfer',
        reference_id: transfer.id,
        location_name: input.fromLocationId,
        created_by: userId,
      },
      {
        shop_id: shopId,
        product_id: input.productId,
        product_name: productName,
        action: 'transfer_in',
        quantity: qty,
        previous_quantity: toQty,
        new_quantity: Number((toQty + qty).toFixed(3)),
        movement_type: 'transfer_in',
        quantity_before: toQty,
        quantity_change: qty,
        quantity_after: Number((toQty + qty).toFixed(3)),
        reason_code: 'transfer',
        reason_note: input.notes?.trim() || null,
        notes: `Transfer in from location ${input.fromLocationId}`,
        reference_type: 'stock_transfer',
        reference_id: transfer.id,
        location_name: input.toLocationId,
        created_by: userId,
      },
    ]);

    return transfer;
  }

  async listStockTransfers(shopId: string, limit = 100) {
    const { data, error } = await supabase
      .from('stock_transfers')
      .select(`
        *,
        fromLocation:stock_locations!stock_transfers_from_location_id_fkey(id,name,location_type),
        toLocation:stock_locations!stock_transfers_to_location_id_fkey(id,name,location_type),
        product:products(id,name,barcode,sku)
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(Number(limit || 100));
    if (error) {
      if (isMissingControlsTables(error)) return [];
      throw new Error('Failed to load stock transfers');
    }
    return data || [];
  }

  async recordSupplierDelivery(
    shopId: string,
    userId: string,
    input: {
      supplierName: string;
      invoiceNumber?: string;
      productId: string;
      expectedQuantity: number;
      receivedQuantity: number;
      unitCost?: number;
      deliveryPersonName?: string;
      deliverySignature?: string;
      photoUrl?: string;
      notes?: string;
      locationId?: string;
    }
  ) {
    const supplierName = String(input.supplierName || '').trim();
    if (!supplierName) throw new Error('supplierName is required');
    const expected = Number(input.expectedQuantity || 0);
    const received = Number(input.receivedQuantity || 0);
    if (!Number.isFinite(expected) || expected <= 0) throw new Error('expectedQuantity must be > 0');
    if (!Number.isFinite(received) || received < 0) throw new Error('receivedQuantity must be >= 0');
    const shortage = Number((expected - received).toFixed(3));

    const unitCost = Number.isFinite(input.unitCost as number) ? Number(input.unitCost) : undefined;
    if (received > 0) {
      await inventoryService.receiveStock(shopId, input.productId, userId, received, `Supplier delivery ${supplierName}`, unitCost);
    }

    const { data, error } = await supabase
      .from('supplier_deliveries')
      .insert({
        shop_id: shopId,
        supplier_name: supplierName,
        invoice_number: input.invoiceNumber?.trim() || null,
        product_id: input.productId,
        expected_quantity: expected,
        received_quantity: received,
        shortage_quantity: shortage > 0 ? shortage : 0,
        unit_cost: Number.isFinite(unitCost as number) ? Number(unitCost) : 0,
        delivery_person_name: input.deliveryPersonName?.trim() || null,
        delivery_signature: input.deliverySignature?.trim() || null,
        photo_url: input.photoUrl?.trim() || null,
        notes: input.notes?.trim() || null,
        created_by: userId,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error('Failed to record supplier delivery');

    if (input.locationId && received > 0) {
      const { data: row } = await supabase
        .from('stock_location_balances')
        .select('*')
        .eq('shop_id', shopId)
        .eq('location_id', input.locationId)
        .eq('product_id', input.productId)
        .maybeSingle();
      const current = Number(row?.quantity || 0);
      await this.setLocationBalance(shopId, userId, {
        locationId: input.locationId,
        productId: input.productId,
        quantity: Number((current + received).toFixed(3)),
      });
    }

    return { ...data, shortageFlag: shortage > 0 };
  }

  async getSupplierScorecard(shopId: string, supplierName?: string) {
    let query = supabase
      .from('supplier_deliveries')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (supplierName?.trim()) query = query.ilike('supplier_name', supplierName.trim());
    const { data, error } = await query;
    if (error) {
      if (isMissingControlsTables(error)) return [];
      throw new Error('Failed to build supplier scorecard');
    }

    const grouped = new Map<string, any>();
    for (const row of data || []) {
      const key = String((row as any).supplier_name || 'Unknown');
      const g = grouped.get(key) || {
        supplierName: key,
        deliveries: 0,
        perfectDeliveries: 0,
        shortDeliveries: 0,
        expectedTotal: 0,
        shortageTotal: 0,
      };
      const expected = Number((row as any).expected_quantity || 0);
      const shortage = Number((row as any).shortage_quantity || 0);
      g.deliveries += 1;
      g.expectedTotal += expected;
      g.shortageTotal += shortage;
      if (shortage <= 0.0001) g.perfectDeliveries += 1;
      else g.shortDeliveries += 1;
      grouped.set(key, g);
    }
    return Array.from(grouped.values()).map((g: any) => {
      const accuracy = g.expectedTotal > 0 ? Number((((g.expectedTotal - g.shortageTotal) / g.expectedTotal) * 100).toFixed(1)) : 100;
      const avgShortagePct = g.expectedTotal > 0 ? Number(((g.shortageTotal / g.expectedTotal) * 100).toFixed(2)) : 0;
      return {
        supplierName: g.supplierName,
        deliveryAccuracyPercent: accuracy,
        averageShortagePercent: avgShortagePct,
        deliveries: g.deliveries,
        perfectDeliveries: g.perfectDeliveries,
        shortDeliveries: g.shortDeliveries,
      };
    }).sort((a, b) => b.deliveryAccuracyPercent - a.deliveryAccuracyPercent);
  }

  async createReorderPurchasePlan(
    shopId: string,
    userId: string,
    input?: {
      period?: 'daily' | 'weekly' | 'monthly';
      maxItems?: number;
      supplierStrategy?: 'last_supplier' | 'best_scorecard';
      notes?: string;
    }
  ) {
    const period = (input?.period || 'weekly') as 'daily' | 'weekly' | 'monthly';
    const maxItems = Math.max(1, Math.min(50, Number(input?.maxItems || 15)));
    const supplierStrategy = input?.supplierStrategy || 'last_supplier';

    const intelligence = await reportsService.getInventoryStockIntelligence(shopId, userId, period);
    const suggestions = (intelligence?.reorderSuggestions || []).filter((x: any) => Number(x.reorderQty || 0) > 0).slice(0, maxItems);
    if (!suggestions.length) {
      return {
        created: false,
        message: 'No reorder suggestions available for selected period.',
        plan: null,
      };
    }

    const productIds = suggestions.map((s: any) => String(s.productId)).filter(Boolean);
    const { data: products, error: productsErr } = await supabase
      .from('products')
      .select('id,name,cost_price')
      .eq('shop_id', shopId)
      .in('id', productIds);
    if (productsErr) throw new Error('Failed to read products for purchase plan');
    const productMap = new Map<string, any>((products || []).map((p: any) => [String(p.id), p]));

    const { data: deliveries, error: deliveriesErr } = await supabase
      .from('supplier_deliveries')
      .select('product_id,supplier_name,unit_cost,created_at')
      .eq('shop_id', shopId)
      .in('product_id', productIds)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (deliveriesErr && !isMissingControlsTables(deliveriesErr)) {
      throw new Error('Failed to read supplier delivery history');
    }

    const latestSupplierByProduct = new Map<string, { supplierName: string; unitCost: number }>();
    for (const row of deliveries || []) {
      const pid = String((row as any).product_id || '');
      if (!pid || latestSupplierByProduct.has(pid)) continue;
      latestSupplierByProduct.set(pid, {
        supplierName: String((row as any).supplier_name || '').trim(),
        unitCost: Number((row as any).unit_cost || 0),
      });
    }

    const scorecard = await this.getSupplierScorecard(shopId);
    const bestSupplierName = scorecard[0]?.supplierName ? String(scorecard[0].supplierName) : '';

    const draftItems = suggestions.map((s: any) => {
      const pid = String(s.productId);
      const product = productMap.get(pid);
      const latestSupplier = latestSupplierByProduct.get(pid);
      const supplierName = supplierStrategy === 'best_scorecard'
        ? (latestSupplier?.supplierName || bestSupplierName || 'Unassigned supplier')
        : (latestSupplier?.supplierName || bestSupplierName || 'Unassigned supplier');
      const unitCost = Number(
        latestSupplier?.unitCost && latestSupplier.unitCost > 0
          ? latestSupplier.unitCost
          : Number(product?.cost_price || 0)
      );
      const qty = Number(s.reorderQty || 0);
      const estimatedCost = Number((qty * unitCost).toFixed(2));
      return {
        productId: pid,
        productName: String(product?.name || s.name || 'Unknown'),
        supplierName,
        suggestedQty: qty,
        unitCost,
        estimatedCost,
        riskLevel: String(s.riskLevel || 'low'),
        daysOfCover: Number(s.daysOfCover || 0),
        avgDailySold: Number(s.avgDailySold || 0),
      };
    });

    const totalEstimatedCost = Number(draftItems.reduce((sum, i) => sum + Number(i.estimatedCost || 0), 0).toFixed(2));
    const now = new Date().toISOString();
    const planNotes = input?.notes?.trim() || `Auto-generated from inventory intelligence (${period}).`;

    const { data: plan, error: planErr } = await supabase
      .from('purchase_plans')
      .insert({
        shop_id: shopId,
        created_by: userId,
        period,
        status: 'draft',
        source: 'inventory_intelligence',
        notes: planNotes,
        total_items: draftItems.length,
        total_estimated_cost: totalEstimatedCost,
        updated_at: now,
      })
      .select('*')
      .single();

    if (planErr || !plan) {
      if (isMissingControlsTables(planErr)) {
        throw new Error('Purchase plan tables missing. Run migration 016_purchase_plans.sql');
      }
      throw new Error('Failed to create purchase plan');
    }

    const itemRows = draftItems.map((item) => ({
      plan_id: plan.id,
      shop_id: shopId,
      product_id: item.productId,
      product_name: item.productName,
      supplier_name: item.supplierName,
      suggested_qty: item.suggestedQty,
      unit_cost: item.unitCost,
      estimated_cost: item.estimatedCost,
      risk_level: item.riskLevel,
      days_of_cover: item.daysOfCover,
      avg_daily_sold: item.avgDailySold,
      created_at: now,
    }));
    const { data: insertedItems, error: itemsErr } = await supabase
      .from('purchase_plan_items')
      .insert(itemRows)
      .select('*');
    if (itemsErr) throw new Error('Failed to create purchase plan items');

    const supplierGroups = new Map<string, { supplierName: string; items: number; estimatedCost: number }>();
    for (const item of draftItems) {
      const key = item.supplierName || 'Unassigned supplier';
      const prev = supplierGroups.get(key) || { supplierName: key, items: 0, estimatedCost: 0 };
      prev.items += 1;
      prev.estimatedCost += Number(item.estimatedCost || 0);
      supplierGroups.set(key, prev);
    }

    await logAuditAction({
      shopId,
      userId,
      action: 'purchase_plan.create',
      entityType: 'purchase_plan',
      entityId: String(plan.id),
      after: plan,
      metadata: { period, items: draftItems.length, totalEstimatedCost },
    });

    return {
      created: true,
      message: 'Purchase plan draft created.',
      plan: {
        ...plan,
        total_estimated_cost: totalEstimatedCost,
        items: insertedItems || [],
        supplierGroups: Array.from(supplierGroups.values())
          .map((g) => ({ ...g, estimatedCost: Number(g.estimatedCost.toFixed(2)) }))
          .sort((a, b) => b.estimatedCost - a.estimatedCost),
      },
    };
  }

  async getVariancePatternAlerts(shopId: string) {
    const alerts: Array<{ type: string; severity: 'info' | 'warning' | 'critical'; message: string; metadata?: Record<string, unknown> }> = [];

    const { data: variances } = await supabase
      .from('stock_variances')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(2000);
    const rows = variances || [];
    if (rows.length === 0) return alerts;

    const byProductShort = new Map<string, any[]>();
    for (const v of rows) {
      const qty = Number((v as any).variance_qty || 0);
      if (qty >= 0) continue;
      const key = String((v as any).product_id || (v as any).product_name || 'unknown');
      const arr = byProductShort.get(key) || [];
      arr.push(v);
      byProductShort.set(key, arr);
    }
    for (const [, arr] of byProductShort.entries()) {
      if (arr.length >= 3) {
        const name = String((arr[0] as any).product_name || 'Unknown product');
        alerts.push({
          type: 'repeat_shortage',
          severity: 'critical',
          message: `${name} has shortage variances ${arr.length} times recently`,
          metadata: { productId: (arr[0] as any).product_id, count: arr.length },
        });
      }
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
    const thisMonthAbs = rows
      .filter((r: any) => String(r.created_at) >= monthStart)
      .reduce((sum: number, r: any) => sum + Math.abs(Number(r.variance_value || 0)), 0);
    const prevMonthAbs = rows
      .filter((r: any) => String(r.created_at) >= prevMonthStart && String(r.created_at) < monthStart)
      .reduce((sum: number, r: any) => sum + Math.abs(Number(r.variance_value || 0)), 0);
    if (prevMonthAbs > 0 && thisMonthAbs >= prevMonthAbs * 3) {
      alerts.push({
        type: 'month_spike',
        severity: 'critical',
        message: `Variance value increased by ${Number(((thisMonthAbs / prevMonthAbs - 1) * 100).toFixed(0))}% this month`,
        metadata: { thisMonthAbs, prevMonthAbs },
      });
    }

    const highValueMissing = rows.find((r: any) => Number(r.unit_cost || 0) > 100 && Number(r.variance_qty || 0) < 0);
    if (highValueMissing) {
      alerts.push({
        type: 'high_value_missing',
        severity: 'warning',
        message: `High-value item missing: ${String((highValueMissing as any).product_name || 'Unknown')}`,
        metadata: { varianceId: (highValueMissing as any).id },
      });
    }

    const fridayNightCount = rows.filter((r: any) => {
      const d = new Date(String((r as any).created_at));
      const day = d.getUTCDay();
      const hour = d.getUTCHours();
      return day === 5 && hour >= 18;
    }).length;
    if (fridayNightCount >= 3) {
      alerts.push({
        type: 'friday_night_pattern',
        severity: 'info',
        message: `Variance often occurs on Friday nights (${fridayNightCount} cases)`,
      });
    }

    const byUser = new Map<string, { value: number; count: number }>();
    for (const r of rows) {
      const uid = String((r as any).created_by || 'unknown');
      const abs = Math.abs(Number((r as any).variance_value || 0));
      const item = byUser.get(uid) || { value: 0, count: 0 };
      item.value += abs;
      item.count += 1;
      byUser.set(uid, item);
    }
    if (byUser.size > 1) {
      const all = Array.from(byUser.entries()).sort((a, b) => b[1].value - a[1].value);
      const top = all[0];
      const restAvg = all.slice(1).reduce((sum, x) => sum + x[1].value, 0) / Math.max(1, all.length - 1);
      if (restAvg > 0 && top[1].value >= restAvg * 5) {
        alerts.push({
          type: 'cashier_outlier',
          severity: 'critical',
          message: `User ${top[0]} variance is over 5x peers`,
          metadata: { userId: top[0], value: Number(top[1].value.toFixed(2)), peersAverage: Number(restAvg.toFixed(2)) },
        });
      }
    }

    return alerts;
  }

  async getRiskFraudInsights(shopId: string, lookbackDays = 30) {
    const days = Math.max(1, Math.min(365, Number(lookbackDays || 30)));
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [patternAlerts, discrepanciesRes, variancesRes, salesRes] = await Promise.all([
      this.getVariancePatternAlerts(shopId),
      supabase
        .from('cash_discrepancies')
        .select('id, amount, status, user_id, created_at')
        .eq('shop_id', shopId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('stock_variances')
        .select('id, severity, status, variance_value, created_by, created_at')
        .eq('shop_id', shopId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('sales')
        .select('id, final_amount, payment_method, created_by, created_at, notes, status')
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(5000),
    ]);
    if (discrepanciesRes.error && !isMissingControlsTables(discrepanciesRes.error)) {
      throw new Error('Failed to load cash discrepancy risk data');
    }
    if (variancesRes.error && !isMissingControlsTables(variancesRes.error)) {
      throw new Error('Failed to load stock variance risk data');
    }
    if (salesRes.error) throw new Error('Failed to load sales risk data');

    const discrepancies = discrepanciesRes.data || [];
    const variances = variancesRes.data || [];
    const sales = salesRes.data || [];

    const unresolvedDiscrepancies = discrepancies.filter((d: any) => String(d.status || '') === 'open');
    const discrepancyAmountAbs = unresolvedDiscrepancies.reduce(
      (sum: number, d: any) => sum + Math.abs(Number(d.amount || 0)),
      0
    );
    const severeVariances = variances.filter((v: any) => ['critical', 'severe'].includes(String(v.severity || '')));
    const unresolvedVariances = variances.filter((v: any) => String(v.status || '').includes('pending'));

    const cashSales = sales.filter((s: any) => String(s.payment_method || '') === 'cash');
    const avgCash = cashSales.length
      ? cashSales.reduce((sum: number, s: any) => sum + Number(s.final_amount || 0), 0) / cashSales.length
      : 0;
    const veryLargeCashSales = cashSales.filter((s: any) => Number(s.final_amount || 0) >= Math.max(2000, avgCash * 2.5));

    const cancelledLikeSales = sales.filter((s: any) => String(s.notes || '').toLowerCase().includes('cancel'));
    const byCashier = new Map<string, { count: number; amount: number }>();
    for (const s of sales) {
      const uid = String((s as any).created_by || 'unknown');
      const row = byCashier.get(uid) || { count: 0, amount: 0 };
      row.count += 1;
      row.amount += Number((s as any).final_amount || 0);
      byCashier.set(uid, row);
    }
    const cashierOutliers = Array.from(byCashier.entries())
      .map(([userId, v]) => ({
        userId,
        count: v.count,
        amount: Number(v.amount.toFixed(2)),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const alerts: Array<{ type: string; severity: 'info' | 'warning' | 'critical'; message: string; metric?: number }> = [];
    alerts.push(...patternAlerts.map((a: any) => ({
      type: String(a.type || 'pattern'),
      severity: a.severity as 'info' | 'warning' | 'critical',
      message: String(a.message || 'Pattern detected'),
      metric: Number((a.metadata as any)?.value || 0),
    })));

    if (unresolvedDiscrepancies.length > 0) {
      alerts.push({
        type: 'open_cash_discrepancies',
        severity: unresolvedDiscrepancies.length >= 3 || discrepancyAmountAbs >= 500 ? 'critical' : 'warning',
        message: `${unresolvedDiscrepancies.length} open cash discrepancy case(s), total gap ${this.normalizeCurrencyText(`$${discrepancyAmountAbs.toFixed(2)}`)}`,
        metric: discrepancyAmountAbs,
      });
    }
    if (severeVariances.length > 0) {
      alerts.push({
        type: 'severe_stock_variances',
        severity: severeVariances.length >= 5 ? 'critical' : 'warning',
        message: `${severeVariances.length} severe/critical stock variance case(s) in last ${days} days`,
        metric: severeVariances.length,
      });
    }
    if (veryLargeCashSales.length > 0) {
      alerts.push({
        type: 'large_cash_sales',
        severity: veryLargeCashSales.length >= 2 ? 'critical' : 'warning',
        message: `${veryLargeCashSales.length} unusually large cash sale(s) detected`,
        metric: veryLargeCashSales.length,
      });
    }
    if (cancelledLikeSales.length > 0) {
      alerts.push({
        type: 'cancel_note_frequency',
        severity: cancelledLikeSales.length >= 4 ? 'warning' : 'info',
        message: `${cancelledLikeSales.length} sale note(s) mention cancellations/voids`,
        metric: cancelledLikeSales.length,
      });
    }

    const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
    const warningCount = alerts.filter((a) => a.severity === 'warning').length;
    const infoCount = alerts.filter((a) => a.severity === 'info').length;

    let score = 100;
    score -= Math.min(40, criticalCount * 15);
    score -= Math.min(25, warningCount * 8);
    score -= Math.min(10, infoCount * 2);
    score = Math.max(0, Math.min(100, Math.round(score)));
    const status = score >= 80 ? 'low-risk' : score >= 60 ? 'watch' : 'high-risk';

    const snapshot = {
      lookbackDays: days,
      score,
      status,
      counts: { critical: criticalCount, warning: warningCount, info: infoCount },
      unresolvedDiscrepancies: unresolvedDiscrepancies.length,
      discrepancyAmountAbs,
      severeVariances: severeVariances.length,
      unresolvedVariances: unresolvedVariances.length,
      unusuallyLargeCashSales: veryLargeCashSales.length,
      cancellationMentions: cancelledLikeSales.length,
      cashierOutliers,
      alerts: alerts.slice(0, 20),
    };

    const prompt = `
You are ShopKeeper Risk & Fraud Copilot.
Use only this JSON:
${JSON.stringify(snapshot, null, 2)}

Return concise practical text with:
- top risk signal
- 3 specific actions to reduce fraud risk this week
- one monitoring rule to automate

Currency rules:
- Use GHS only.
- Never use "$" or "USD".
`;
    const ai = await this.callOpenAiThenClaude(prompt);

    return {
      providerUsed: ai.provider,
      lookbackDays: days,
      riskScore: score,
      riskStatus: status,
      counts: snapshot.counts,
      alerts: snapshot.alerts,
      unresolvedDiscrepancies: snapshot.unresolvedDiscrepancies,
      discrepancyAmountAbs: snapshot.discrepancyAmountAbs,
      severeVariances: snapshot.severeVariances,
      unusuallyLargeCashSales: snapshot.unusuallyLargeCashSales,
      cashierOutliers: snapshot.cashierOutliers,
      aiSummary: this.normalizeCurrencyText(ai.text),
      snapshot,
    };
  }

  async queryRiskFraudInsights(shopId: string, query: string, lookbackDays = 30) {
    const insights = await this.getRiskFraudInsights(shopId, lookbackDays);
    const prompt = `
You are ShopKeeper fraud analyst.
Answer with only the provided payload.
Question: ${query}
Payload:
${JSON.stringify(insights.snapshot || {}, null, 2)}

Return concise answer with bullets and one next action.
Currency rules: Use GHS only; do not use "$" or "USD".
`;
    const ai = await this.callOpenAiThenClaude(prompt);
    return {
      providerUsed: ai.provider,
      lookbackDays: Number(lookbackDays || 30),
      query,
      answer: this.normalizeCurrencyText(ai.text),
      basedOn: {
        riskScore: insights.riskScore,
        counts: insights.counts,
      },
    };
  }

  async dispatchDailyOwnerSummary(
    shopId: string,
    userId: string,
    input?: { channels?: Array<'whatsapp' | 'sms' | 'email'>; period?: 'daily' | 'weekly' | 'monthly' }
  ) {
    const channels = input?.channels?.length ? input.channels : ['whatsapp', 'email'];
    const period = input?.period || 'daily';
    const [owner, bi] = await Promise.all([
      this.getShopOwnerContact(shopId),
      reportsService.getBusinessIntelligence(shopId, userId, period),
    ]);

    const text = this.normalizeCurrencyText(
      [
        `${owner.shopName} owner summary (${period})`,
        `Revenue: GHS ${Number(bi?.snapshot?.kpis?.sales || 0).toFixed(2)}`,
        `Gross profit: GHS ${Number(bi?.snapshot?.kpis?.grossProfit || 0).toFixed(2)}`,
        `Transactions: ${Number(bi?.snapshot?.kpis?.transactions || 0)}`,
        `Risk hint: ${String(bi?.whyProfitDown || 'Track margin and expenses daily.')}`,
      ].join('\n')
    );

    let emailSent = false;
    if (channels.includes('email') && owner.ownerEmail) {
      emailSent = await sendGenericEmail({
        to: owner.ownerEmail,
        subject: `${owner.shopName} - Daily owner summary`,
        text,
      });
    }

    return {
      channels,
      summary: text,
      email: {
        to: owner.ownerEmail || null,
        sent: emailSent,
      },
      whatsapp: {
        link: channels.includes('whatsapp') ? this.buildWhatsAppLink(owner.ownerPhone, text) : '',
      },
      sms: {
        text: channels.includes('sms') ? text : '',
      },
      basedOn: { period, provider: bi.providerUsed },
    };
  }

  async dispatchCreditRepaymentReminders(
    shopId: string,
    userId: string,
    input?: { channels?: Array<'whatsapp' | 'sms' | 'email'>; lookbackDays?: number; intervalDays?: number }
  ) {
    const channels = input?.channels?.length ? input.channels : ['whatsapp', 'sms'];
    const result = await membersService.runAutoCreditReminders(
      shopId,
      userId,
      Number(input?.intervalDays || 3),
      Number(input?.lookbackDays || 90)
    );

    return {
      channels,
      intervalDays: result.intervalDays,
      dueCount: result.dueCount,
      reminders: (result.reminders || []).map((r: any) => ({
        ...r,
        whatsappLink: channels.includes('whatsapp') ? this.buildWhatsAppLink(r.phone, r.message) : '',
        smsText: channels.includes('sms') ? String(r.message || '') : '',
      })),
      providerUsed: result.providerUsed,
    };
  }

  async dispatchSupplierReorderDrafts(
    shopId: string,
    userId: string,
    input?: { period?: 'daily' | 'weekly' | 'monthly' }
  ) {
    const planRes = await this.createReorderPurchasePlan(shopId, userId, {
      period: input?.period || 'weekly',
      maxItems: 20,
      supplierStrategy: 'last_supplier',
    });
    if (!planRes.created || !planRes.plan) return { created: false, message: planRes.message, drafts: [] };

    const plan = planRes.plan as any;
    const drafts = (plan.supplierGroups || []).map((g: any) => {
      const items = (plan.items || []).filter((i: any) => String(i.supplier_name || '') === String(g.supplierName || ''));
      const message = this.normalizeCurrencyText(
        [
          `Purchase draft for ${g.supplierName}`,
          `Shop: ${plan.shop_id}`,
          `Items: ${Number(g.items || 0)}`,
          `Estimated total: GHS ${Number(g.estimatedCost || 0).toFixed(2)}`,
          ...items.slice(0, 8).map((i: any) => `- ${i.product_name}: qty ${Number(i.suggested_qty || 0)} (GHS ${Number(i.estimated_cost || 0).toFixed(2)})`),
        ].join('\n')
      );
      return {
        supplierName: g.supplierName,
        items: Number(g.items || 0),
        estimatedCost: Number(g.estimatedCost || 0),
        message,
      };
    });

    return {
      created: true,
      planId: plan.id,
      period: plan.period,
      drafts,
    };
  }

  async dispatchCriticalRiskAlerts(
    shopId: string,
    userId: string,
    input?: { channels?: Array<'whatsapp' | 'sms' | 'email'>; lookbackDays?: number }
  ) {
    const channels = input?.channels?.length ? input.channels : ['whatsapp', 'email'];
    const [owner, risk] = await Promise.all([
      this.getShopOwnerContact(shopId),
      this.getRiskFraudInsights(shopId, Number(input?.lookbackDays || 30)),
    ]);
    const criticalAlerts = (risk.alerts || []).filter((a: any) => String(a.severity || '') === 'critical').slice(0, 8);
    const text = this.normalizeCurrencyText(
      [
        `Critical risk alert summary (${risk.lookbackDays}d)`,
        `Risk score: ${risk.riskScore}/100 (${risk.riskStatus})`,
        ...criticalAlerts.map((a: any, idx: number) => `${idx + 1}. ${String(a.message || '')}`),
        criticalAlerts.length ? 'Action: investigate immediately in Staff & Controls.' : 'No critical alerts currently.',
      ].join('\n')
    );

    let emailSent = false;
    if (channels.includes('email') && owner.ownerEmail && criticalAlerts.length > 0) {
      emailSent = await sendGenericEmail({
        to: owner.ownerEmail,
        subject: `${owner.shopName} - Critical risk alerts`,
        text,
      });
    }

    return {
      channels,
      criticalCount: criticalAlerts.length,
      message: text,
      email: { to: owner.ownerEmail || null, sent: emailSent },
      whatsapp: { link: channels.includes('whatsapp') ? this.buildWhatsAppLink(owner.ownerPhone, text) : '' },
      sms: { text: channels.includes('sms') ? text : '' },
      basedOn: { riskScore: risk.riskScore, provider: risk.providerUsed },
    };
  }
}
