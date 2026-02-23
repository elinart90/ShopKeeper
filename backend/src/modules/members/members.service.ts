import { supabase } from '../../config/supabase';
import { customerSchema } from '../../domain/validators';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class MembersService {
  private static readonly ALLOWED_PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card'] as const;

  async createCustomer(shopId: string, data: any) {
    const validated = customerSchema.parse(data);

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({ ...validated, shop_id: shopId })
      .select()
      .single();

    if (error) {
      logger.error('Error creating customer:', error);
      throw new Error('Failed to create customer');
    }
    return customer;
  }

  async getCustomers(shopId: string, search?: string) {
    let query = supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching customers:', error);
      throw new Error('Failed to fetch customers');
    }
    return data || [];
  }

  async getCustomerById(customerId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      logger.error('Error fetching customer:', error);
      throw new Error('Customer not found');
    }
    return data;
  }

  async updateCustomer(customerId: string, shopId: string, data: any) {
    const validated = customerSchema.partial().parse(data);

    const { data: customer, error } = await supabase
      .from('customers')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .eq('shop_id', shopId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating customer:', error);
      throw new Error('Failed to update customer');
    }
    return customer;
  }

  /** Credit & Customer Risk: customers owing money and total exposure */
  async getCreditSummary(shopId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, email, credit_balance, credit_limit')
      .eq('shop_id', shopId)
      .gt('credit_balance', 0)
      .order('credit_balance', { ascending: false });

    if (error) {
      logger.error('Error fetching credit summary:', error);
      throw new Error('Failed to fetch credit summary');
    }

    const customersOwing = (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      credit_balance: Number(c.credit_balance || 0),
      credit_limit: Number(c.credit_limit || 0),
    }));

    const totalExposure = customersOwing.reduce((sum, c) => sum + c.credit_balance, 0);

    return {
      totalExposure,
      count: customersOwing.length,
      customersOwing,
    };
  }

  /** Record customer credit repayment, reduce balance, and post to sales for dashboard visibility. */
  async recordCreditPayment(
    customerId: string,
    shopId: string,
    userId: string,
    amount: number,
    paymentMethod: string,
    notes?: string
  ) {
    const customer = await this.getCustomerById(customerId);
    if (String(customer.shop_id) !== String(shopId)) {
      throw new Error('Customer not found');
    }

    const currentBalance = Number(customer.credit_balance || 0);
    if (currentBalance <= 0) {
      throw new Error('Customer has no outstanding credit');
    }

    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Invalid payment amount');
    }
    const normalizedMethod = String(paymentMethod || 'cash').toLowerCase();
    if (!MembersService.ALLOWED_PAYMENT_METHODS.includes(normalizedMethod as any)) {
      throw new Error('Invalid payment method');
    }

    const newBalance = Math.max(0, Number((currentBalance - paymentAmount).toFixed(2)));
    const { data: updated, error } = await supabase
      .from('customers')
      .update({
        credit_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('shop_id', shopId)
      .select('*')
      .single();

    if (error) {
      logger.error('Error recording customer credit payment:', error);
      throw new Error('Failed to record payment');
    }

    const saleNumber = `CRPAY-${Date.now().toString(36).toUpperCase()}`;
    const { error: saleError } = await supabase.from('sales').insert({
      shop_id: shopId,
      customer_id: customerId,
      sale_number: saleNumber,
      total_amount: paymentAmount,
      discount_amount: 0,
      tax_amount: 0,
      final_amount: paymentAmount,
      payment_method: normalizedMethod,
      status: 'completed',
      notes: notes?.trim()
        ? `[CREDIT_REPAYMENT] Credit repayment: ${notes.trim()}`
        : '[CREDIT_REPAYMENT] Credit repayment',
      created_by: userId,
    });
    if (saleError) {
      logger.error('Error posting credit repayment to sales:', saleError);
      // Keep payment applied even if mirror sales record fails.
    }

    return updated;
  }

  private normalizeCurrencyText(text: string, currencyCode: string = 'GHS') {
    return String(text || '')
      .replace(/\$/g, `${currencyCode} `)
      .replace(/\bUSD\b/gi, currencyCode)
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private parseAiJson(content: string): any {
    const raw = String(content || '').trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(raw.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
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
          { role: 'system', content: 'You are a retail customer-credit analyst. Be concise and data-grounded.' },
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
        max_tokens: 800,
        temperature: 0.2,
        system: 'You are a customer-credit intelligence assistant for retail POS.',
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
      logger.warn('OpenAI credit intelligence failed; trying Claude fallback', {
        message: String(openErr?.message || openErr),
      });
      const text = await this.callClaudeText(prompt);
      return { provider: 'claude' as const, text };
    }
  }

  async getCreditIntelligence(shopId: string, lookbackDays = 90) {
    const { data: customerRows, error: customerErr } = await supabase
      .from('customers')
      .select('id, name, phone, email, credit_balance, credit_limit')
      .eq('shop_id', shopId)
      .gt('credit_balance', 0)
      .order('credit_balance', { ascending: false });
    if (customerErr) throw new Error('Failed to fetch customer credit data');

    const customers = (customerRows || []).map((c: any) => ({
      id: String(c.id),
      name: String(c.name || 'Unknown'),
      phone: c.phone || undefined,
      email: c.email || undefined,
      credit_balance: Number(c.credit_balance || 0),
      credit_limit: Number(c.credit_limit || 0),
    }));
    const customerIds = customers.map((c) => c.id);
    const nowMs = Date.now();
    const recentCutoff = new Date(nowMs - Math.max(1, Number(lookbackDays || 90)) * 24 * 60 * 60 * 1000).toISOString();

    let creditSales: any[] = [];
    let repayments: any[] = [];
    if (customerIds.length > 0) {
      const creditSalesRes = await supabase
        .from('sales')
        .select('id, customer_id, final_amount, created_at, sale_number')
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .eq('payment_method', 'credit')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: true })
        .limit(5000);
      if (creditSalesRes.error) throw new Error('Failed to fetch credit sales');
      creditSales = creditSalesRes.data || [];

      const repaymentRes = await supabase
        .from('sales')
        .select('id, customer_id, final_amount, created_at, notes, payment_method')
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .in('customer_id', customerIds)
        .ilike('notes', '%[CREDIT_REPAYMENT]%')
        .order('created_at', { ascending: true })
        .limit(5000);
      if (repaymentRes.error) throw new Error('Failed to fetch credit repayments');
      repayments = repaymentRes.data || [];
    }

    const creditByCustomer = new Map<string, any[]>();
    for (const s of creditSales) {
      const cid = String(s.customer_id || '');
      if (!cid) continue;
      const arr = creditByCustomer.get(cid) || [];
      arr.push({
        saleId: String(s.id),
        amount: Number(s.final_amount || 0),
        createdAt: String(s.created_at || ''),
        saleNumber: String(s.sale_number || ''),
      });
      creditByCustomer.set(cid, arr);
    }

    const repaymentByCustomer = new Map<string, number>();
    for (const r of repayments) {
      const cid = String(r.customer_id || '');
      if (!cid) continue;
      repaymentByCustomer.set(cid, (repaymentByCustomer.get(cid) || 0) + Number(r.final_amount || 0));
    }

    const agingBuckets = {
      d0_7: 0,
      d8_30: 0,
      d31_60: 0,
      d61_plus: 0,
    };
    let overdueAmount = 0;
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let recentCreditIssued = 0;
    let recentRepayments = 0;

    for (const s of creditSales) {
      if (String(s.created_at || '') >= recentCutoff) recentCreditIssued += Number(s.final_amount || 0);
    }
    for (const r of repayments) {
      if (String(r.created_at || '') >= recentCutoff) recentRepayments += Number(r.final_amount || 0);
    }

    const enrichedCustomers = customers.map((c) => {
      const ledger = [...(creditByCustomer.get(c.id) || [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      let remainingRepayment = Number(repaymentByCustomer.get(c.id) || 0);
      const outstandingChunks: Array<{ amount: number; ageDays: number }> = [];
      for (const row of ledger) {
        let amountLeft = Number(row.amount || 0);
        if (remainingRepayment > 0) {
          const applied = Math.min(amountLeft, remainingRepayment);
          amountLeft -= applied;
          remainingRepayment -= applied;
        }
        if (amountLeft > 0.0001) {
          const ageDays = Math.max(0, Math.floor((nowMs - new Date(row.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
          outstandingChunks.push({ amount: amountLeft, ageDays });
        }
      }

      const overdueDays = outstandingChunks.length
        ? Math.max(...outstandingChunks.map((x) => x.ageDays))
        : 0;
      const utilization = c.credit_limit > 0 ? c.credit_balance / c.credit_limit : (c.credit_balance > 0 ? 1 : 0);
      const utilizationPenalty = Math.min(40, Math.max(0, utilization * 40));
      const overduePenalty = overdueDays >= 90 ? 40 : overdueDays >= 61 ? 30 : overdueDays >= 31 ? 20 : overdueDays >= 8 ? 10 : 0;
      const exposurePenalty = c.credit_balance >= 5000 ? 20 : c.credit_balance >= 2000 ? 12 : c.credit_balance >= 1000 ? 8 : c.credit_balance >= 300 ? 4 : 0;
      const riskScore = Math.max(0, Math.min(100, Math.round(100 - utilizationPenalty - overduePenalty - exposurePenalty)));
      const riskLevel = riskScore < 50 ? 'high' : riskScore < 75 ? 'medium' : 'low';
      const recommendedAction = riskLevel === 'high'
        ? 'Call customer today and agree partial payment schedule.'
        : riskLevel === 'medium'
          ? 'Send reminder and follow up within 48 hours.'
          : 'Routine reminder and monitor.';

      const balance = Number(c.credit_balance || 0);
      if (overdueDays >= 61) agingBuckets.d61_plus += balance;
      else if (overdueDays >= 31) agingBuckets.d31_60 += balance;
      else if (overdueDays >= 8) agingBuckets.d8_30 += balance;
      else agingBuckets.d0_7 += balance;
      if (overdueDays > 30) overdueAmount += balance;
      if (riskLevel === 'high') highRiskCount += 1;
      else if (riskLevel === 'medium') mediumRiskCount += 1;

      return {
        ...c,
        overdueDays,
        riskScore,
        riskLevel,
        recommendedAction,
      };
    });

    const totalExposure = enrichedCustomers.reduce((sum, c) => sum + Number(c.credit_balance || 0), 0);
    const collectionRateRecent = recentCreditIssued > 0
      ? Number(((recentRepayments / recentCreditIssued) * 100).toFixed(1))
      : (recentRepayments > 0 ? 100 : 0);

    const snapshot = {
      totalExposure,
      customersOwing: enrichedCustomers.length,
      overdueAmount,
      highRiskCount,
      mediumRiskCount,
      agingBuckets,
      collectionRateRecent,
      topRiskCustomers: enrichedCustomers
        .slice()
        .sort((a, b) => a.riskScore - b.riskScore || b.credit_balance - a.credit_balance)
        .slice(0, 10)
        .map((c) => ({
          name: c.name,
          balance: c.credit_balance,
          overdueDays: c.overdueDays,
          riskScore: c.riskScore,
          riskLevel: c.riskLevel,
        })),
    };

    const prompt = `
You are ShopKeeper Customer & Credit Intelligence assistant.
Use only this JSON snapshot:
${JSON.stringify(snapshot, null, 2)}

Return concise practical text with:
- one headline insight
- 3 bullet actions for collections
- one policy suggestion to reduce bad debt

Currency rules:
- Use GHS.
- Never use "$" or "USD".
`;
    const ai = await this.callOpenAiThenClaude(prompt);

    return {
      providerUsed: ai.provider,
      lookbackDays: Number(lookbackDays || 90),
      totalExposure,
      customersOwingCount: enrichedCustomers.length,
      overdueAmount,
      highRiskCount,
      mediumRiskCount,
      collectionRateRecent,
      agingBuckets,
      customers: enrichedCustomers,
      aiSummary: this.normalizeCurrencyText(ai.text),
      snapshot,
    };
  }

  async queryCreditIntelligence(shopId: string, query: string, lookbackDays = 90) {
    const intel = await this.getCreditIntelligence(shopId, lookbackDays);
    const prompt = `
You are ShopKeeper credit copilot.
Answer merchant query using ONLY this payload.
Query: ${query}
Payload:
${JSON.stringify(intel.snapshot || {}, null, 2)}

Return concise practical answer with bullets and one next action.
Currency rules: Use GHS only (never "$" or "USD").
`;
    const ai = await this.callOpenAiThenClaude(prompt);
    return {
      providerUsed: ai.provider,
      lookbackDays: Number(lookbackDays || 90),
      query,
      answer: this.normalizeCurrencyText(ai.text),
      basedOn: {
        totalExposure: intel.totalExposure,
        highRiskCount: intel.highRiskCount,
      },
    };
  }

  async runAutoCreditReminders(
    shopId: string,
    userId: string,
    intervalDays = 3,
    lookbackDays = 90
  ) {
    const cadenceDays = Math.max(1, Math.min(30, Number(intervalDays || 3)));
    const intel = await this.getCreditIntelligence(shopId, lookbackDays);
    const customers = (intel.customers || []) as Array<{
      id: string;
      name: string;
      phone?: string;
      email?: string;
      credit_balance: number;
      overdueDays: number;
      riskLevel: string;
      riskScore: number;
    }>;
    if (!customers.length) {
      return {
        intervalDays: cadenceDays,
        dueCount: 0,
        reminders: [],
      };
    }

    const customerIds = customers.map((c) => c.id);
    const { data: recentReminderLogs, error: remindersErr } = await supabase
      .from('customer_transactions')
      .select('customer_id, created_at')
      .eq('shop_id', shopId)
      .eq('transaction_type', 'reminder')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (remindersErr) {
      logger.error('Error loading reminder logs:', remindersErr);
      throw new Error('Failed to load reminder logs');
    }

    const lastReminderByCustomer = new Map<string, string>();
    for (const row of recentReminderLogs || []) {
      const cid = String((row as any).customer_id || '');
      if (!cid || lastReminderByCustomer.has(cid)) continue;
      lastReminderByCustomer.set(cid, String((row as any).created_at || ''));
    }

    const now = Date.now();
    const dueCustomers = customers.filter((c) => {
      const lastIso = lastReminderByCustomer.get(c.id);
      if (!lastIso) return true;
      const lastMs = new Date(lastIso).getTime();
      const daysSince = Math.floor((now - lastMs) / (24 * 60 * 60 * 1000));
      return daysSince >= cadenceDays;
    });

    if (!dueCustomers.length) {
      return {
        intervalDays: cadenceDays,
        dueCount: 0,
        reminders: [],
      };
    }

    const prompt = `
You are ShopKeeper credit collections assistant.
Create reminder messages for each customer in JSON only.
Cadence: every ${cadenceDays} days.
Tone: respectful, firm, concise.
Currency rules: use GHS, never "$" or "USD".

Customers JSON:
${JSON.stringify(dueCustomers.map((c) => ({
      customerId: c.id,
      name: c.name,
      balance: c.credit_balance,
      overdueDays: c.overdueDays,
      riskLevel: c.riskLevel,
    })), null, 2)}

Return JSON only:
{
  "reminders": [
    {
      "customerId": string,
      "message": string
    }
  ]
}
`;
    const ai = await this.callOpenAiThenClaude(prompt);
    const parsed = this.parseAiJson(ai.text);
    const aiReminders = Array.isArray(parsed?.reminders) ? parsed.reminders : [];
    const messageByCustomer = new Map<string, string>();
    for (const r of aiReminders) {
      const cid = String(r?.customerId || '').trim();
      const msg = this.normalizeCurrencyText(String(r?.message || '').trim());
      if (!cid || !msg) continue;
      messageByCustomer.set(cid, msg);
    }

    const prepared = dueCustomers.map((c) => {
      const fallback = `Hello ${c.name}, this is a reminder that your outstanding balance is GHS ${Number(c.credit_balance || 0).toFixed(2)}. Please make payment within 3 days.`;
      return {
        customerId: c.id,
        customerName: c.name,
        phone: c.phone || null,
        email: c.email || null,
        balance: Number(c.credit_balance || 0),
        overdueDays: Number(c.overdueDays || 0),
        riskLevel: c.riskLevel,
        message: messageByCustomer.get(c.id) || fallback,
      };
    });

    const nowIso = new Date().toISOString();
    const rows = prepared.map((r) => ({
      customer_id: r.customerId,
      shop_id: shopId,
      sale_id: null,
      amount: 0,
      transaction_type: 'reminder',
      description: `[AUTO_REMINDER_${cadenceDays}D] ${r.message}`,
      created_by: userId,
      created_at: nowIso,
    }));
    const { error: insertErr } = await supabase.from('customer_transactions').insert(rows);
    if (insertErr) {
      logger.error('Error saving reminder logs:', insertErr);
      throw new Error('Failed to save reminder logs');
    }

    return {
      providerUsed: ai.provider,
      intervalDays: cadenceDays,
      dueCount: prepared.length,
      reminders: prepared,
    };
  }
}
