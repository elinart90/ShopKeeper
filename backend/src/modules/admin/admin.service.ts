import { supabase } from '../../config/supabase';
import { env } from '../../config/env';
import { sendGenericEmail } from '../../utils/email';
import { logger } from '../../utils/logger';
import { writeAdminAuditLog } from './admin.audit';
import { SalesService } from '../sales/sales.service';
import {
  AdminActionResult,
  AdminApiAccessLogsFilters,
  AdminListAuditLogFilters,
  AdminMonetizationBillingFilters,
  AdminListShopsFilters,
  AdminListUsersFilters,
  AdminSecuritySessionsFilters,
  AdminSecurityThreatsFilters,
  PaginationMeta,
  PlatformAdminRole,
  ShopAdminPlan,
} from './admin.types';

const MONETIZATION_PLAN_PRICES: Record<ShopAdminPlan, { monthly: number; yearly: number }> = {
  small: { monthly: 30, yearly: 306 },
  medium: { monthly: 45, yearly: 459 },
  big: { monthly: 60, yearly: 612 },
  enterprise: { monthly: 100, yearly: 1020 },
};

function toPagination(page = 1, limit = 20) {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;
  return { page: safePage, limit: safeLimit, from, to };
}

function toPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function isoStart(date?: string) {
  return date ? `${date}T00:00:00.000Z` : undefined;
}

function isoEnd(date?: string) {
  return date ? `${date}T23:59:59.999Z` : undefined;
}

function userStatusFromRow(user: any): 'active' | 'suspended' | 'flagged' {
  if (!user?.is_active) return 'suspended';
  if (user?.is_flagged) return 'flagged';
  return 'active';
}

function sanitizeSearch(value?: string) {
  return String(value || '').trim().replace(/[%_,]/g, ' ').trim();
}

function toSubscriptionSnapshot(row: any) {
  const status = String(row?.status || 'inactive');
  const periodEnd = row?.current_period_end ? String(row.current_period_end) : null;
  const isActive = status === 'active' && (!periodEnd || periodEnd > new Date().toISOString());
  return {
    planCode: row?.plan_code ? (String(row.plan_code) as ShopAdminPlan) : null,
    status,
    billingCycle: row?.billing_cycle ? String(row.billing_cycle) : null,
    currentPeriodStart: row?.current_period_start ? String(row.current_period_start) : null,
    currentPeriodEnd: periodEnd,
    isActive,
  };
}

const salesService = new SalesService();

export class AdminService {
  async getAdminProfile(userId: string) {
    const { data, error } = await supabase
      .from('platform_admins')
      .select('user_id, role, is_active, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) throw new Error('Admin profile not found');
    return data;
  }

  private buildExecutiveSummaryEmailText(intelligence: any) {
    return [
      'ShoopKeeper Platform Health Report',
      '',
      `Provider: ${String(intelligence?.providerUsed || '-')}`,
      '',
      'Anomaly Detection:',
      String(intelligence?.anomalyDetection?.summary || '-'),
      ...(Array.isArray(intelligence?.anomalyDetection?.highlights)
        ? intelligence.anomalyDetection.highlights.map((h: string) => `- ${h}`)
        : []),
      '',
      'Churn Prediction:',
      String(intelligence?.churnPrediction?.summary || '-'),
      ...(Array.isArray(intelligence?.churnPrediction?.warnings)
        ? intelligence.churnPrediction.warnings.map((h: string) => `- ${h}`)
        : []),
      '',
      'Growth Opportunities:',
      String(intelligence?.growthOpportunities?.summary || '-'),
      ...(Array.isArray(intelligence?.growthOpportunities?.alerts)
        ? intelligence.growthOpportunities.alerts.map((h: string) => `- ${h}`)
        : []),
      '',
      'Top 10 Performing Shops:',
      `Ranked By: ${String(intelligence?.topPerformingShopsRankBy || 'revenue')}`,
      ...(Array.isArray(intelligence?.topPerformingShops) && intelligence.topPerformingShops.length
        ? intelligence.topPerformingShops.map(
            (s: any, idx: number) =>
              `${idx + 1}. ${String(s?.shopName || s?.shopId || '-')}: GHS ${Number(s?.revenue || 0).toFixed(2)} (${Number(s?.transactions || 0)} tx, profit GHS ${Number(
                s?.profit || 0
              ).toFixed(2)}, avg GHS ${Number(s?.avgTicket || 0).toFixed(2)})`
          )
        : ['- No performance data available for this period.']),
      '',
      'Executive Summary:',
      String(intelligence?.executiveSummary || '-'),
    ].join('\n');
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
          { role: 'system', content: 'You are an executive platform intelligence analyst for retail POS.' },
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
        max_tokens: 1300,
        temperature: 0.2,
        system: 'You are a platform operations copilot for a multi-tenant POS company.',
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

  private async callClaudeThenOpenAi(prompt: string) {
    try {
      const text = await this.callClaudeText(prompt);
      return { provider: 'claude' as const, text };
    } catch (claudeErr: any) {
      logger.warn('Claude admin intelligence call failed; trying OpenAI fallback', {
        message: String(claudeErr?.message || claudeErr),
      });
      const text = await this.callOpenAiText(prompt);
      return { provider: 'openai' as const, text };
    }
  }

  private parseAiJson(text: string) {
    const raw = String(text || '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  async getAdminAiIntelligence(from?: string, to?: string, rankBy: 'revenue' | 'transactions' | 'profit' = 'revenue') {
    const now = new Date();
    const endDate = to ? new Date(`${to}T23:59:59.999Z`) : now;
    const startDate = from ? new Date(`${from}T00:00:00.000Z`) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const periodMs = Math.max(1, endDate.getTime() - startDate.getTime());
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - periodMs);

    const currentFromIso = startDate.toISOString();
    const currentToIso = endDate.toISOString();
    const prevFromIso = prevStartDate.toISOString();
    const prevToIso = prevEndDate.toISOString();

    const [{ data: shops }, { data: currentSales }, { data: previousSales }] = await Promise.all([
      supabase.from('shops').select('id, name, owner_id, timezone, address, is_active'),
      supabase
        .from('sales')
        .select('id, shop_id, created_by, final_amount, status, created_at')
        .gte('created_at', currentFromIso)
        .lte('created_at', currentToIso),
      supabase
        .from('sales')
        .select('id, shop_id, created_by, final_amount, status, created_at')
        .gte('created_at', prevFromIso)
        .lte('created_at', prevToIso),
    ]);

    const shopRows = shops || [];
    const shopById = new Map(shopRows.map((s: any) => [s.id, s]));
    const ownerIds = Array.from(new Set(shopRows.map((s: any) => s.owner_id).filter(Boolean)));

    const [{ data: users }, { data: currentItems }, { data: currentLogins }, { data: previousLogins }, { data: subscriptions }, { data: productUpdatesCurrent }, { data: productUpdatesPrev }] =
      await Promise.all([
        ownerIds.length
          ? supabase.from('users').select('id, name, email, is_active, is_flagged, role').in('id', ownerIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('sale_items')
          .select('id, quantity, unit_price, avg_cost, sale:sales!inner(id,shop_id,created_at,status)')
          .eq('sale.status', 'completed')
          .gte('sale.created_at', currentFromIso)
          .lte('sale.created_at', currentToIso),
        ownerIds.length
          ? supabase
              .from('user_login_history')
              .select('id, user_id, created_at, success')
              .in('user_id', ownerIds)
              .eq('success', true)
              .gte('created_at', currentFromIso)
              .lte('created_at', currentToIso)
          : Promise.resolve({ data: [] as any[] }),
        ownerIds.length
          ? supabase
              .from('user_login_history')
              .select('id, user_id, created_at, success')
              .in('user_id', ownerIds)
              .eq('success', true)
              .gte('created_at', prevFromIso)
              .lte('created_at', prevToIso)
          : Promise.resolve({ data: [] as any[] }),
        ownerIds.length
          ? supabase
              .from('user_subscriptions')
              .select('user_id, plan_code, status, current_period_end')
              .in('user_id', ownerIds)
          : Promise.resolve({ data: [] as any[] }),
        shopRows.length
          ? supabase.from('products').select('id, shop_id, updated_at').in('shop_id', shopRows.map((s: any) => s.id)).gte('updated_at', currentFromIso).lte('updated_at', currentToIso)
          : Promise.resolve({ data: [] as any[] }),
        shopRows.length
          ? supabase.from('products').select('id, shop_id, updated_at').in('shop_id', shopRows.map((s: any) => s.id)).gte('updated_at', prevFromIso).lte('updated_at', prevToIso)
          : Promise.resolve({ data: [] as any[] }),
      ]);

    const userById = new Map((users || []).map((u: any) => [u.id, u]));
    const subsByOwner = new Map((subscriptions || []).map((s: any) => [s.user_id, s]));
    const currSales = currentSales || [];
    const prevSales = previousSales || [];

    const currShopCompleted = new Map<string, { revenue: number; tx: number; cancelled: number }>();
    const prevShopCompleted = new Map<string, { revenue: number; tx: number }>();
    const cashierStats = new Map<string, { tx: number; cancelled: number; revenue: number }>();
    const anomalies: Array<{ severity: 'high' | 'medium'; category: string; summary: string; shopId?: string; userId?: string }> = [];

    for (const row of currSales) {
      const shopId = String((row as any).shop_id || '');
      if (!shopId) continue;
      const bucket = currShopCompleted.get(shopId) || { revenue: 0, tx: 0, cancelled: 0 };
      const status = String((row as any).status || '');
      if (status === 'completed') {
        bucket.tx += 1;
        bucket.revenue += Number((row as any).final_amount || 0);
      } else if (status === 'cancelled') {
        bucket.cancelled += 1;
      }
      currShopCompleted.set(shopId, bucket);

      const cashierId = String((row as any).created_by || '');
      if (cashierId) {
        const c = cashierStats.get(cashierId) || { tx: 0, cancelled: 0, revenue: 0 };
        c.tx += 1;
        if (status === 'cancelled') c.cancelled += 1;
        if (status === 'completed') c.revenue += Number((row as any).final_amount || 0);
        cashierStats.set(cashierId, c);
      }
    }

    for (const row of prevSales) {
      const shopId = String((row as any).shop_id || '');
      if (!shopId) continue;
      const status = String((row as any).status || '');
      if (status !== 'completed') continue;
      const bucket = prevShopCompleted.get(shopId) || { revenue: 0, tx: 0 };
      bucket.tx += 1;
      bucket.revenue += Number((row as any).final_amount || 0);
      prevShopCompleted.set(shopId, bucket);
    }

    for (const [cashierId, stats] of cashierStats.entries()) {
      const cancelRate = stats.tx ? stats.cancelled / stats.tx : 0;
      if (stats.cancelled >= 3 && cancelRate >= 0.25) {
        anomalies.push({
          severity: cancelRate >= 0.4 ? 'high' : 'medium',
          category: 'cashier_cancellation_pattern',
          summary: `${userById.get(cashierId)?.name || cashierId} cancelled ${stats.cancelled}/${stats.tx} sales (${(cancelRate * 100).toFixed(1)}%).`,
          userId: cashierId,
        });
      }
    }

    for (const [shopId, curr] of currShopCompleted.entries()) {
      const prev = prevShopCompleted.get(shopId) || { revenue: 0, tx: 0 };
      if (prev.revenue > 0 && curr.revenue >= prev.revenue * 10) {
        anomalies.push({
          severity: 'high',
          category: 'shop_volume_spike',
          summary: `${shopById.get(shopId)?.name || shopId} revenue spiked ${Math.max(1, curr.revenue / prev.revenue).toFixed(1)}x vs previous period.`,
          shopId,
        });
      }
    }

    const belowCostByShop = new Map<string, number>();
    const profitByShop = new Map<string, number>();
    for (const item of currentItems || []) {
      const sale = (item as any)?.sale;
      const shopId = String(sale?.shop_id || '');
      if (!shopId) continue;
      const quantity = Number((item as any).quantity || 0);
      const unitPrice = Number((item as any).unit_price || 0);
      const avgCost = Number((item as any).avg_cost || 0);
      const lineProfit = (unitPrice - avgCost) * quantity;
      if (Number.isFinite(lineProfit)) {
        profitByShop.set(shopId, (profitByShop.get(shopId) || 0) + lineProfit);
      }
      if (avgCost > 0 && unitPrice < avgCost) {
        belowCostByShop.set(shopId, (belowCostByShop.get(shopId) || 0) + 1);
      }
    }
    for (const [shopId, count] of belowCostByShop.entries()) {
      if (count >= 3) {
        anomalies.push({
          severity: count >= 8 ? 'high' : 'medium',
          category: 'below_cost_sales',
          summary: `${shopById.get(shopId)?.name || shopId} has ${count} line-items sold below recorded cost.`,
          shopId,
        });
      }
    }

    const loginCurrByOwner = new Map<string, number>();
    const loginPrevByOwner = new Map<string, number>();
    for (const l of currentLogins || []) loginCurrByOwner.set(String((l as any).user_id), (loginCurrByOwner.get(String((l as any).user_id)) || 0) + 1);
    for (const l of previousLogins || []) loginPrevByOwner.set(String((l as any).user_id), (loginPrevByOwner.get(String((l as any).user_id)) || 0) + 1);

    const prodCurrByShop = new Map<string, number>();
    const prodPrevByShop = new Map<string, number>();
    for (const p of productUpdatesCurrent || []) prodCurrByShop.set(String((p as any).shop_id), (prodCurrByShop.get(String((p as any).shop_id)) || 0) + 1);
    for (const p of productUpdatesPrev || []) prodPrevByShop.set(String((p as any).shop_id), (prodPrevByShop.get(String((p as any).shop_id)) || 0) + 1);

    const churnRiskShops: Array<{
      shopId: string;
      shopName: string;
      riskLevel: 'high' | 'medium';
      score: number;
      reasons: string[];
    }> = [];

    for (const shop of shopRows) {
      const shopId = String((shop as any).id);
      const ownerId = String((shop as any).owner_id || '');
      const curr = currShopCompleted.get(shopId) || { revenue: 0, tx: 0, cancelled: 0 };
      const prev = prevShopCompleted.get(shopId) || { revenue: 0, tx: 0 };
      const loginCurr = loginCurrByOwner.get(ownerId) || 0;
      const loginPrev = loginPrevByOwner.get(ownerId) || 0;
      const prodCurr = prodCurrByShop.get(shopId) || 0;
      const prodPrev = prodPrevByShop.get(shopId) || 0;

      let score = 0;
      const reasons: string[] = [];
      if (prev.tx >= 8 && curr.tx <= prev.tx * 0.5) {
        score += 45;
        reasons.push('Transaction count dropped sharply.');
      }
      if (loginPrev >= 4 && loginCurr <= loginPrev * 0.5) {
        score += 30;
        reasons.push('Owner login frequency declined.');
      }
      if (prodPrev >= 4 && prodCurr <= prodPrev * 0.5) {
        score += 25;
        reasons.push('Product update activity declined.');
      }

      if (score >= 60) {
        churnRiskShops.push({ shopId, shopName: String((shop as any).name || shopId), riskLevel: 'high', score, reasons });
      } else if (score >= 35) {
        churnRiskShops.push({ shopId, shopName: String((shop as any).name || shopId), riskLevel: 'medium', score, reasons });
      }
    }

    const planRank: Record<string, number> = { small: 1, medium: 2, big: 3, enterprise: 4 };
    const nextPlanByRank: Record<number, string> = { 1: 'medium', 2: 'big', 3: 'enterprise' };
    const upgradeCandidates: Array<{ shopId: string; shopName: string; currentPlan: string; suggestedPlan: string; reason: string }> = [];
    for (const shop of shopRows) {
      const ownerSub = subsByOwner.get(String((shop as any).owner_id || ''));
      const status = String(ownerSub?.status || '');
      const currentPlan = String(ownerSub?.plan_code || '');
      if (status !== 'active' || !planRank[currentPlan]) continue;
      const curr = currShopCompleted.get(String((shop as any).id)) || { revenue: 0, tx: 0, cancelled: 0 };
      const rank = planRank[currentPlan];
      const nextPlan = nextPlanByRank[rank];
      if (!nextPlan) continue;
      const highUsage =
        (rank === 1 && (curr.tx >= 120 || curr.revenue >= 12000)) ||
        (rank === 2 && (curr.tx >= 220 || curr.revenue >= 25000)) ||
        (rank === 3 && (curr.tx >= 400 || curr.revenue >= 45000));
      if (highUsage) {
        upgradeCandidates.push({
          shopId: String((shop as any).id),
          shopName: String((shop as any).name || ''),
          currentPlan,
          suggestedPlan: nextPlan,
          reason: `High usage in period (${curr.tx} transactions, GHS ${curr.revenue.toFixed(2)}).`,
        });
      }
    }

    const timezoneCount = new Map<string, number>();
    for (const s of shopRows) {
      const tz = String((s as any).timezone || 'unknown');
      timezoneCount.set(tz, (timezoneCount.get(tz) || 0) + 1);
    }
    const regionGaps = ['Africa/Accra', 'Africa/Lagos', 'Africa/Nairobi']
      .filter((tz) => !timezoneCount.has(tz))
      .map((tz) => ({ region: tz, note: 'No active shop footprint detected in this timezone cluster.' }));

    const topPerformingShops = Array.from(currShopCompleted.entries())
      .map(([shopId, stats]) => ({
        shopId,
        shopName: String(shopById.get(shopId)?.name || shopId),
        revenue: Number(stats.revenue.toFixed(2)),
        transactions: Number(stats.tx || 0),
        profit: Number((profitByShop.get(shopId) || 0).toFixed(2)),
        avgTicket: Number((stats.tx > 0 ? stats.revenue / stats.tx : 0).toFixed(2)),
      }))
      .sort((a, b) => {
        if (rankBy === 'transactions') {
          return b.transactions === a.transactions ? b.revenue - a.revenue : b.transactions - a.transactions;
        }
        if (rankBy === 'profit') {
          return b.profit === a.profit ? b.revenue - a.revenue : b.profit - a.profit;
        }
        return b.revenue === a.revenue ? b.transactions - a.transactions : b.revenue - a.revenue;
      })
      .slice(0, 10);

    const heuristicPayload = {
      period: {
        current: { from: currentFromIso, to: currentToIso },
        previous: { from: prevFromIso, to: prevToIso },
      },
      overview: {
        shops: shopRows.length,
        transactionsCurrent: currSales.length,
        transactionsPrevious: prevSales.length,
      },
      anomalies: anomalies.slice(0, 25),
      churnRiskShops: churnRiskShops.slice(0, 20),
      growthOpportunities: {
        upgradeCandidates: upgradeCandidates.slice(0, 20),
        regionGaps,
      },
      topPerformingShops,
      topPerformingShopsRankBy: rankBy,
    };

    const prompt = [
      'You are generating AI-powered admin intelligence for ShoopKeeper.',
      'Use this platform data JSON and return STRICT JSON only.',
      'JSON schema:',
      '{',
      '  "anomalyDetection": { "summary": string, "highlights": string[] },',
      '  "churnPrediction": { "summary": string, "warnings": string[] },',
      '  "growthOpportunities": { "summary": string, "alerts": string[] },',
      '  "executiveSummary": string',
      '}',
      'Rules: concise practical language, no markdown, no extra keys.',
      `Data: ${JSON.stringify(heuristicPayload)}`,
    ].join('\n');

    const ai = await this.callClaudeThenOpenAi(prompt);
    const parsed = this.parseAiJson(ai.text);

    return {
      providerUsed: ai.provider,
      period: heuristicPayload.period,
      anomalyDetection: {
        summary: String(parsed?.anomalyDetection?.summary || 'Anomalies detected from platform transaction behavior.'),
        highlights: Array.isArray(parsed?.anomalyDetection?.highlights)
          ? parsed.anomalyDetection.highlights.map((x: any) => String(x))
          : heuristicPayload.anomalies.map((x) => x.summary).slice(0, 6),
      },
      churnPrediction: {
        summary: String(parsed?.churnPrediction?.summary || 'Potential churn risk identified from usage declines.'),
        warnings: Array.isArray(parsed?.churnPrediction?.warnings)
          ? parsed.churnPrediction.warnings.map((x: any) => String(x))
          : heuristicPayload.churnRiskShops.map((x) => `${x.shopName} (${x.riskLevel}) - ${x.reasons.join(' ')}`).slice(0, 6),
      },
      growthOpportunities: {
        summary: String(parsed?.growthOpportunities?.summary || 'Growth opportunities identified from expansion and usage patterns.'),
        alerts: Array.isArray(parsed?.growthOpportunities?.alerts)
          ? parsed.growthOpportunities.alerts.map((x: any) => String(x))
          : [
              ...heuristicPayload.growthOpportunities.upgradeCandidates
                .map((x) => `${x.shopName}: suggest ${x.currentPlan} -> ${x.suggestedPlan}.`)
                .slice(0, 5),
              ...heuristicPayload.growthOpportunities.regionGaps.map((x) => `${x.region}: ${x.note}`).slice(0, 3),
            ],
      },
      topPerformingShopsRankBy: rankBy,
      topPerformingShops: heuristicPayload.topPerformingShops,
      executiveSummary: String(parsed?.executiveSummary || 'Platform health generated using AI with actionable anomaly, churn, and growth insights.'),
      snapshot: heuristicPayload,
    };
  }

  async emailAdminAiExecutiveSummary(actorUserId: string, email?: string) {
    const intelligence = await this.getAdminAiIntelligence();

    let targetEmail = String(email || '').trim();
    if (!targetEmail) {
      const { data: actor } = await supabase.from('users').select('email').eq('id', actorUserId).maybeSingle();
      targetEmail = String(actor?.email || '').trim();
    }
    if (!targetEmail) throw new Error('Recipient email not found');

    const now = new Date();
    const subject = `ShoopKeeper AI Executive Summary - ${now.toISOString().slice(0, 10)}`;
    const text = this.buildExecutiveSummaryEmailText(intelligence);

    const sent = await sendGenericEmail({
      to: targetEmail,
      subject,
      text,
    });
    if (!sent) throw new Error('Failed to send executive summary email');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.ai_intelligence.email_executive_summary',
      entityType: 'platform',
      metadataJson: { recipient: targetEmail, providerUsed: intelligence.providerUsed },
    });

    return {
      sent: true,
      recipient: targetEmail,
      providerUsed: intelligence.providerUsed,
      generatedAt: now.toISOString(),
      mondayAutomationHint: 'Use a scheduler/cron to call this endpoint every Monday morning.',
    };
  }

  async emailAdminAiExecutiveSummaryToActivePlatformAdmins() {
    const intelligence = await this.getAdminAiIntelligence();
    const { data: admins, error: adminError } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('is_active', true);
    if (adminError) throw new Error('Failed to load platform admins for scheduled summary');

    const userIds = Array.from(new Set((admins || []).map((a: any) => a.user_id).filter(Boolean)));
    if (!userIds.length) return { sent: 0, failed: 0, recipients: [] as string[], providerUsed: intelligence.providerUsed };

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds);
    if (usersError) throw new Error('Failed to load admin recipient emails');

    const recipients = Array.from(
      new Set(
        (users || [])
          .map((u: any) => String(u.email || '').trim())
          .filter((v: string) => !!v)
      )
    );
    const subject = `ShoopKeeper AI Executive Summary - ${new Date().toISOString().slice(0, 10)}`;
    const text = this.buildExecutiveSummaryEmailText(intelligence);

    let sent = 0;
    let failed = 0;
    for (const recipient of recipients) {
      const ok = await sendGenericEmail({ to: recipient, subject, text });
      if (ok) sent += 1;
      else failed += 1;
    }

    return { sent, failed, recipients, providerUsed: intelligence.providerUsed };
  }

  async listPlatformAdmins() {
    const { data, error } = await supabase
      .from('platform_admins')
      .select('id, user_id, role, is_active, created_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Failed to fetch platform admins');

    const userIds = (data || []).map((x: any) => x.user_id).filter(Boolean);
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, name, email, is_active').in('id', userIds)
      : { data: [] as any[] };
    const userById = new Map((users || []).map((u: any) => [u.id, u]));

    return (data || []).map((row: any) => ({
      ...row,
      user: userById.get(row.user_id) || null,
    }));
  }

  async grantPlatformAdminByEmail(email: string, role: PlatformAdminRole, actorUserId: string): Promise<AdminActionResult> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const { data: user } = await supabase.from('users').select('id, email, is_active').eq('email', normalizedEmail).maybeSingle();
    if (!user) throw new Error('User not found for this email');

    const { data: before } = await supabase
      .from('platform_admins')
      .select('id, user_id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    const payload = { user_id: user.id, role, is_active: true };
    const { error } = await supabase.from('platform_admins').upsert(payload, { onConflict: 'user_id' });
    if (error) throw new Error('Failed to grant platform admin role');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.platform_admin.grant',
      entityType: 'platform_admin',
      entityId: user.id,
      beforeJson: before || null,
      afterJson: payload,
      metadataJson: { email: normalizedEmail },
    });

    return { success: true, message: `Platform admin role ${role} granted to ${normalizedEmail}.` };
  }

  async updatePlatformAdminRole(targetUserId: string, role: PlatformAdminRole, actorUserId: string): Promise<AdminActionResult> {
    const { data: before } = await supabase
      .from('platform_admins')
      .select('id, user_id, role, is_active')
      .eq('user_id', targetUserId)
      .maybeSingle();
    if (!before) throw new Error('Platform admin not found');

    const after = { role };
    const { error } = await supabase.from('platform_admins').update(after).eq('user_id', targetUserId);
    if (error) throw new Error('Failed to update platform admin role');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.platform_admin.update_role',
      entityType: 'platform_admin',
      entityId: targetUserId,
      beforeJson: before,
      afterJson: after,
    });

    return { success: true, message: `Platform admin role updated to ${role}.` };
  }

  async setPlatformAdminStatus(targetUserId: string, isActive: boolean, actorUserId: string, reason?: string): Promise<AdminActionResult> {
    const { data: before } = await supabase
      .from('platform_admins')
      .select('id, user_id, role, is_active')
      .eq('user_id', targetUserId)
      .maybeSingle();
    if (!before) throw new Error('Platform admin not found');

    const updates = { is_active: isActive };
    const { error } = await supabase.from('platform_admins').update(updates).eq('user_id', targetUserId);
    if (error) throw new Error(`Failed to ${isActive ? 'reactivate' : 'deactivate'} platform admin`);

    await writeAdminAuditLog({
      actorUserId,
      action: isActive ? 'admin.platform_admin.reactivate' : 'admin.platform_admin.deactivate',
      entityType: 'platform_admin',
      entityId: targetUserId,
      beforeJson: before,
      afterJson: updates,
      metadataJson: { reason: reason || null },
    });

    return {
      success: true,
      message: isActive ? 'Platform admin reactivated successfully.' : 'Platform admin deactivated successfully.',
    };
  }

  async listUsers(filters: AdminListUsersFilters) {
    const pg = toPagination(filters.page, filters.limit);
    let query = supabase
      .from('users')
      .select('id, name, email, role, created_at, updated_at, is_active, is_flagged, flagged_reason, force_password_reset', { count: 'exact' });

    const search = sanitizeSearch(filters.search);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    if (filters.role) query = query.eq('role', filters.role);
    if (filters.status === 'active') query = query.eq('is_active', true).eq('is_flagged', false);
    if (filters.status === 'suspended') query = query.eq('is_active', false);
    if (filters.status === 'flagged') query = query.eq('is_flagged', true);
    if (filters.from) query = query.gte('created_at', isoStart(filters.from)!);
    if (filters.to) query = query.lte('created_at', isoEnd(filters.to)!);

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(pg.from, pg.to);
    if (error) throw new Error('Failed to fetch users');

    return {
      items: (data || []).map((u: any) => ({ ...u, status: userStatusFromRow(u) })),
      pagination: toPaginationMeta(pg.page, pg.limit, count || 0),
    };
  }

  async getUserById(id: string) {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at, updated_at, is_active, is_flagged, flagged_reason, force_password_reset, suspended_reason, suspended_at, reactivated_at, flagged_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !user) throw new Error('User not found');

    const [{ count: ownedShops = 0 }, { count: memberShops = 0 }] = await Promise.all([
      supabase.from('shops').select('*', { count: 'exact', head: true }).eq('owner_id', id),
      supabase.from('shop_members').select('*', { count: 'exact', head: true }).eq('user_id', id),
    ]).then((results) => results.map((r) => ({ count: r.count || 0 })));

    return {
      ...user,
      status: userStatusFromRow(user),
      ownedShops,
      memberShops,
    };
  }

  async getUserWorkspace(userId: string, from?: string, to?: string, limit = 100) {
    const safeLimit = Math.max(1, Math.min(300, Number(limit || 100)));

    const { data: ownedShops, error: shopsError } = await supabase
      .from('shops')
      .select('id, name, is_active, currency, timezone, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (shopsError) throw new Error('Failed to fetch owned shops');

    const shopIds = (ownedShops || []).map((s: any) => s.id);
    if (!shopIds.length) {
      return {
        ownedShops: [],
        managedUsers: [],
        sales: [],
        dailySales: [],
      };
    }

    const [memberships, salesRes] = await Promise.all([
      supabase
        .from('shop_members')
        .select('shop_id, user_id, role, created_at')
        .in('shop_id', shopIds),
      (async () => {
        let q = supabase
          .from('sales')
          .select('id, shop_id, sale_number, final_amount, payment_method, status, created_at, created_by')
          .in('shop_id', shopIds)
          .order('created_at', { ascending: false })
          .limit(safeLimit);
        if (from) q = q.gte('created_at', isoStart(from)!);
        if (to) q = q.lte('created_at', isoEnd(to)!);
        return q;
      })(),
    ]);

    const uniqueUserIds = Array.from(new Set((memberships.data || []).map((m: any) => m.user_id).filter(Boolean)));
    const { data: users } = uniqueUserIds.length
      ? await supabase.from('users').select('id, name, email, role, is_active, is_flagged, created_at').in('id', uniqueUserIds)
      : { data: [] as any[] };
    const userById = new Map((users || []).map((u: any) => [u.id, u]));

    const managedUsers = (memberships.data || []).map((m: any) => {
      const u = userById.get(m.user_id);
      return {
        shopId: m.shop_id,
        userId: m.user_id,
        memberRole: m.role,
        linkedAt: m.created_at,
        user: u
          ? {
              ...u,
              status: userStatusFromRow(u),
            }
          : null,
      };
    });

    const sales = salesRes.data || [];
    const shopNameById = new Map((ownedShops || []).map((s: any) => [s.id, s.name]));
    const actorNameById = new Map((users || []).map((u: any) => [u.id, u.name || u.email || 'Unknown']));
    const dailyMap = new Map<string, { date: string; count: number; revenue: number }>();

    for (const s of sales) {
      const date = String((s as any).created_at || '').slice(0, 10);
      const current = dailyMap.get(date) || { date, count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number((s as any).final_amount || 0);
      dailyMap.set(date, current);
    }

    return {
      ownedShops: ownedShops || [],
      managedUsers,
      sales: sales.map((s: any) => ({
        ...s,
        shop_name: shopNameById.get(s.shop_id) || 'Unknown shop',
        actor_name: actorNameById.get(s.created_by) || 'Unknown user',
      })),
      dailySales: Array.from(dailyMap.values())
        .map((d) => ({ ...d, revenue: Number(d.revenue.toFixed(2)) }))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    };
  }

  async suspendUser(targetUserId: string, actorUserId: string, reason?: string): Promise<AdminActionResult> {
    const { data: before } = await supabase
      .from('users')
      .select('id, is_active, suspended_reason, suspended_at')
      .eq('id', targetUserId)
      .maybeSingle();
    if (!before) throw new Error('User not found');

    const now = new Date().toISOString();
    const updates = { is_active: false, suspended_reason: reason || null, suspended_at: now, reactivated_at: null, updated_at: now };
    const { error } = await supabase.from('users').update(updates).eq('id', targetUserId);
    if (error) throw new Error('Failed to suspend user');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.user.suspend',
      entityType: 'user',
      entityId: targetUserId,
      beforeJson: before,
      afterJson: updates,
      metadataJson: { reason: reason || null },
    });

    return { success: true, message: 'User suspended successfully.' };
  }

  async reactivateUser(targetUserId: string, actorUserId: string): Promise<AdminActionResult> {
    const { data: before } = await supabase
      .from('users')
      .select('id, is_active, suspended_reason, suspended_at, reactivated_at')
      .eq('id', targetUserId)
      .maybeSingle();
    if (!before) throw new Error('User not found');

    const now = new Date().toISOString();
    const updates = { is_active: true, suspended_reason: null, reactivated_at: now, updated_at: now };
    const { error } = await supabase.from('users').update(updates).eq('id', targetUserId);
    if (error) throw new Error('Failed to reactivate user');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.user.reactivate',
      entityType: 'user',
      entityId: targetUserId,
      beforeJson: before,
      afterJson: updates,
    });

    return { success: true, message: 'User reactivated successfully.' };
  }

  async forcePasswordReset(targetUserId: string, actorUserId: string): Promise<AdminActionResult> {
    const { data: before } = await supabase
      .from('users')
      .select('id, force_password_reset')
      .eq('id', targetUserId)
      .maybeSingle();
    if (!before) throw new Error('User not found');

    const updates = { force_password_reset: true, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('users').update(updates).eq('id', targetUserId);
    if (error) throw new Error('Failed to force password reset');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.user.force_password_reset',
      entityType: 'user',
      entityId: targetUserId,
      beforeJson: before,
      afterJson: updates,
    });

    return { success: true, message: 'User will be prompted to reset password on next sign-in.' };
  }

  async getUserLoginHistory(userId: string, page = 1, limit = 20) {
    const pg = toPagination(page, limit);
    const { data, count, error } = await supabase
      .from('user_login_history')
      .select('id, user_id, ip_address, user_agent, success, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(pg.from, pg.to);
    if (error) throw new Error('Failed to fetch login history');

    return {
      items: data || [],
      pagination: toPaginationMeta(pg.page, pg.limit, count || 0),
    };
  }

  async flagUser(targetUserId: string, actorUserId: string, reason: string): Promise<AdminActionResult> {
    const { data: before } = await supabase
      .from('users')
      .select('id, is_flagged, flagged_reason, flagged_at')
      .eq('id', targetUserId)
      .maybeSingle();
    if (!before) throw new Error('User not found');

    const updates = {
      is_flagged: true,
      flagged_reason: reason,
      flagged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('users').update(updates).eq('id', targetUserId);
    if (error) throw new Error('Failed to flag user');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.user.flag',
      entityType: 'user',
      entityId: targetUserId,
      beforeJson: before,
      afterJson: updates,
      metadataJson: { reason },
    });

    return { success: true, message: 'User flagged for review.' };
  }

  async cancelSaleFromUserWorkspace(ownerUserId: string, saleId: string, actorUserId: string): Promise<AdminActionResult> {
    const { data: sale, error } = await supabase
      .from('sales')
      .select('id, shop_id, sale_number, status, created_by, shop:shops!inner(owner_id)')
      .eq('id', saleId)
      .maybeSingle();
    if (error || !sale) throw new Error('Sale not found');

    const ownerId = String((sale as any)?.shop?.owner_id || '');
    const createdBy = String((sale as any)?.created_by || '');
    if (ownerId !== ownerUserId && createdBy !== ownerUserId) {
      throw new Error('Sale is outside this user context');
    }

    await salesService.cancelSale(saleId, (sale as any).shop_id, actorUserId);

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.sale.cancel',
      entityType: 'sale',
      entityId: saleId,
      metadataJson: {
        ownerUserId,
        shopId: (sale as any).shop_id,
        saleNumber: (sale as any).sale_number,
      },
    });

    return { success: true, message: 'Sale cancelled successfully.' };
  }

  async deleteManagedUserAccess(ownerUserId: string, targetUserId: string, actorUserId: string): Promise<AdminActionResult> {
    if (ownerUserId === targetUserId) {
      throw new Error('You cannot delete the owner from their own workspace');
    }

    const { data: ownedShops, error: shopsError } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', ownerUserId);
    if (shopsError) throw new Error('Failed to fetch owner shops');
    const shopIds = (ownedShops || []).map((s: any) => s.id);
    if (!shopIds.length) throw new Error('Owner has no shops');

    const { data: links, error: linksError } = await supabase
      .from('shop_members')
      .select('id, shop_id')
      .eq('user_id', targetUserId)
      .in('shop_id', shopIds);
    if (linksError) throw new Error('Failed to validate managed user membership');
    if (!links?.length) throw new Error('Target user is not under this owner');

    const { error: deleteError } = await supabase
      .from('shop_members')
      .delete()
      .eq('user_id', targetUserId)
      .in('shop_id', shopIds);
    if (deleteError) throw new Error('Failed to delete managed user membership');

    const { count: remainingMemberships = 0 } = await supabase
      .from('shop_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    if ((remainingMemberships || 0) === 0) {
      await supabase
        .from('users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);
    }

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.user.delete_managed_access',
      entityType: 'user',
      entityId: targetUserId,
      metadataJson: {
        ownerUserId,
        removedShopIds: shopIds,
        remainingMemberships: remainingMemberships || 0,
      },
    });

    return { success: true, message: 'Managed user removed from owner workspace.' };
  }

  async listGlobalTransactions(filters: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    shopId?: string;
    cashierUserId?: string;
    paymentMethod?: string;
    status?: string;
    search?: string;
  }) {
    const pg = toPagination(filters.page, filters.limit);
    let query = supabase
      .from('sales')
      .select('id, shop_id, sale_number, final_amount, payment_method, status, created_at, created_by', { count: 'exact' });

    if (filters.from) query = query.gte('created_at', isoStart(filters.from)!);
    if (filters.to) query = query.lte('created_at', isoEnd(filters.to)!);
    if (filters.shopId) query = query.eq('shop_id', filters.shopId);
    if (filters.cashierUserId) query = query.eq('created_by', filters.cashierUserId);
    if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) query = query.ilike('sale_number', `%${sanitizeSearch(filters.search)}%`);

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(pg.from, pg.to);
    if (error) throw new Error('Failed to fetch global transactions');

    const rows = data || [];
    const shopIds = Array.from(new Set(rows.map((r: any) => r.shop_id).filter(Boolean)));
    const cashierIds = Array.from(new Set(rows.map((r: any) => r.created_by).filter(Boolean)));

    const [shops, cashiers] = await Promise.all([
      shopIds.length ? supabase.from('shops').select('id, name, owner_id').in('id', shopIds) : Promise.resolve({ data: [] as any[] }),
      cashierIds.length
        ? supabase.from('users').select('id, name, email, is_active, is_flagged, role').in('id', cashierIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const shopById = new Map((shops.data || []).map((s: any) => [s.id, s]));
    const cashierById = new Map((cashiers.data || []).map((u: any) => [u.id, u]));

    return {
      items: rows.map((r: any) => ({
        ...r,
        shopName: shopById.get(r.shop_id)?.name || 'Unknown shop',
        ownerId: shopById.get(r.shop_id)?.owner_id || null,
        cashier: cashierById.get(r.created_by) || null,
      })),
      pagination: toPaginationMeta(pg.page, pg.limit, count || 0),
    };
  }

  async getCashierInsights(from?: string, to?: string) {
    let query = supabase
      .from('sales')
      .select('id, shop_id, final_amount, status, created_at, created_by')
      .not('created_by', 'is', null);
    if (from) query = query.gte('created_at', isoStart(from)!);
    if (to) query = query.lte('created_at', isoEnd(to)!);

    const { data, error } = await query;
    if (error) throw new Error('Failed to fetch cashier insights');
    const rows = data || [];

    const byCashier = new Map<
      string,
      {
        cashierUserId: string;
        transactionCount: number;
        completedCount: number;
        cancelledCount: number;
        revenue: number;
        shopIds: Set<string>;
      }
    >();

    for (const row of rows) {
      const cashierId = String((row as any).created_by || '');
      if (!cashierId) continue;
      const current = byCashier.get(cashierId) || {
        cashierUserId: cashierId,
        transactionCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        revenue: 0,
        shopIds: new Set<string>(),
      };
      current.transactionCount += 1;
      if (String((row as any).status || '') === 'completed') {
        current.completedCount += 1;
        current.revenue += Number((row as any).final_amount || 0);
      }
      if (String((row as any).status || '') === 'cancelled') {
        current.cancelledCount += 1;
      }
      if ((row as any).shop_id) current.shopIds.add(String((row as any).shop_id));
      byCashier.set(cashierId, current);
    }

    const cashierIds = Array.from(byCashier.keys());
    const { data: users } = cashierIds.length
      ? await supabase.from('users').select('id, name, email, is_active, is_flagged, role').in('id', cashierIds)
      : { data: [] as any[] };
    const userById = new Map((users || []).map((u: any) => [u.id, u]));

    const avgTicketAcrossAll =
      Array.from(byCashier.values()).reduce((sum, x) => sum + (x.completedCount ? x.revenue / x.completedCount : 0), 0) /
      Math.max(1, byCashier.size);

    return Array.from(byCashier.values())
      .map((c) => {
        const avgTicket = c.completedCount ? c.revenue / c.completedCount : 0;
        const cancelRate = c.transactionCount ? c.cancelledCount / c.transactionCount : 0;
        const signals: string[] = [];
        if (cancelRate >= 0.25 && c.cancelledCount >= 2) signals.push('High cancellation rate');
        if (avgTicketAcrossAll > 0 && avgTicket < avgTicketAcrossAll * 0.55 && c.completedCount >= 5) {
          signals.push('Low average ticket size');
        }
        if (c.completedCount <= 1 && c.transactionCount >= 6) signals.push('Very low completion rate');
        if ((userById.get(c.cashierUserId) as any)?.is_flagged) signals.push('User account already flagged');

        return {
          cashierUserId: c.cashierUserId,
          cashierName: userById.get(c.cashierUserId)?.name || userById.get(c.cashierUserId)?.email || 'Unknown user',
          cashierEmail: userById.get(c.cashierUserId)?.email || null,
          userStatus: userStatusFromRow(userById.get(c.cashierUserId)),
          role: userById.get(c.cashierUserId)?.role || null,
          shopCount: c.shopIds.size,
          transactionCount: c.transactionCount,
          completedCount: c.completedCount,
          cancelledCount: c.cancelledCount,
          cancelRate: Number((cancelRate * 100).toFixed(2)),
          revenue: Number(c.revenue.toFixed(2)),
          avgTicket: Number(avgTicket.toFixed(2)),
          riskLevel: signals.length >= 2 ? 'high' : signals.length === 1 ? 'medium' : 'low',
          signals,
        };
      })
      .sort((a, b) => {
        if (a.riskLevel === b.riskLevel) return b.transactionCount - a.transactionCount;
        if (a.riskLevel === 'high') return -1;
        if (b.riskLevel === 'high') return 1;
        if (a.riskLevel === 'medium') return -1;
        if (b.riskLevel === 'medium') return 1;
        return 0;
      });
  }

  async cancelSaleGlobal(saleId: string, actorUserId: string): Promise<AdminActionResult> {
    const { data: sale, error } = await supabase.from('sales').select('id, shop_id, sale_number, status').eq('id', saleId).maybeSingle();
    if (error || !sale) throw new Error('Sale not found');
    await salesService.cancelSale(saleId, String((sale as any).shop_id), actorUserId);

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.transactions.cancel_sale',
      entityType: 'sale',
      entityId: saleId,
      metadataJson: { shopId: (sale as any).shop_id, saleNumber: (sale as any).sale_number },
    });

    return { success: true, message: 'Sale cancelled successfully.' };
  }

  async revokeWorkerAccess(targetUserId: string, actorUserId: string, shopId?: string): Promise<AdminActionResult> {
    const { data: targetUser, error: userErr } = await supabase
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('id', targetUserId)
      .maybeSingle();
    if (userErr || !targetUser) throw new Error('Target user not found');
    if (String(targetUser.role || '') === 'owner') throw new Error('Owner access cannot be revoked from worker endpoint');

    let linksQuery = supabase.from('shop_members').select('id, shop_id, role').eq('user_id', targetUserId);
    if (shopId) linksQuery = linksQuery.eq('shop_id', shopId);
    const { data: links, error: linksErr } = await linksQuery;
    if (linksErr) throw new Error('Failed to load worker memberships');
    if (!links?.length) throw new Error('No worker membership found for this user');

    let deleteQuery = supabase.from('shop_members').delete().eq('user_id', targetUserId);
    if (shopId) deleteQuery = deleteQuery.eq('shop_id', shopId);
    const { error: deleteErr } = await deleteQuery;
    if (deleteErr) throw new Error('Failed to revoke worker access');

    await supabase
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', targetUserId);

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.workers.revoke_access',
      entityType: 'user',
      entityId: targetUserId,
      metadataJson: {
        targetEmail: targetUser.email,
        targetRole: targetUser.role,
        shopId: shopId || null,
        membershipsRemoved: links.length,
      },
    });

    return { success: true, message: 'Worker access revoked successfully.' };
  }

  async listShops(filters: AdminListShopsFilters) {
    const pg = toPagination(filters.page, filters.limit);
    const search = sanitizeSearch(filters.search);
    let planOwnerIds: string[] | null = null;
    if (filters.plan) {
      const { data: subs, error: subsError } = await supabase
        .from('user_subscriptions')
        .select('user_id, current_period_end')
        .eq('plan_code', filters.plan)
        .eq('status', 'active');
      if (subsError) throw new Error('Failed to filter shops by plan');
      const nowIso = new Date().toISOString();
      planOwnerIds = (subs || [])
        .filter((s: any) => !s.current_period_end || String(s.current_period_end) > nowIso)
        .map((s: any) => s.user_id)
        .filter(Boolean);
      if (!planOwnerIds.length) {
        return { items: [], pagination: toPaginationMeta(pg.page, pg.limit, 0) };
      }
    }

    let query = supabase.from('shops').select('id, name, owner_id, currency, timezone, is_active, created_at', { count: 'exact' });
    if (search) query = query.ilike('name', `%${search}%`);
    if (typeof filters.active === 'boolean') query = query.eq('is_active', filters.active);
    if (planOwnerIds) query = query.in('owner_id', planOwnerIds);

    const { data: shops, count, error } = await query.order('created_at', { ascending: false }).range(pg.from, pg.to);
    if (error) throw new Error('Failed to fetch shops');

    const shopIds = (shops || []).map((s: any) => s.id);
    const ownerIds = Array.from(new Set((shops || []).map((s: any) => s.owner_id).filter(Boolean)));
    const [kpiRes, subsRes] = await Promise.all([
      shopIds.length
        ? supabase.from('v_admin_shop_kpis').select('shop_id, total_sales_volume, transaction_count, products_listed, last_transaction_at').in('shop_id', shopIds)
        : Promise.resolve({ data: [] as any[] }),
      ownerIds.length
        ? supabase
            .from('user_subscriptions')
            .select('user_id, plan_code, status, billing_cycle, current_period_start, current_period_end')
            .in('user_id', ownerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const kpiByShopId = new Map((kpiRes.data || []).map((k: any) => [k.shop_id, k]));
    const subByOwnerId = new Map((subsRes.data || []).map((s: any) => [s.user_id, s]));

    return {
      items: (shops || []).map((s: any) => ({
        ...s,
        plan: (() => {
          const subscription = toSubscriptionSnapshot(subByOwnerId.get(s.owner_id));
          return subscription.isActive ? subscription.planCode : null;
        })(),
        subscription: toSubscriptionSnapshot(subByOwnerId.get(s.owner_id)),
        kpis: kpiByShopId.get(s.id) || {
          total_sales_volume: 0,
          transaction_count: 0,
          products_listed: 0,
          last_transaction_at: null,
        },
      })),
      pagination: toPaginationMeta(pg.page, pg.limit, count || 0),
    };
  }

  async getShopById(shopId: string) {
    const { data: shop, error } = await supabase
      .from('shops')
      .select('id, name, description, address, phone, email, owner_id, currency, timezone, logo_url, is_active, created_at, updated_at')
      .eq('id', shopId)
      .maybeSingle();
    if (error || !shop) throw new Error('Shop not found');

    const [kpi, owner, subscription] = await Promise.all([
      supabase.from('v_admin_shop_kpis').select('*').eq('shop_id', shopId).maybeSingle(),
      supabase.from('users').select('id, name, email, is_active, is_flagged').eq('id', shop.owner_id).maybeSingle(),
      supabase
        .from('user_subscriptions')
        .select('user_id, plan_code, status, billing_cycle, current_period_start, current_period_end')
        .eq('user_id', shop.owner_id)
        .maybeSingle(),
    ]);
    const subscriptionSnapshot = toSubscriptionSnapshot(subscription.data);

    return {
      ...shop,
      plan: subscriptionSnapshot.isActive ? subscriptionSnapshot.planCode : null,
      subscription: subscriptionSnapshot,
      owner: owner.data || null,
      kpis: kpi.data || null,
    };
  }

  async suspendShop(shopId: string, actorUserId: string): Promise<AdminActionResult> {
    const { data: before } = await supabase.from('shops').select('id, is_active').eq('id', shopId).maybeSingle();
    if (!before) throw new Error('Shop not found');

    const updates = { is_active: false, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('shops').update(updates).eq('id', shopId);
    if (error) throw new Error('Failed to suspend shop');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.shop.suspend',
      entityType: 'shop',
      entityId: shopId,
      beforeJson: before,
      afterJson: updates,
    });

    return { success: true, message: 'Shop suspended successfully.' };
  }

  async reactivateShop(shopId: string, actorUserId: string): Promise<AdminActionResult> {
    const { data: before } = await supabase.from('shops').select('id, is_active').eq('id', shopId).maybeSingle();
    if (!before) throw new Error('Shop not found');

    const updates = { is_active: true, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('shops').update(updates).eq('id', shopId);
    if (error) throw new Error('Failed to reactivate shop');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.shop.reactivate',
      entityType: 'shop',
      entityId: shopId,
      beforeJson: before,
      afterJson: updates,
    });

    return { success: true, message: 'Shop reactivated successfully.' };
  }

  async assignShopPlan(shopId: string, plan: ShopAdminPlan, actorUserId: string): Promise<AdminActionResult> {
    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.shop.assign_plan.blocked',
      entityType: 'shop',
      entityId: shopId,
      metadataJson: {
        attemptedPlan: plan,
        reason: 'Plan is now sourced from owner account subscription (user_subscriptions).',
      },
    });

    return {
      success: false,
      message:
        'Plan updates are managed by the account subscription flow. Ask the owner account to subscribe or renew from the Subscription page.',
    };
  }

  async getShopDrilldown(shopId: string) {
    const [shop, kpi, recentSales, membersCount, recentProducts] = await Promise.all([
      this.getShopById(shopId),
      supabase.from('v_admin_shop_kpis').select('*').eq('shop_id', shopId).maybeSingle(),
      supabase.from('sales').select('id, sale_number, final_amount, payment_method, status, created_at, created_by').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(20),
      supabase.from('shop_members').select('*', { count: 'exact', head: true }).eq('shop_id', shopId),
      supabase
        .from('products')
        .select('id, name, stock_quantity, min_stock_level, selling_price, is_active')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(20),
    ]);

    return {
      shop,
      kpis: kpi.data || null,
      membersCount: membersCount.count || 0,
      recentSales: recentSales.data || [],
      productsSnapshot: recentProducts.data || [],
    };
  }

  async getAnalyticsOverview() {
    const [activeShops, activeUsers, salesAgg] = await Promise.all([
      supabase.from('shops').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('sales').select('id, final_amount').eq('status', 'completed'),
    ]);

    const totalRevenueProcessed = Number((salesAgg.data || []).reduce((sum: number, s: any) => sum + Number(s.final_amount || 0), 0).toFixed(2));

    return {
      activeShops: activeShops.count || 0,
      activeUsers: activeUsers.count || 0,
      transactionVolume: (salesAgg.data || []).length,
      revenueProcessed: totalRevenueProcessed,
    };
  }

  async getAnalyticsGrowth(days = 30) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - Math.max(7, Math.min(365, Number(days || 30))));
    const startDate = start.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('v_admin_platform_daily_metrics')
      .select('*')
      .gte('metric_date', startDate)
      .order('metric_date', { ascending: true });
    if (error) throw new Error('Failed to fetch platform growth metrics');

    return data || [];
  }

  async getTopProducts(days = 30, limit = 10) {
    const daysBack = Math.max(7, Math.min(365, Number(days || 30)));
    const topLimit = Math.max(1, Math.min(50, Number(limit || 10)));
    const startIso = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    const { data: sales, error: salesErr } = await supabase.from('sales').select('id').eq('status', 'completed').gte('created_at', startIso);
    if (salesErr) throw new Error('Failed to compute top products');

    const saleIds = (sales || []).map((s: any) => s.id);
    if (!saleIds.length) return [];

    const { data: items, error: itemsErr } = await supabase.from('sale_items').select('product_id, quantity, total_price').in('sale_id', saleIds);
    if (itemsErr) throw new Error('Failed to compute top products');

    const agg = new Map<string, { quantity: number; revenue: number }>();
    for (const row of items || []) {
      const pid = String((row as any).product_id || '');
      if (!pid) continue;
      const current = agg.get(pid) || { quantity: 0, revenue: 0 };
      current.quantity += Number((row as any).quantity || 0);
      current.revenue += Number((row as any).total_price || 0);
      agg.set(pid, current);
    }

    const sorted = Array.from(agg.entries())
      .map(([productId, m]) => ({ productId, quantity: m.quantity, revenue: Number(m.revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, topLimit);

    const productIds = sorted.map((x) => x.productId);
    const { data: products } = await supabase.from('products').select('id, name').in('id', productIds);
    const names = new Map((products || []).map((p: any) => [p.id, p.name]));

    return sorted.map((row) => ({ ...row, name: names.get(row.productId) || 'Unknown product' }));
  }

  async getPeakHours(days = 30) {
    const daysBack = Math.max(7, Math.min(365, Number(days || 30)));
    const startIso = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('sales').select('created_at, final_amount').eq('status', 'completed').gte('created_at', startIso);
    if (error) throw new Error('Failed to fetch peak-hour metrics');

    const byHour: Record<number, { txCount: number; revenue: number }> = {};
    for (let h = 0; h < 24; h += 1) byHour[h] = { txCount: 0, revenue: 0 };
    (data || []).forEach((row: any) => {
      const hour = Number(new Date(row.created_at).getHours());
      byHour[hour].txCount += 1;
      byHour[hour].revenue += Number(row.final_amount || 0);
    });

    return Object.entries(byHour)
      .map(([hour, v]) => ({ hour: Number(hour), txCount: v.txCount, revenue: Number(v.revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async getSecurityThreatDashboard(filters: AdminSecurityThreatsFilters) {
    const windowHours = Math.max(1, Math.min(720, Number(filters.hours || 24)));
    const startIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    const [{ data: loginRows }, { data: allSessions }] = await Promise.all([
      supabase.from('user_login_history').select('user_id, ip_address, user_agent, success, created_at').gte('created_at', startIso),
      supabase.from('platform_sessions').select('user_id, ip_address, user_agent, is_active, last_seen_at').eq('is_active', true).order('last_seen_at', { ascending: false }).limit(1000),
    ]);

    const rows = loginRows || [];
    const failed = rows.filter((r: any) => r.success === false);
    const successful = rows.filter((r: any) => r.success === true);
    const userIpSet = new Map<string, Set<string>>();
    const userUaSet = new Map<string, Set<string>>();
    const ipUsers = new Map<string, Set<string>>();
    const failedByIp = new Map<string, number>();

    for (const r of rows) {
      const uid = String((r as any).user_id || '');
      const ip = String((r as any).ip_address || '').trim();
      const ua = String((r as any).user_agent || '').trim();
      if (!uid) continue;
      if (!userIpSet.has(uid)) userIpSet.set(uid, new Set<string>());
      if (!userUaSet.has(uid)) userUaSet.set(uid, new Set<string>());
      if (ip) userIpSet.get(uid)!.add(ip);
      if (ua) userUaSet.get(uid)!.add(ua);
      if (ip) {
        if (!ipUsers.has(ip)) ipUsers.set(ip, new Set<string>());
        ipUsers.get(ip)!.add(uid);
      }
      if ((r as any).success === false && ip) failedByIp.set(ip, (failedByIp.get(ip) || 0) + 1);
    }

    const unusualUserIds = Array.from(userIpSet.entries())
      .filter(([uid, ips]) => ips.size >= 3 || (userUaSet.get(uid)?.size || 0) >= 3)
      .map(([uid]) => uid);
    const { data: unusualUsers } = unusualUserIds.length
      ? await supabase.from('users').select('id, name, email').in('id', unusualUserIds)
      : { data: [] as any[] };
    const unusualUserMap = new Map((unusualUsers || []).map((u: any) => [u.id, u]));

    const unusualAccesses = unusualUserIds.slice(0, 30).map((uid) => ({
      userId: uid,
      name: String(unusualUserMap.get(uid)?.name || uid),
      email: String(unusualUserMap.get(uid)?.email || ''),
      distinctIpCount: userIpSet.get(uid)?.size || 0,
      distinctDeviceCount: userUaSet.get(uid)?.size || 0,
      signal: 'Multiple distinct IP/device signatures in analysis window.',
    }));

    const sharedIps = Array.from(ipUsers.entries())
      .filter(([_, users]) => users.size >= 2)
      .map(([ipAddress, users]) => ({ ipAddress, userCount: users.size }))
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 20);

    const bruteForceIps = Array.from(failedByIp.entries())
      .filter(([_, failedAttempts]) => failedAttempts >= 10)
      .map(([ipAddress, failedAttempts]) => ({ ipAddress, failedAttempts }))
      .sort((a, b) => b.failedAttempts - a.failedAttempts)
      .slice(0, 20);

    const activeSessionsByIp = new Map<string, number>();
    for (const s of allSessions || []) {
      const ip = String((s as any).ip_address || '').trim();
      if (ip) activeSessionsByIp.set(ip, (activeSessionsByIp.get(ip) || 0) + 1);
    }

    return {
      windowHours,
      generatedAt: new Date().toISOString(),
      totals: {
        failedLoginAttempts: failed.length,
        successfulLogins: successful.length,
        activeSessions: (allSessions || []).length,
      },
      unusualAccesses,
      sharedIps,
      bruteForceIps,
      activeSessionIpHotspots: Array.from(activeSessionsByIp.entries())
        .map(([ipAddress, sessionCount]) => ({ ipAddress, sessionCount }))
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, 15),
    };
  }

  async listPlatformSessions(filters: AdminSecuritySessionsFilters) {
    const pg = toPagination(filters.page, filters.limit);
    let query = supabase
      .from('platform_sessions')
      .select('id, user_id, ip_address, user_agent, device_fingerprint, is_active, created_at, last_seen_at, expires_at, terminated_at', {
        count: 'exact',
      });
    if (filters.activeOnly !== false) query = query.eq('is_active', true);

    const { data, count, error } = await query.order('last_seen_at', { ascending: false }).range(pg.from, pg.to);
    if (error) throw new Error('Failed to fetch platform sessions');

    const rows = data || [];
    const userIds = Array.from(new Set(rows.map((r: any) => String(r.user_id || '')).filter(Boolean)));
    const { data: users } = userIds.length ? await supabase.from('users').select('id, name, email').in('id', userIds) : { data: [] as any[] };
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));
    const search = sanitizeSearch(filters.search || '').toLowerCase();

    const decorated = rows
      .map((s: any) => {
        const u = userMap.get(String(s.user_id));
        return {
          ...s,
          user: u ? { id: u.id, name: u.name, email: u.email } : null,
          activeForMinutes: Math.max(0, Math.round((Date.now() - new Date(String(s.created_at)).getTime()) / 60000)),
        };
      })
      .filter((s: any) => {
        if (!search) return true;
        const hay = [String(s?.user?.name || ''), String(s?.user?.email || ''), String(s?.ip_address || ''), String(s?.user_agent || ''), String(s?.device_fingerprint || '')]
          .join(' ')
          .toLowerCase();
        return hay.includes(search);
      });

    return {
      items: decorated,
      pagination: toPaginationMeta(pg.page, pg.limit, count || 0),
    };
  }

  async terminatePlatformSession(sessionId: string, actorUserId: string, reason?: string): Promise<AdminActionResult> {
    const { data: existing } = await supabase.from('platform_sessions').select('id, user_id, is_active').eq('id', sessionId).maybeSingle();
    if (!existing) throw new Error('Session not found');

    const { error } = await supabase
      .from('platform_sessions')
      .update({
        is_active: false,
        terminated_at: new Date().toISOString(),
        terminated_reason: reason || 'Terminated by super admin',
        terminated_by_user_id: actorUserId,
      })
      .eq('id', sessionId);
    if (error) throw new Error('Failed to terminate session');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.security.terminate_session',
      entityType: 'platform_session',
      entityId: sessionId,
      metadataJson: { reason: reason || null, targetUserId: existing.user_id },
    });

    return { success: true, message: 'Session terminated successfully' };
  }

  async listApiAccessLogs(filters: AdminApiAccessLogsFilters) {
    const pg = toPagination(filters.page, filters.limit);
    let query = supabase
      .from('admin_api_access_logs')
      .select('id, actor_user_id, method, path, status_code, ip_address, user_agent, query_json, duration_ms, created_at', { count: 'exact' });
    if (filters.from) query = query.gte('created_at', isoStart(filters.from)!);
    if (filters.to) query = query.lte('created_at', isoEnd(filters.to)!);
    if (filters.actorUserId) query = query.eq('actor_user_id', filters.actorUserId);
    if (filters.path) query = query.ilike('path', `%${sanitizeSearch(filters.path)}%`);
    if (filters.method) query = query.eq('method', String(filters.method).toUpperCase());
    if (filters.statusCode) query = query.eq('status_code', filters.statusCode);

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(pg.from, pg.to);
    if (error) throw new Error('Failed to fetch API access logs');

    const rows = data || [];
    const userIds = Array.from(new Set(rows.map((r: any) => String(r.actor_user_id || '')).filter(Boolean)));
    const { data: users } = userIds.length ? await supabase.from('users').select('id, name, email').in('id', userIds) : { data: [] as any[] };
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    return {
      items: rows.map((r: any) => ({
        ...r,
        actor: r.actor_user_id ? userMap.get(String(r.actor_user_id)) || null : null,
      })),
      pagination: toPaginationMeta(pg.page, pg.limit, count || 0),
    };
  }

  async executeGdprUserDeletion(targetUserId: string, actorUserId: string, reason?: string): Promise<AdminActionResult> {
    if (targetUserId === actorUserId) throw new Error('You cannot delete your own account from this endpoint');

    const { data: targetUser } = await supabase.from('users').select('id').eq('id', targetUserId).maybeSingle();
    if (!targetUser) throw new Error('Target user not found');

    const { data: platformAdmin } = await supabase
      .from('platform_admins')
      .select('user_id, is_active')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .maybeSingle();
    if (platformAdmin) throw new Error('Cannot GDPR-delete an active platform admin account');

    const { data: reqRow } = await supabase
      .from('gdpr_deletion_requests')
      .insert({
        user_id: targetUserId,
        requested_by_user_id: actorUserId,
        reason: reason || null,
        status: 'pending',
      })
      .select('id')
      .single();

    const requestId = String(reqRow?.id || '');
    const summary: Record<string, number> = {};

    try {
      const doDelete = async (table: string, column: string, value: string) => {
        const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq(column, value);
        if (error) throw new Error(`Failed deleting ${table}`);
        summary[table] = (summary[table] || 0) + Number(count || 0);
      };

      const doDeleteMany = async (table: string, column: string, values: string[]) => {
        if (!values.length) return;
        const { error, count } = await supabase.from(table).delete({ count: 'exact' }).in(column, values);
        if (error) throw new Error(`Failed deleting ${table}`);
        summary[table] = (summary[table] || 0) + Number(count || 0);
      };

      const deleteUserScopedData = async (userId: string) => {
        await doDelete('admin_api_access_logs', 'actor_user_id', userId);
        await doDelete('platform_sessions', 'user_id', userId);
        await doDelete('user_login_history', 'user_id', userId);
        await doDelete('user_security_policies', 'user_id', userId);
        await doDelete('platform_admins', 'user_id', userId);
        await doDelete('user_subscriptions', 'user_id', userId);
        await doDelete('shop_members', 'user_id', userId);
      };

      // Gather all shops owned by target user so we can delete "anything under that account".
      const { data: ownedShops } = await supabase.from('shops').select('id').eq('owner_id', targetUserId);
      const ownedShopIds = (ownedShops || []).map((s: any) => String(s.id)).filter(Boolean);

      // Gather manager/staff under those owned shops.
      const { data: managedMemberships } = ownedShopIds.length
        ? await supabase.from('shop_members').select('shop_id, user_id').in('shop_id', ownedShopIds)
        : { data: [] as any[] };

      const managedUserIdsRaw = Array.from(
        new Set((managedMemberships || []).map((m: any) => String(m.user_id || '')).filter((uid) => !!uid && uid !== targetUserId))
      );

      // Never auto-delete active platform admins as dependents.
      const { data: activePlatformAdmins } = managedUserIdsRaw.length
        ? await supabase.from('platform_admins').select('user_id').in('user_id', managedUserIdsRaw).eq('is_active', true)
        : { data: [] as any[] };
      const protectedAdminIds = new Set((activePlatformAdmins || []).map((a: any) => String(a.user_id)));
      const managedUserIds = managedUserIdsRaw.filter((uid) => !protectedAdminIds.has(uid));

      // Delete dependent manager/staff accounts first.
      if (managedUserIds.length) {
        await doDeleteMany('admin_api_access_logs', 'actor_user_id', managedUserIds);
        await doDeleteMany('platform_sessions', 'user_id', managedUserIds);
        await doDeleteMany('user_login_history', 'user_id', managedUserIds);
        await doDeleteMany('user_security_policies', 'user_id', managedUserIds);
        await doDeleteMany('platform_admins', 'user_id', managedUserIds);
        await doDeleteMany('user_subscriptions', 'user_id', managedUserIds);
        await doDeleteMany('shop_members', 'user_id', managedUserIds);
        const { error: usersErr, count: usersCount } = await supabase.from('users').delete({ count: 'exact' }).in('id', managedUserIds);
        if (usersErr) throw new Error('Failed deleting dependent managed users');
        summary.users = (summary.users || 0) + Number(usersCount || 0);
      }

      await deleteUserScopedData(targetUserId);

      const { error: shopsErr, count: shopsCount } = await supabase.from('shops').delete({ count: 'exact' }).eq('owner_id', targetUserId);
      if (shopsErr) throw new Error('Failed deleting owned shops');
      summary.shops = Number(shopsCount || 0);

      const { error: usersErr, count: usersCount } = await supabase.from('users').delete({ count: 'exact' }).eq('id', targetUserId);
      if (usersErr) throw new Error('Failed deleting user account');
      summary.users = Number(usersCount || 0);

      if (requestId) {
        await supabase.from('gdpr_deletion_requests').update({ status: 'completed', processed_at: new Date().toISOString(), summary_json: summary }).eq('id', requestId);
      }

      await writeAdminAuditLog({
        actorUserId,
        action: 'admin.privacy.gdpr_delete_user',
        entityType: 'user',
        entityId: targetUserId,
        metadataJson: {
          reason: reason || null,
          requestId: requestId || null,
          dependentManagedUsersDeleted: managedUserIds.length,
          protectedPlatformAdminsSkipped: Array.from(protectedAdminIds),
          summary,
        },
      });

      return { success: true, message: 'GDPR deletion completed successfully' };
    } catch (err) {
      if (requestId) {
        await supabase
          .from('gdpr_deletion_requests')
          .update({
            status: 'failed',
            processed_at: new Date().toISOString(),
            summary_json: { ...summary, error: String((err as any)?.message || err) },
          })
          .eq('id', requestId);
      }
      throw err;
    }
  }

  async enforce2faForHighVolumeOwners(thresholdAmount: number, days: number, actorUserId: string) {
    const threshold = Math.max(0, Number(thresholdAmount || 0));
    const lookbackDays = Math.max(1, Math.min(365, Number(days || 30)));
    const startIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: completedSales, error } = await supabase.from('sales').select('shop_id, final_amount').eq('status', 'completed').gte('created_at', startIso);
    if (error) throw new Error('Failed to compute 2FA enforcement candidates');

    const shopIds = Array.from(new Set((completedSales || []).map((s: any) => String(s.shop_id || '')).filter(Boolean)));
    const { data: shops } = shopIds.length ? await supabase.from('shops').select('id, owner_id').in('id', shopIds) : { data: [] as any[] };
    const ownerByShop = new Map((shops || []).map((s: any) => [String(s.id), String(s.owner_id || '')]));

    const ownerVolume = new Map<string, number>();
    for (const s of completedSales || []) {
      const ownerId = ownerByShop.get(String((s as any).shop_id || ''));
      if (!ownerId) continue;
      ownerVolume.set(ownerId, (ownerVolume.get(ownerId) || 0) + Number((s as any).final_amount || 0));
    }
    const candidateOwnerIds = Array.from(ownerVolume.entries()).filter(([_, amount]) => amount >= threshold).map(([ownerId]) => ownerId);

    const nowIso = new Date().toISOString();
    if (candidateOwnerIds.length) {
      const payload = candidateOwnerIds.map((ownerId) => ({
        user_id: ownerId,
        require_2fa: true,
        enforced_by_user_id: actorUserId,
        enforced_at: nowIso,
        updated_at: nowIso,
      }));
      const { error: upsertErr } = await supabase.from('user_security_policies').upsert(payload, { onConflict: 'user_id' });
      if (upsertErr) throw new Error('Failed updating 2FA security policies');
    }

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.security.enforce_2fa_policy',
      entityType: 'policy',
      metadataJson: { thresholdAmount: threshold, days: lookbackDays, affectedOwnerCount: candidateOwnerIds.length },
    });

    return {
      thresholdAmount: threshold,
      days: lookbackDays,
      affectedOwnerCount: candidateOwnerIds.length,
      affectedOwnerIds: candidateOwnerIds,
    };
  }

  async listMonetizationBilling(filters: AdminMonetizationBillingFilters) {
    const pg = toPagination(filters.page, filters.limit);
    const safeSearch = sanitizeSearch(filters.search || '').toLowerCase();
    const now = Date.now();

    const { data: users } = await supabase.from('users').select('id, name, email, is_active');
    const { data: shops } = await supabase.from('shops').select('id, name, owner_id, is_active');
    const { data: subs } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_code, amount, currency, status, billing_cycle, current_period_end, current_period_start, updated_at');
    const { data: txs } = await supabase
      .from('subscription_transactions')
      .select('user_id, amount, status, billing_cycle, paid_at, created_at')
      .order('created_at', { ascending: false })
      .limit(3000);

    const userMap = new Map((users || []).map((u: any) => [String(u.id), u]));
    const shopsByOwner = new Map<string, any[]>();
    for (const s of shops || []) {
      const ownerId = String((s as any).owner_id || '');
      if (!ownerId) continue;
      if (!shopsByOwner.has(ownerId)) shopsByOwner.set(ownerId, []);
      shopsByOwner.get(ownerId)!.push(s);
    }
    const txsByUser = new Map<string, any[]>();
    for (const t of txs || []) {
      const uid = String((t as any).user_id || '');
      if (!uid) continue;
      if (!txsByUser.has(uid)) txsByUser.set(uid, []);
      txsByUser.get(uid)!.push(t);
    }

    let rows = (subs || []).map((s: any) => {
      const uid = String(s.user_id || '');
      const u = userMap.get(uid);
      const ownerShops = shopsByOwner.get(uid) || [];
      const periodEnd = s.current_period_end ? new Date(String(s.current_period_end)).getTime() : 0;
      const overdueDays = periodEnd && periodEnd < now ? Math.floor((now - periodEnd) / 86400000) : 0;
      const paymentHistory = (txsByUser.get(uid) || []).slice(0, 8).map((t: any) => ({
        amount: Number(t.amount || 0),
        status: String(t.status || ''),
        billingCycle: String(t.billing_cycle || 'monthly'),
        paidAt: t.paid_at || t.created_at,
      }));
      return {
        userId: uid,
        ownerName: String(u?.name || ''),
        ownerEmail: String(u?.email || ''),
        userActive: !!u?.is_active,
        shopCount: ownerShops.length,
        shops: ownerShops.map((x: any) => ({ id: x.id, name: x.name, is_active: x.is_active })),
        planCode: String(s.plan_code || ''),
        billingCycle: String(s.billing_cycle || 'monthly'),
        amount: Number(s.amount || 0),
        currency: String(s.currency || 'GHS'),
        status: String(s.status || 'inactive'),
        currentPeriodStart: s.current_period_start || null,
        currentPeriodEnd: s.current_period_end || null,
        overdueDays,
        paymentHistory,
      };
    });

    if (filters.plan) rows = rows.filter((r) => r.planCode === filters.plan);
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.overdueOnly) rows = rows.filter((r) => r.overdueDays > 0 || r.status === 'past_due');
    if (safeSearch) {
      rows = rows.filter((r) =>
        [r.ownerName, r.ownerEmail, r.planCode, ...r.shops.map((s: any) => String(s.name || ''))]
          .join(' ')
          .toLowerCase()
          .includes(safeSearch)
      );
    }

    const total = rows.length;
    const items = rows.slice(pg.from, pg.to + 1);
    return { items, pagination: toPaginationMeta(pg.page, pg.limit, total) };
  }

  async setShopOwnerPlan(userId: string, planCode: ShopAdminPlan, billingCycle: 'monthly' | 'yearly', actorUserId: string): Promise<AdminActionResult> {
    const amount = MONETIZATION_PLAN_PRICES[planCode][billingCycle];
    const nowIso = new Date().toISOString();
    const periodEnd = new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 86400000).toISOString();

    const { error } = await supabase.from('user_subscriptions').upsert(
      {
        user_id: userId,
        plan_code: planCode,
        amount,
        currency: 'GHS',
        status: 'active',
        billing_cycle: billingCycle,
        current_period_start: nowIso,
        current_period_end: periodEnd,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' }
    );
    if (error) throw new Error('Failed to set subscription plan');

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.monetization.set_plan',
      entityType: 'user_subscription',
      entityId: userId,
      metadataJson: { planCode, billingCycle, amount },
    });
    return { success: true, message: 'Plan updated successfully' };
  }

  async createPromoCode(input: {
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    trialExtensionDays?: number;
    maxRedemptions?: number;
    validFrom?: string;
    validTo?: string;
  }, actorUserId: string) {
    const payload = {
      code: String(input.code || '').trim().toUpperCase(),
      discount_type: input.discountType,
      discount_value: Number(input.discountValue || 0),
      trial_extension_days: Number(input.trialExtensionDays || 0),
      max_redemptions: input.maxRedemptions ?? null,
      valid_from: input.validFrom || null,
      valid_to: input.validTo || null,
      is_active: true,
      created_by: actorUserId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('admin_promo_codes').insert(payload).select('*').single();
    if (error) throw new Error('Failed to create promo code');
    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.monetization.create_promo_code',
      entityType: 'promo_code',
      entityId: String(data.id),
      metadataJson: { code: payload.code },
    });
    return data;
  }

  async listPromoCodes() {
    const { data, error } = await supabase
      .from('admin_promo_codes')
      .select('id, code, discount_type, discount_value, trial_extension_days, max_redemptions, used_count, valid_from, valid_to, is_active, created_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Failed to list promo codes');
    return data || [];
  }

  async applyPromoCodeToUser(userId: string, code: string, actorUserId: string): Promise<AdminActionResult> {
    const normalized = String(code || '').trim().toUpperCase();
    const { data: promo } = await supabase
      .from('admin_promo_codes')
      .select('*')
      .eq('code', normalized)
      .eq('is_active', true)
      .maybeSingle();
    if (!promo) throw new Error('Promo code not found or inactive');
    if (promo.max_redemptions && Number(promo.used_count || 0) >= Number(promo.max_redemptions)) {
      throw new Error('Promo code redemption limit reached');
    }
    const now = Date.now();
    if (promo.valid_from && new Date(String(promo.valid_from)).getTime() > now) throw new Error('Promo code not active yet');
    if (promo.valid_to && new Date(String(promo.valid_to)).getTime() < now) throw new Error('Promo code has expired');

    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('user_id, amount, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();
    if (!sub) throw new Error('User subscription not found');

    const currentAmount = Number(sub.amount || 0);
    let discountAmount = 0;
    if (String(promo.discount_type) === 'percent') {
      discountAmount = Number((currentAmount * (Number(promo.discount_value || 0) / 100)).toFixed(2));
    } else {
      discountAmount = Number(promo.discount_value || 0);
    }
    const newAmount = Math.max(0, Number((currentAmount - discountAmount).toFixed(2)));
    let newPeriodEnd = sub.current_period_end ? new Date(String(sub.current_period_end)) : new Date();
    newPeriodEnd = new Date(newPeriodEnd.getTime() + Number(promo.trial_extension_days || 0) * 86400000);

    const { error: upErr } = await supabase
      .from('user_subscriptions')
      .update({
        amount: newAmount,
        current_period_end: newPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (upErr) throw new Error('Failed to apply promo to subscription');

    await supabase.from('admin_promo_redemptions').insert({
      promo_code_id: promo.id,
      user_id: userId,
      applied_by_user_id: actorUserId,
      discount_amount: discountAmount,
      trial_days_granted: Number(promo.trial_extension_days || 0),
      metadata_json: { previousAmount: currentAmount, newAmount },
    });
    await supabase.from('admin_promo_codes').update({ used_count: Number(promo.used_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', promo.id);

    await writeAdminAuditLog({
      actorUserId,
      action: 'admin.monetization.apply_promo',
      entityType: 'user_subscription',
      entityId: userId,
      metadataJson: { code: normalized, discountAmount, trialExtensionDays: Number(promo.trial_extension_days || 0) },
    });
    return { success: true, message: 'Promo code applied successfully' };
  }

  async runOverduePlanSuspension(daysPastDue: number, actorUserId?: string) {
    const safeDays = Math.max(1, Math.min(180, Number(daysPastDue || 7)));
    const now = Date.now();
    const { data: subs } = await supabase
      .from('user_subscriptions')
      .select('user_id, status, current_period_end');
    const overdueUserIds = (subs || [])
      .filter((s: any) => {
        const endMs = s.current_period_end ? new Date(String(s.current_period_end)).getTime() : 0;
        if (!endMs) return false;
        const overdueDays = endMs < now ? Math.floor((now - endMs) / 86400000) : 0;
        const notActive = String(s.status || '') !== 'active';
        return overdueDays >= safeDays && (notActive || overdueDays > safeDays);
      })
      .map((s: any) => String(s.user_id));
    if (!overdueUserIds.length) {
      return { daysPastDue: safeDays, suspendedShopCount: 0, affectedOwners: [] as string[] };
    }

    const { data: ownedShops } = await supabase.from('shops').select('id, owner_id, is_active').in('owner_id', overdueUserIds);
    const targetShops = (ownedShops || []).filter((s: any) => s.is_active !== false).map((s: any) => String(s.id));
    if (targetShops.length) {
      await supabase.from('shops').update({ is_active: false, updated_at: new Date().toISOString() }).in('id', targetShops);
    }

    if (actorUserId) {
      await writeAdminAuditLog({
        actorUserId,
        action: 'admin.monetization.suspend_overdue',
        entityType: 'shop',
        metadataJson: { daysPastDue: safeDays, suspendedShopCount: targetShops.length, affectedOwners: overdueUserIds },
      });
    }

    return { daysPastDue: safeDays, suspendedShopCount: targetShops.length, affectedOwners: overdueUserIds };
  }

  async getCommissionSummary(month?: string, ratePercent?: number) {
    const now = new Date();
    const monthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startIso = `${monthKey}-01T00:00:00.000Z`;
    const nextMonth = new Date(`${monthKey}-01T00:00:00.000Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const endIso = nextMonth.toISOString();

    const { data: settings } = await supabase.from('admin_monetization_settings').select('commission_rate_percent').limit(1).maybeSingle();
    const rate = Number(ratePercent ?? settings?.commission_rate_percent ?? 0);
    const { data: sales } = await supabase
      .from('sales')
      .select('shop_id, final_amount, status, created_at')
      .eq('status', 'completed')
      .gte('created_at', startIso)
      .lt('created_at', endIso);
    const { data: shops } = await supabase.from('shops').select('id, name');
    const shopMap = new Map((shops || []).map((s: any) => [String(s.id), String(s.name || s.id)]));

    const byShop = new Map<string, { gross: number; commission: number; tx: number }>();
    for (const s of sales || []) {
      const shopId = String((s as any).shop_id || '');
      if (!shopId) continue;
      const gross = Number((s as any).final_amount || 0);
      const b = byShop.get(shopId) || { gross: 0, commission: 0, tx: 0 };
      b.gross += gross;
      b.commission += gross * (rate / 100);
      b.tx += 1;
      byShop.set(shopId, b);
    }

    const perShop = Array.from(byShop.entries())
      .map(([shopId, v]) => ({
        shopId,
        shopName: shopMap.get(shopId) || shopId,
        transactionCount: v.tx,
        grossVolume: Number(v.gross.toFixed(2)),
        commissionOwed: Number(v.commission.toFixed(2)),
      }))
      .sort((a, b) => b.commissionOwed - a.commissionOwed);
    const totalCommission = Number(perShop.reduce((a, b) => a + b.commissionOwed, 0).toFixed(2));
    const totalGross = Number(perShop.reduce((a, b) => a + b.grossVolume, 0).toFixed(2));
    return { month: monthKey, ratePercent: rate, totalGross, totalCommission, perShop };
  }

  async getRevenueForecast(months: number) {
    const horizon = Math.max(3, Math.min(12, Number(months || 12)));
    const { data: activeSubs } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_code, amount, billing_cycle, status')
      .eq('status', 'active');
    const { data: txs } = await supabase
      .from('subscription_transactions')
      .select('status, amount, created_at')
      .eq('status', 'success')
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString());

    const active = activeSubs || [];
    const mrr = Number(
      active
        .reduce((sum: number, s: any) => {
          const amt = Number(s.amount || 0);
          return sum + (String(s.billing_cycle || 'monthly') === 'yearly' ? amt / 12 : amt);
        }, 0)
        .toFixed(2)
    );

    const txCountByMonth = new Map<string, number>();
    for (const t of txs || []) {
      const d = new Date(String((t as any).created_at));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      txCountByMonth.set(key, (txCountByMonth.get(key) || 0) + 1);
    }
    const monthlyCounts = Array.from(txCountByMonth.values());
    const avgMonthlyNew = monthlyCounts.length ? monthlyCounts.reduce((a, b) => a + b, 0) / monthlyCounts.length : 0;
    const growthRate = active.length > 0 ? Math.min(0.2, avgMonthlyNew / Math.max(1, active.length)) : 0;

    const projections = [3, 6, 12]
      .filter((m) => m <= horizon)
      .map((m) => ({
        months: m,
        projectedRevenue: Number((mrr * m * (1 + growthRate * (m / 2))).toFixed(2)),
      }));

    return {
      activeSubscriptions: active.length,
      currentMRR: mrr,
      estimatedMonthlyGrowthRate: Number((growthRate * 100).toFixed(2)),
      projections,
    };
  }

  async listAuditLogs(filters: AdminListAuditLogFilters) {
    const pg = toPagination(filters.page, filters.limit);
    let query = supabase
      .from('admin_audit_logs')
      .select('id, actor_user_id, action, entity_type, entity_id, before_json, after_json, metadata_json, created_at', { count: 'exact' });

    if (filters.actorUserId) query = query.eq('actor_user_id', filters.actorUserId);
    if (filters.action) query = query.ilike('action', `%${sanitizeSearch(filters.action)}%`);
    if (filters.entityType) query = query.ilike('entity_type', `%${sanitizeSearch(filters.entityType)}%`);
    if (filters.from) query = query.gte('created_at', isoStart(filters.from)!);
    if (filters.to) query = query.lte('created_at', isoEnd(filters.to)!);

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(pg.from, pg.to);
    if (error) throw new Error('Failed to fetch admin audit logs');

    return {
      items: data || [],
      pagination: toPaginationMeta(pg.page, pg.limit, count || 0),
    };
  }
}
