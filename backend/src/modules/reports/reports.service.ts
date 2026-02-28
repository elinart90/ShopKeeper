import { supabase } from '../../config/supabase';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/** Normalize date range to full days: start = 00:00:00, end = 23:59:59.999 (UTC) so sales that day are included. */
function toDateRange(startDate?: string, endDate?: string) {
  const start = startDate ? `${startDate}T00:00:00.000Z` : undefined;
  const end = endDate ? `${endDate}T23:59:59.999Z` : undefined;
  return { start, end };
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pctChange(today: number, yesterday: number): number {
  if (!Number.isFinite(today) || !Number.isFinite(yesterday)) return 0;
  if (yesterday === 0) {
    if (today === 0) return 0;
    return today > 0 ? 100 : -100;
  }
  return ((today - yesterday) / Math.abs(yesterday)) * 100;
}

/** When shop has data_cleared_at, dashboard only shows data on or after that time. */
async function getDataClearedAt(shopId: string): Promise<string | null> {
  const { data } = await supabase
    .from('shops')
    .select('data_cleared_at')
    .eq('id', shopId)
    .single();
  return (data as any)?.data_cleared_at ?? null;
}

/** Get shop currency for reports (default GHS). */
async function getShopCurrency(shopId: string): Promise<string> {
  const { data } = await supabase.from('shops').select('currency').eq('id', shopId).maybeSingle();
  const code = String((data as any)?.currency || 'GHS').trim().toUpperCase();
  return code || 'GHS';
}

export class ReportsService {
  private normalizeCurrencyText(text: string, currencyCode: string = 'GHS') {
    return String(text || '')
      .replace(/\$/g, `${currencyCode} `)
      .replace(new RegExp(`\\bUSD\\b`, 'gi'), currencyCode)
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  async getDashboardStats(shopId: string, startDate?: string, endDate?: string) {
    try {
      const { start: startTs, end: endTs } = toDateRange(startDate, endDate);
      const dataClearedAt = await getDataClearedAt(shopId);
      const effectiveStart =
        dataClearedAt && (!startTs || dataClearedAt > startTs) ? dataClearedAt : startTs;

      let salesQuery = supabase
        .from('sales')
        .select('id, final_amount, payment_method, created_at, created_by, notes')
        .eq('shop_id', shopId)
        .eq('status', 'completed');

      if (effectiveStart) salesQuery = salesQuery.gte('created_at', effectiveStart);
      if (endTs) salesQuery = salesQuery.lte('created_at', endTs);

      const { data: sales } = await salesQuery;
      const filteredSales = sales || [];
      const totalSales = filteredSales.reduce(
        (sum, s) => sum + Number(s.final_amount),
        0
      );
      const totalTransactions = filteredSales.length;
      const saleIds = (filteredSales as any[]).map((s) => s.id).filter(Boolean);

      // Sales profit (gross profit) = sum of sold item totals - item costs (cost_price * quantity).
      // This keeps the dashboard profit tied to actual sales made in the selected period.
      let salesProfit = 0;
      if (saleIds.length > 0) {
        const { data: saleItems } = await supabase
          .from('sale_items')
          .select('product_id, quantity, total_price')
          .in('sale_id', saleIds);

        const items = (saleItems || []) as Array<{ product_id: string; quantity: number; total_price: number }>;
        const productIds = Array.from(
          new Set(items.map((i) => i.product_id).filter(Boolean))
        );

        let costByProductId: Record<string, number> = {};
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select('id, cost_price')
            .in('id', productIds);

          costByProductId = (products || []).reduce((acc: Record<string, number>, p: any) => {
            acc[p.id] = Number(p.cost_price || 0);
            return acc;
          }, {});
        }

        salesProfit = items.reduce((sum, item) => {
          const lineRevenue = Number(item.total_price || 0);
          const unitCost = Number(costByProductId[item.product_id] || 0);
          const lineCost = unitCost * Number(item.quantity || 0);
          return sum + (lineRevenue - lineCost);
        }, 0);
      }

      // Credit repayments are mirrored as sales records without sale_items.
      // Count them as full gross profit on repayment day so dashboard KPIs update.
      const creditRepaymentProfit = (filteredSales as any[])
        .filter((s) => String(s.notes || '').includes('[CREDIT_REPAYMENT]'))
        .reduce((sum, s) => sum + Number(s.final_amount || 0), 0);
      salesProfit += creditRepaymentProfit;

      const paymentMethodBreakdown = (filteredSales as any[]).reduce(
        (acc: Record<string, number>, s) => {
          const method = s.payment_method || 'cash';
          acc[method] = (acc[method] || 0) + Number(s.final_amount || 0);
          return acc;
        },
        {}
      );

      const activeStaffToday = new Set(
        (filteredSales as any[]).map((s) => s.created_by).filter(Boolean)
      ).size;

      const clearedDateOnly = dataClearedAt ? dataClearedAt.slice(0, 10) : null;
      const effectiveExpenseStart =
        clearedDateOnly && (!startDate || clearedDateOnly > startDate) ? clearedDateOnly : startDate;

      let expensesQuery = supabase
        .from('expenses')
        .select('amount, expense_date')
        .eq('shop_id', shopId);

      if (effectiveExpenseStart) expensesQuery = expensesQuery.gte('expense_date', effectiveExpenseStart);
      if (endTs) expensesQuery = expensesQuery.lte('expense_date', endDate!);

      const { data: expenses } = await expensesQuery;
      const filteredExpenses = expenses || [];
      const totalExpenses = filteredExpenses.reduce(
        (sum, e) => sum + Number(e.amount),
        0
      );
      const profit = totalSales - totalExpenses;

      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock_quantity, min_stock_level')
        .eq('shop_id', shopId)
        .eq('is_active', true);

      const lowStockItems = (products || [])
        .filter((p: any) => Number(p.stock_quantity) <= Number(p.min_stock_level || 0))
        .map((p: any) => ({
          productId: p.id,
          name: p.name || 'Unnamed product',
          stockQuantity: Number(p.stock_quantity || 0),
          minStockLevel: Number(p.min_stock_level || 0),
        }))
        .sort((a, b) => a.stockQuantity - b.stockQuantity)
        .slice(0, 5);
      const lowStockCount = lowStockItems.length;

      return {
        totalSales,
        totalExpenses,
        profit,
        salesProfit,
        totalTransactions,
        lowStockCount,
        lowStockItems,
        averageTransaction:
          totalTransactions > 0 ? totalSales / totalTransactions : 0,
        paymentMethodBreakdown,
        activeStaffToday,
      };
    } catch (error) {
      logger.error('Error fetching dashboard stats:', error);
      throw new Error('Failed to fetch dashboard stats');
    }
  }

  async getSalesIntelligence(shopId: string, startDate?: string, endDate?: string) {
    try {
      const { start: startTs, end: endTs } = toDateRange(startDate, endDate);
      const dataClearedAt = await getDataClearedAt(shopId);
      const effectiveStart =
        dataClearedAt && (!startTs || dataClearedAt > startTs) ? dataClearedAt : startTs;

      let salesQuery = supabase
        .from('sales')
        .select('id, final_amount, payment_method, created_at, created_by')
        .eq('shop_id', shopId)
        .eq('status', 'completed');
      if (effectiveStart) salesQuery = salesQuery.gte('created_at', effectiveStart);
      if (endTs) salesQuery = salesQuery.lte('created_at', endTs);
      const { data: sales } = await salesQuery;
      const saleIds = (sales || []).map((s: any) => s.id);

      const paymentMethodBreakdown = ((sales || []) as any[]).reduce(
        (acc: Record<string, { amount: number; count: number }>, s) => {
          const method = s.payment_method || 'cash';
          if (!acc[method]) acc[method] = { amount: 0, count: 0 };
          acc[method].amount += Number(s.final_amount || 0);
          acc[method].count += 1;
          return acc;
        },
        {}
      );

      const salesByHour: Record<number, number> = {};
      for (let h = 0; h < 24; h++) salesByHour[h] = 0;
      (sales || []).forEach((s: any) => {
        const hour = new Date(s.created_at).getHours();
        salesByHour[hour] = (salesByHour[hour] || 0) + Number(s.final_amount || 0);
      });
      const peakHours = Object.entries(salesByHour)
        .map(([hour, amount]) => ({ hour: Number(hour), amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const salesByStaff: Record<string, { amount: number; count: number }> = {};
      (sales || []).forEach((s: any) => {
        const id = s.created_by || 'unknown';
        if (!salesByStaff[id]) salesByStaff[id] = { amount: 0, count: 0 };
        salesByStaff[id].amount += Number(s.final_amount || 0);
        salesByStaff[id].count += 1;
      });

      const now = new Date();
      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
      );
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
      const sevenDaysAgoStart = new Date(todayStart);
      sevenDaysAgoStart.setUTCDate(sevenDaysAgoStart.getUTCDate() - 6);

      const dailyRevenueByDate: Record<string, number> = {};
      const dailyExpenseByDate: Record<string, number> = {};
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(sevenDaysAgoStart);
        d.setUTCDate(d.getUTCDate() + i);
        const dateKey = toIsoDateOnly(d);
        dailyRevenueByDate[dateKey] = 0;
        dailyExpenseByDate[dateKey] = 0;
      }

      let dailySalesQuery = supabase
        .from('sales')
        .select('final_amount, created_at')
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .gte('created_at', sevenDaysAgoStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString());
      if (dataClearedAt && dataClearedAt > sevenDaysAgoStart.toISOString()) {
        dailySalesQuery = dailySalesQuery.gte('created_at', dataClearedAt);
      }
      const { data: dailySales } = await dailySalesQuery;
      (dailySales || []).forEach((s: any) => {
        const dateKey = String(s.created_at || '').slice(0, 10);
        if (dateKey in dailyRevenueByDate) {
          dailyRevenueByDate[dateKey] += Number(s.final_amount || 0);
        }
      });

      const sevenDaysAgoDateOnly = toIsoDateOnly(sevenDaysAgoStart);
      const todayDateOnly = toIsoDateOnly(todayStart);
      let dailyExpensesQuery = supabase
        .from('expenses')
        .select('amount, expense_date')
        .eq('shop_id', shopId)
        .gte('expense_date', sevenDaysAgoDateOnly)
        .lte('expense_date', todayDateOnly);
      if (dataClearedAt) {
        const clearedDateOnly = dataClearedAt.slice(0, 10);
        if (clearedDateOnly > sevenDaysAgoDateOnly) {
          dailyExpensesQuery = dailyExpensesQuery.gte('expense_date', clearedDateOnly);
        }
      }
      const { data: dailyExpenses } = await dailyExpensesQuery;
      (dailyExpenses || []).forEach((e: any) => {
        const dateKey = String(e.expense_date || '').slice(0, 10);
        if (dateKey in dailyExpenseByDate) {
          dailyExpenseByDate[dateKey] += Number(e.amount || 0);
        }
      });

      const todayKey = toIsoDateOnly(todayStart);
      const yesterdayKey = toIsoDateOnly(yesterdayStart);
      const revenueToday = Number(dailyRevenueByDate[todayKey] || 0);
      const revenueYesterday = Number(dailyRevenueByDate[yesterdayKey] || 0);
      const expenseToday = Number(dailyExpenseByDate[todayKey] || 0);
      const expenseYesterday = Number(dailyExpenseByDate[yesterdayKey] || 0);
      const profitToday = revenueToday - expenseToday;
      const profitYesterday = revenueYesterday - expenseYesterday;
      const recentDailyMetrics = Object.keys(dailyRevenueByDate)
        .sort()
        .map((date) => {
          const revenue = Number(dailyRevenueByDate[date] || 0);
          const expenses = Number(dailyExpenseByDate[date] || 0);
          return {
            date,
            revenue,
            expenses,
            profit: revenue - expenses,
          };
        });

      const dailyComparison = {
        revenueToday,
        revenueYesterday,
        revenueChangePercent: pctChange(revenueToday, revenueYesterday),
        expenseToday,
        expenseYesterday,
        expenseChangePercent: pctChange(expenseToday, expenseYesterday),
        profitToday,
        profitYesterday,
        profitChangePercent: pctChange(profitToday, profitYesterday),
      };

      if (saleIds.length === 0) {
        return {
          topProducts: [],
          slowMovingProducts: [],
          paymentMethodBreakdown,
          peakHours,
          dailyComparison,
          recentDailyMetrics,
          salesByStaff: Object.entries(salesByStaff).map(([staffId, v]) => ({ staffId, ...v })),
        };
      }

      const { data: items } = await supabase
        .from('sale_items')
        .select('product_id, quantity, total_price')
        .in('sale_id', saleIds);

      const productTotals: Record<string, { quantity: number; revenue: number }> = {};
      (items || []).forEach((i: any) => {
        const pid = i.product_id;
        if (!productTotals[pid]) productTotals[pid] = { quantity: 0, revenue: 0 };
        productTotals[pid].quantity += Number(i.quantity || 0);
        productTotals[pid].revenue += Number(i.total_price || 0);
      });

      const productIds = Object.keys(productTotals);
      if (productIds.length === 0) {
        return {
          topProducts: [],
          slowMovingProducts: [],
          paymentMethodBreakdown,
          peakHours,
          salesByStaff: Object.entries(salesByStaff).map(([staffId, v]) => ({ staffId, ...v })),
        };
      }

      const { data: products } = await supabase
        .from('products')
        .select('id, name, selling_price, cost_price, stock_quantity')
        .in('id', productIds);

      const byId = (products || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const topProducts = Object.entries(productTotals)
        .map(([id, t]) => ({
          productId: id,
          name: byId[id]?.name || 'Unknown',
          quantitySold: t.quantity,
          revenue: t.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const withQuantity = Object.entries(productTotals).map(([id, t]) => ({
        productId: id,
        quantitySold: t.quantity,
        revenue: t.revenue,
        ...byId[id],
      }));
      const slowMovingProducts = withQuantity
        .filter((p) => p.name)
        .sort((a, b) => a.quantitySold - b.quantitySold)
        .slice(0, 10)
        .map((p) => ({
          productId: p.productId,
          name: p.name,
          quantitySold: p.quantitySold,
          revenue: p.revenue,
        }));

      return {
        topProducts,
        slowMovingProducts,
        paymentMethodBreakdown,
        peakHours,
        dailyComparison,
        recentDailyMetrics,
        salesByStaff: Object.entries(salesByStaff).map(([staffId, v]) => ({ staffId, ...v })),
      };
    } catch (error) {
      logger.error('Error fetching sales intelligence:', error);
      throw new Error('Failed to fetch sales intelligence');
    }
  }

  async getInventoryFinance(shopId: string, deadStockDays = 30) {
    try {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, cost_price, selling_price, stock_quantity, min_stock_level')
        .eq('shop_id', shopId)
        .eq('is_active', true);

      const prods = products || [];

      let totalStockValue = 0;
      let potentialRevenue = 0;

      const lowStock: Array<{
        productId: string;
        name: string;
        stockQuantity: number;
        minStockLevel: number;
        costPrice: number;
        valueAtRisk: number;
        replenishCost: number;
      }> = [];

      for (const p of prods) {
        const costPrice = Number(p.cost_price || 0);
        const sellingPrice = Number(p.selling_price || 0);
        const qty = Number(p.stock_quantity || 0);
        const minLevel = Number(p.min_stock_level || 0);

        // Total stock value = cost you paid for inventory (cost_price × quantity)
        // e.g. 7×3 + 25×10 + 20×91 for products with qty 3,10,91 and costs 7,25,20
        totalStockValue += costPrice * qty;
        // Potential revenue = what you'd get if sold at selling price (selling_price × quantity)
        // e.g. 3×10 + 10×30 + 91×20 for products with qty 3,10,91 and selling prices 10,30,20
        potentialRevenue += sellingPrice * qty;

        if (minLevel > 0 && qty <= minLevel) {
          const shortfall = Math.max(0, minLevel - qty);
          lowStock.push({
            productId: p.id,
            name: p.name || 'Unknown',
            stockQuantity: qty,
            minStockLevel: minLevel,
            costPrice,
            valueAtRisk: costPrice * qty,
            replenishCost: costPrice * shortfall,
          });
        }
      }

      const potentialProfit = potentialRevenue - totalStockValue;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - deadStockDays);
      const cutoffStr = cutoff.toISOString();

      const { data: recentSalesList } = await supabase
        .from('sales')
        .select('id')
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .gte('created_at', cutoffStr);

      const saleIds = (recentSalesList || []).map((s: any) => s.id);
      const recentlySoldIds = new Set<string>();

      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from('sale_items')
          .select('product_id')
          .in('sale_id', saleIds);
        (items || []).forEach((i: any) => recentlySoldIds.add(i.product_id));
      }

      const deadStock = prods
        .filter((p) => !recentlySoldIds.has(p.id))
        .map((p) => {
          const cost = Number(p.cost_price || 0);
          const qty = Number(p.stock_quantity || 0);
          return {
            productId: p.id,
            name: p.name || 'Unknown',
            stockQuantity: qty,
            stockValue: cost * qty,
          };
        })
        .filter((d) => d.stockQuantity > 0)
        .sort((a, b) => b.stockValue - a.stockValue)
        .slice(0, 20);

      return {
        totalStockValue,
        potentialRevenue,
        potentialProfit,
        lowStock,
        deadStock,
        productCount: prods.length,
      };
    } catch (error) {
      logger.error('Error fetching inventory finance:', error);
      throw new Error('Failed to fetch inventory finance');
    }
  }

  async getExpensesProfitReport(shopId: string, startDate?: string, endDate?: string) {
    try {
      const computeSalesProfitForSaleIds = async (
        saleIds: string[],
        repaymentAmountBySaleId?: Record<string, number>
      ) => {
        if (!saleIds.length) return 0;

        const { data: saleItems } = await supabase
          .from('sale_items')
          .select('product_id, quantity, total_price')
          .in('sale_id', saleIds);

        const items = (saleItems || []) as Array<{ product_id: string; quantity: number; total_price: number }>;
        if (!items.length) return 0;

        const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean)));
        let costByProductId: Record<string, number> = {};

        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select('id, cost_price')
            .in('id', productIds);

          costByProductId = (products || []).reduce((acc: Record<string, number>, p: any) => {
            acc[p.id] = Number(p.cost_price || 0);
            return acc;
          }, {});
        }

        const itemBasedProfit = items.reduce((sum, item) => {
          const lineRevenue = Number(item.total_price || 0);
          const lineCost = Number(costByProductId[item.product_id] || 0) * Number(item.quantity || 0);
          return sum + (lineRevenue - lineCost);
        }, 0);

        const repaymentProfit = saleIds.reduce(
          (sum, id) => sum + Number(repaymentAmountBySaleId?.[id] || 0),
          0
        );

        return itemBasedProfit + repaymentProfit;
      };

      const { start: startTs, end: endTs } = toDateRange(startDate, endDate);
      const dataClearedAt = await getDataClearedAt(shopId);
      const effectiveStart =
        dataClearedAt && (!startTs || dataClearedAt > startTs) ? dataClearedAt : startTs;
      const clearedDateOnly = dataClearedAt ? dataClearedAt.slice(0, 10) : null;
      const effectiveExpenseStart =
        clearedDateOnly && (!startDate || clearedDateOnly > startDate) ? clearedDateOnly : startDate;

      let salesQuery = supabase
        .from('sales')
        .select('id, final_amount, created_at, notes')
        .eq('shop_id', shopId)
        .eq('status', 'completed');
      if (effectiveStart) salesQuery = salesQuery.gte('created_at', effectiveStart);
      if (endTs) salesQuery = salesQuery.lte('created_at', endTs);
      const { data: sales } = await salesQuery;
      const salesList = sales || [];
      const totalRevenue = (salesList as any[]).reduce((s, r) => s + Number(r.final_amount || 0), 0);
      const repaymentAmountBySaleId = (salesList as any[]).reduce((acc: Record<string, number>, s: any) => {
        if (String(s.notes || '').includes('[CREDIT_REPAYMENT]') && s.id) {
          acc[String(s.id)] = Number(s.final_amount || 0);
        }
        return acc;
      }, {});
      const salesProfit = await computeSalesProfitForSaleIds(
        (salesList as any[]).map((s) => s.id).filter(Boolean),
        repaymentAmountBySaleId
      );

      let expensesQuery = supabase
        .from('expenses')
        .select('amount, expense_date, category_id, category:expense_categories(name)')
        .eq('shop_id', shopId);
      if (effectiveExpenseStart) expensesQuery = expensesQuery.gte('expense_date', effectiveExpenseStart);
      if (endDate) expensesQuery = expensesQuery.lte('expense_date', endDate);
      const { data: expenses } = await expensesQuery;
      const expensesList = expenses || [];
      const totalExpenses = (expensesList as any[]).reduce((s, e) => s + Number(e.amount || 0), 0);

      const netProfit = salesProfit - totalExpenses;
      const expenseVsRevenueRatio = totalRevenue > 0 ? totalExpenses / totalRevenue : 0;

      const byCategory: Record<string, { name: string; amount: number; count: number }> = {};
      (expensesList as any[]).forEach((e) => {
        const catId = e.category_id || 'uncategorized';
        const name = e.category?.name || 'Uncategorized';
        if (!byCategory[catId]) byCategory[catId] = { name, amount: 0, count: 0 };
        byCategory[catId].amount += Number(e.amount || 0);
        byCategory[catId].count += 1;
      });
      const expensesByCategory = Object.entries(byCategory).map(([id, v]) => ({
        categoryId: id,
        categoryName: v.name,
        amount: v.amount,
        count: v.count,
      })).sort((a, b) => b.amount - a.amount);

      const revenueByDay: Record<string, number> = {};
      const saleIdsByDay: Record<string, string[]> = {};
      (salesList as any[]).forEach((s) => {
        const day = (s.created_at || '').slice(0, 10);
        if (day) {
          revenueByDay[day] = (revenueByDay[day] || 0) + Number(s.final_amount || 0);
          if (!saleIdsByDay[day]) saleIdsByDay[day] = [];
          if (s.id) saleIdsByDay[day].push(String(s.id));
        }
      });
      const salesProfitByDay: Record<string, number> = {};
      for (const [day, ids] of Object.entries(saleIdsByDay)) {
        salesProfitByDay[day] = await computeSalesProfitForSaleIds(ids, repaymentAmountBySaleId);
      }
      const expensesByDay: Record<string, number> = {};
      (expensesList as any[]).forEach((e) => {
        const day = (e.expense_date || '').toString().slice(0, 10);
        if (day) expensesByDay[day] = (expensesByDay[day] || 0) + Number(e.amount || 0);
      });
      const allDays = new Set([...Object.keys(revenueByDay), ...Object.keys(expensesByDay)]);
      const dailyNetProfit = Array.from(allDays)
        .sort()
        .map((date) => ({
          date,
          revenue: revenueByDay[date] || 0,
          salesProfit: salesProfitByDay[date] || 0,
          expenses: expensesByDay[date] || 0,
          profit: (salesProfitByDay[date] || 0) - (expensesByDay[date] || 0),
        }));

      const now = new Date();
      const monthlyTrend: Array<{
        month: string;
        year: number;
        monthLabel: string;
        revenue: number;
        salesProfit: number;
        expenses: number;
        profit: number;
      }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const monthEnd = new Date(y, m + 1, 0);
        const monthEndStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;
        const monthLabel = monthEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        const { data: ms } = await supabase
          .from('sales')
          .select('id, final_amount, notes')
          .eq('shop_id', shopId)
          .eq('status', 'completed')
          .gte('created_at', `${monthStart}T00:00:00.000Z`)
          .lte('created_at', `${monthEndStr}T23:59:59.999Z`);
        const monthRevenue = (ms || []).reduce((s: number, r: any) => s + Number(r.final_amount || 0), 0);
        const monthRepaymentMap = (ms || []).reduce((acc: Record<string, number>, r: any) => {
          if (String(r.notes || '').includes('[CREDIT_REPAYMENT]') && r.id) {
            acc[String(r.id)] = Number(r.final_amount || 0);
          }
          return acc;
        }, {});
        const monthSalesProfit = await computeSalesProfitForSaleIds(
          (ms || []).map((r: any) => r.id).filter(Boolean),
          monthRepaymentMap
        );

        const { data: me } = await supabase
          .from('expenses')
          .select('amount')
          .eq('shop_id', shopId)
          .gte('expense_date', monthStart)
          .lte('expense_date', monthEndStr);
        const monthExpenses = (me || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

        monthlyTrend.push({
          month: monthStart,
          year: y,
          monthLabel,
          revenue: monthRevenue,
          salesProfit: monthSalesProfit,
          expenses: monthExpenses,
          profit: monthSalesProfit - monthExpenses,
        });
      }

      return {
        totalRevenue,
        salesProfit,
        totalExpenses,
        netProfit,
        expenseVsRevenueRatio,
        expensesByCategory,
        dailyNetProfit,
        monthlyTrend,
      };
    } catch (error) {
      logger.error('Error fetching expenses & profit report:', error);
      throw new Error('Failed to fetch expenses & profit report');
    }
  }

  /** Compliance export: daily | weekly | monthly | pl | tax. Returns one payload for PDF/email. */
  async getComplianceExport(
    shopId: string,
    type: 'daily' | 'weekly' | 'monthly' | 'pl' | 'tax',
    opts: { date?: string; week?: string; startDate?: string; endDate?: string; month?: string }
  ) {
    let startDate: string | undefined;
    let endDate: string | undefined;
    let periodLabel: string;

    if (type === 'daily' && opts.date) {
      startDate = opts.date;
      endDate = opts.date;
      periodLabel = `Daily report – ${opts.date}`;
    } else if (type === 'weekly' && opts.week) {
      const m = /^(\d{4})-W(\d{2})$/.exec(opts.week);
      if (!m) throw new Error('week must be in YYYY-Www format for weekly report');
      const year = Number(m[1]);
      const week = Number(m[2]);

      // ISO week: week 1 contains Jan 4th, week starts Monday.
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7; // convert Sun(0) -> 7
      const mondayWeek1 = new Date(jan4);
      mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
      const monday = new Date(mondayWeek1);
      monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      startDate = monday.toISOString().slice(0, 10);
      endDate = sunday.toISOString().slice(0, 10);
      periodLabel = `Weekly check – ${startDate} to ${endDate}`;
    } else if (type === 'monthly' && (opts.month || opts.date)) {
      const m = opts.month || (opts.date ? opts.date.slice(0, 7) : undefined);
      if (!m) throw new Error('month or date required for monthly report');
      const [y, mo] = m.split('-').map(Number);
      const first = `${y}-${String(mo).padStart(2, '0')}-01`;
      const lastDay = new Date(y, mo, 0).getDate();
      const last = `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      startDate = first;
      endDate = last;
      periodLabel = `Monthly summary – ${m}`;
    } else if ((type === 'pl' || type === 'tax') && opts.startDate && opts.endDate) {
      startDate = opts.startDate;
      endDate = opts.endDate;
      periodLabel = type === 'pl' ? `Profit & Loss – ${startDate} to ${endDate}` : `Tax-ready export – ${startDate} to ${endDate}`;
    } else {
      throw new Error('Invalid type or missing date/range for compliance export');
    }

    const [stats, pl] = await Promise.all([
      this.getDashboardStats(shopId, startDate, endDate),
      this.getExpensesProfitReport(shopId, startDate, endDate),
    ]);

    return {
      type,
      periodLabel,
      startDate,
      endDate,
      totalSales: stats.totalSales,
      totalExpenses: stats.totalExpenses,
      profit: stats.profit,
      totalTransactions: stats.totalTransactions,
      paymentMethodBreakdown: stats.paymentMethodBreakdown,
      expensesByCategory: pl.expensesByCategory,
      dailyNetProfit: pl.dailyNetProfit,
      ...(type === 'monthly' && { monthlyTrend: pl.monthlyTrend }),
    };
  }

  private getPeriodWindows(period: 'daily' | 'weekly' | 'monthly') {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - (days - 1));
    const end = today;
    const prevEnd = new Date(start);
    prevEnd.setUTCDate(start.getUTCDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setUTCDate(prevEnd.getUTCDate() - (days - 1));
    return {
      current: { startDate: toIsoDateOnly(start), endDate: toIsoDateOnly(end) },
      previous: { startDate: toIsoDateOnly(prevStart), endDate: toIsoDateOnly(prevEnd) },
      days,
    };
  }

  private buildForecast(recentDailyMetrics: Array<{ date: string; revenue: number; expenses: number; profit: number }>) {
    const rows = (recentDailyMetrics || []).slice(-14);
    if (!rows.length) {
      return {
        next7Days: { revenue: 0, profit: 0 },
        next30Days: { revenue: 0, profit: 0 },
        confidence: 'low',
      };
    }
    const avgRevenue = rows.reduce((s, r) => s + Number(r.revenue || 0), 0) / rows.length;
    const avgProfit = rows.reduce((s, r) => s + Number(r.profit || 0), 0) / rows.length;
    const firstRev = Number(rows[0]?.revenue || 0);
    const lastRev = Number(rows[rows.length - 1]?.revenue || 0);
    const trendFactor = firstRev > 0 ? Math.max(-0.2, Math.min(0.2, (lastRev - firstRev) / firstRev)) : 0;
    return {
      next7Days: {
        revenue: Math.max(0, avgRevenue * 7 * (1 + trendFactor)),
        profit: avgProfit * 7 * (1 + trendFactor),
      },
      next30Days: {
        revenue: Math.max(0, avgRevenue * 30 * (1 + trendFactor)),
        profit: avgProfit * 30 * (1 + trendFactor),
      },
      confidence: rows.length >= 10 ? 'medium' : 'low',
    };
  }

  private computeKpiHealthScore(input: {
    stats: any;
    comparison: any;
    inventoryFinance: any;
  }) {
    const reasons: string[] = [];
    let score = 100;
    const profit = Number(input.stats?.profit || 0);
    const sales = Number(input.stats?.totalSales || 0);
    const expenses = Number(input.stats?.totalExpenses || 0);
    const lowStockCount = Number(input.stats?.lowStockCount || 0);
    const revenueChange = Number(input.comparison?.revenueChangePercent || 0);
    const profitChange = Number(input.comparison?.profitChangePercent || 0);
    const expenseRatio = sales > 0 ? expenses / sales : 1;

    if (profit < 0) {
      score -= 25;
      reasons.push('Profit is negative in the selected period.');
    }
    if (expenseRatio > 0.65) {
      score -= 20;
      reasons.push('Expenses are high relative to sales.');
    }
    if (profitChange < -10) {
      score -= 15;
      reasons.push('Profit dropped significantly vs previous period.');
    }
    if (revenueChange < -10) {
      score -= 10;
      reasons.push('Revenue is trending down vs previous period.');
    }
    if (lowStockCount >= 5) {
      score -= 10;
      reasons.push('Multiple low-stock items can limit sales.');
    }
    const deadStockCount = Number((input.inventoryFinance?.deadStock || []).length || 0);
    if (deadStockCount >= 5) {
      score -= 10;
      reasons.push('Dead stock is tying up working capital.');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const status = score >= 80 ? 'healthy' : score >= 60 ? 'watch' : 'critical';
    if (!reasons.length) reasons.push('Core KPIs look stable.');
    return { score, status, reasons };
  }

  async getBusinessIntelligence(
    shopId: string,
    _userId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ) {
    const windows = this.getPeriodWindows(period);
    const [currentStats, previousStats, currentIntel, currentInventory] = await Promise.all([
      this.getDashboardStats(shopId, windows.current.startDate, windows.current.endDate),
      this.getDashboardStats(shopId, windows.previous.startDate, windows.previous.endDate),
      this.getSalesIntelligence(shopId, windows.current.startDate, windows.current.endDate),
      this.getInventoryFinance(shopId, 30),
    ]);

    const currentGrossProfit = Number((currentStats?.salesProfit ?? currentStats?.profit) || 0);
    const previousGrossProfit = Number((previousStats?.salesProfit ?? previousStats?.profit) || 0);
    const currentNetProfit = Number(currentStats?.profit || 0);
    const previousNetProfit = Number(previousStats?.profit || 0);

    const comparison = {
      revenueNow: Number(currentStats?.totalSales || 0),
      revenuePrev: Number(previousStats?.totalSales || 0),
      revenueChangePercent: pctChange(Number(currentStats?.totalSales || 0), Number(previousStats?.totalSales || 0)),
      // Keep "profit*" fields as gross profit for dashboard consistency with UI cards.
      profitNow: currentGrossProfit,
      profitPrev: previousGrossProfit,
      profitChangePercent: pctChange(currentGrossProfit, previousGrossProfit),
      netProfitNow: currentNetProfit,
      netProfitPrev: previousNetProfit,
      netProfitChangePercent: pctChange(currentNetProfit, previousNetProfit),
      txNow: Number(currentStats?.totalTransactions || 0),
      txPrev: Number(previousStats?.totalTransactions || 0),
      txChangePercent: pctChange(Number(currentStats?.totalTransactions || 0), Number(previousStats?.totalTransactions || 0)),
    };

    const todayVsYesterdayExplanation =
      Number(comparison.profitChangePercent || 0) < 0
        ? 'Gross profit is down versus the previous period, mainly due to weaker sales mix or lower margin items.'
        : 'Gross profit is stable or improving versus the previous period, supported by current sales performance.';

    const trendDetection = {
      revenueTrend:
        comparison.revenueChangePercent > 5 ? 'up' : comparison.revenueChangePercent < -5 ? 'down' : 'flat',
      profitTrend:
        comparison.profitChangePercent > 5 ? 'up' : comparison.profitChangePercent < -5 ? 'down' : 'flat',
      narrative:
        comparison.revenueChangePercent > 5
          ? 'Sales momentum is improving.'
          : comparison.revenueChangePercent < -5
            ? 'Sales momentum is weakening.'
            : 'Sales momentum is mostly stable.',
    };

    const forecast = this.buildForecast(currentIntel?.recentDailyMetrics || []);
    const kpiHealth = this.computeKpiHealthScore({
      stats: currentStats,
      comparison: {
        revenueChangePercent: comparison.revenueChangePercent,
        profitChangePercent: comparison.profitChangePercent,
      },
      inventoryFinance: currentInventory,
    });

    const paymentInsights = Object.entries(currentStats?.paymentMethodBreakdown || {})
      .map(([method, amount]) => ({ method, amount: Number(amount || 0) }))
      .sort((a, b) => b.amount - a.amount);
    const totalPayment = paymentInsights.reduce((s, p) => s + p.amount, 0);
    const paymentMix = paymentInsights.map((p) => ({
      ...p,
      sharePercent: totalPayment > 0 ? (p.amount / totalPayment) * 100 : 0,
    }));

    const snapshot = {
      period,
      window: windows.current,
      comparison,
      kpis: {
        sales: Number(currentStats?.totalSales || 0),
        expenses: Number(currentStats?.totalExpenses || 0),
        grossProfit: currentGrossProfit,
        netProfit: currentNetProfit,
        transactions: Number(currentStats?.totalTransactions || 0),
      },
      topSellingProducts: (currentIntel?.topProducts || []).slice(0, 5),
      lowPerformingProducts: (currentIntel?.slowMovingProducts || []).slice(0, 5),
      paymentMix: paymentMix.slice(0, 5),
      forecast,
      health: kpiHealth,
    };

    const summaryPrompt = `
You are ShopKeeper BI Copilot for non-technical merchants.
Create a concise business summary using ONLY this JSON:
${JSON.stringify(snapshot, null, 2)}

Currency rules:
- Use GHS as the currency label.
- Never use "$" or "USD".

Terminology rules:
- "Profit" means gross profit from sales (kpis.grossProfit) unless explicitly stated as net profit.
- If mentioning net profit, label it clearly as "net profit".

Return JSON only:
{
  "summary": string,
  "todayVsYesterday": string,
  "trendInsight": string,
  "profitDownWhy": string,
  "engagementHint": string
}
`;

    const ai = await this.callOpenAiThenClaude(summaryPrompt);
    const parsed = this.parseAiJson(ai.text) || {};

    return {
      providerUsed: ai.provider,
      period,
      windows,
      dailyWeeklyMonthlySummary: this.normalizeCurrencyText(String(parsed?.summary || '')),
      todayVsYesterdayExplanation: this.normalizeCurrencyText(String(parsed?.todayVsYesterday || todayVsYesterdayExplanation)),
      trendDetection: {
        ...trendDetection,
        aiNarrative: this.normalizeCurrencyText(String(parsed?.trendInsight || trendDetection.narrative)),
      },
      forecast,
      kpiHealthScore: kpiHealth,
      whyProfitDown: this.normalizeCurrencyText(String(parsed?.profitDownWhy || 'Review sales trend, expense ratio, and payment mix shifts.')),
      topSellingProducts: snapshot.topSellingProducts,
      lowPerformingProducts: snapshot.lowPerformingProducts,
      paymentMethodInsights: {
        mix: paymentMix,
        narrative: this.normalizeCurrencyText(
          paymentMix.length > 0
            ? `Top method: ${paymentMix[0].method} (${paymentMix[0].sharePercent.toFixed(1)}%).`
            : 'No payment method data in selected period.'
        ),
      },
      naturalLanguageDashboardQueryHint: this.normalizeCurrencyText(
        String(parsed?.engagementHint || 'Ask: "Why is profit down?"')
      ),
      snapshot,
    };
  }

  async queryBusinessIntelligence(
    shopId: string,
    userId: string,
    query: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ) {
    const bi = await this.getBusinessIntelligence(shopId, userId, period);
    const prompt = `
You are ShopKeeper BI assistant.
Answer the merchant query using ONLY this BI payload.
Query: ${query}
BI payload:
${JSON.stringify(bi?.snapshot || {}, null, 2)}

Return concise practical text with:
- direct answer
- 2-4 bullet insights
- one recommended action

Currency rules:
- Use GHS as the currency label.
- Never use "$" or "USD".
`;
    const ai = await this.callOpenAiThenClaude(prompt);
    return {
      providerUsed: ai.provider,
      period,
      query,
      answer: this.normalizeCurrencyText(ai.text),
      basedOn: {
        window: bi?.windows?.current,
        health: bi?.kpiHealthScore,
      },
    };
  }

  async getInventoryStockIntelligence(
    shopId: string,
    _userId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ) {
    const windows = this.getPeriodWindows(period);
    const [inventoryFinance, salesIntelCurrent, salesIntelPrev] = await Promise.all([
      this.getInventoryFinance(shopId, period === 'daily' ? 14 : period === 'weekly' ? 30 : 60),
      this.getSalesIntelligence(shopId, windows.current.startDate, windows.current.endDate),
      this.getSalesIntelligence(shopId, windows.previous.startDate, windows.previous.endDate),
    ]);

    const days = windows.days;
    const soldQtyByProduct = ((salesIntelCurrent?.topProducts || []) as any[]).reduce((acc: Record<string, number>, p: any) => {
      acc[String(p.productId)] = Number(p.quantitySold || 0);
      return acc;
    }, {});

    const { data: products } = await supabase
      .from('products')
      .select('id,name,stock_quantity,min_stock_level,cost_price,selling_price')
      .eq('shop_id', shopId)
      .eq('is_active', true);
    const productList = products || [];

    const stockoutRisk = productList
      .map((p: any) => {
        const soldQty = Number(soldQtyByProduct[p.id] || 0);
        const avgDailySold = soldQty / Math.max(1, days);
        const stockQty = Number(p.stock_quantity || 0);
        const daysOfCover = avgDailySold > 0 ? stockQty / avgDailySold : 999;
        const riskLevel = avgDailySold <= 0
          ? 'low'
          : daysOfCover <= 3
            ? 'high'
            : daysOfCover <= 7
              ? 'medium'
              : 'low';
        const targetStock = Math.max(Number(p.min_stock_level || 0), Math.ceil(avgDailySold * 14));
        const reorderQty = Math.max(0, targetStock - stockQty);
        return {
          productId: p.id,
          name: p.name || 'Unknown',
          stockQty,
          avgDailySold,
          daysOfCover: Number.isFinite(daysOfCover) ? Number(daysOfCover.toFixed(1)) : 999,
          riskLevel,
          reorderQty,
          estimatedReorderCost: reorderQty * Number(p.cost_price || 0),
        };
      })
      .filter((r) => r.stockQty > 0 || r.avgDailySold > 0)
      .sort((a, b) => {
        const sev = { high: 3, medium: 2, low: 1 } as Record<string, number>;
        return sev[b.riskLevel] - sev[a.riskLevel] || a.daysOfCover - b.daysOfCover;
      })
      .slice(0, 15);

    const reorderSuggestions = stockoutRisk
      .filter((r) => r.reorderQty > 0)
      .slice(0, 10);

    const paymentCurrent = salesIntelCurrent?.paymentMethodBreakdown || {};
    const paymentPrev = salesIntelPrev?.paymentMethodBreakdown || {};
    const payAmount = (obj: any, key: string) => Number(obj?.[key]?.amount || 0);
    const currentTotalPay = Object.values(paymentCurrent as any).reduce((s: number, p: any) => s + Number(p?.amount || 0), 0);
    const prevTotalPay = Object.values(paymentPrev as any).reduce((s: number, p: any) => s + Number(p?.amount || 0), 0);
    const cashNow = payAmount(paymentCurrent, 'cash');
    const momoNow = payAmount(paymentCurrent, 'mobile_money');
    const cashPrev = payAmount(paymentPrev, 'cash');
    const momoPrev = payAmount(paymentPrev, 'mobile_money');
    const paymentInsights = {
      cashShareNow: currentTotalPay > 0 ? (cashNow / currentTotalPay) * 100 : 0,
      momoShareNow: currentTotalPay > 0 ? (momoNow / currentTotalPay) * 100 : 0,
      cashSharePrev: prevTotalPay > 0 ? (cashPrev / prevTotalPay) * 100 : 0,
      momoSharePrev: prevTotalPay > 0 ? (momoPrev / prevTotalPay) * 100 : 0,
      cashTrendPct: pctChange(cashNow, cashPrev),
      momoTrendPct: pctChange(momoNow, momoPrev),
    };

    const snapshot = {
      period,
      window: windows.current,
      totalStockValue: Number(inventoryFinance?.totalStockValue || 0),
      lowStockCount: Number((inventoryFinance?.lowStock || []).length),
      deadStockCount: Number((inventoryFinance?.deadStock || []).length),
      deadStockValue: Number((inventoryFinance?.deadStock || []).reduce((s: number, d: any) => s + Number(d.stockValue || 0), 0)),
      topSellingProducts: (salesIntelCurrent?.topProducts || []).slice(0, 8),
      lowPerformingProducts: (salesIntelCurrent?.slowMovingProducts || []).slice(0, 8),
      stockoutRisk: stockoutRisk.slice(0, 8),
      reorderSuggestions: reorderSuggestions.slice(0, 8),
      paymentInsights,
    };

    const prompt = `
You are ShopKeeper Inventory Intelligence Copilot.
Use only this JSON:
${JSON.stringify(snapshot, null, 2)}

Return JSON only:
{
  "summary": string,
  "trendNarrative": string,
  "priorityAction": string,
  "kpiHealthReasons": string[]
}
Currency rules:
- Use GHS.
- Never use "$" or "USD".
`;
    const ai = await this.callOpenAiThenClaude(prompt);
    const parsed = this.parseAiJson(ai.text) || {};

    const healthScoreRaw = 100
      - Math.min(35, Number((inventoryFinance?.lowStock || []).length || 0) * 3)
      - Math.min(35, Number((inventoryFinance?.deadStock || []).length || 0) * 2)
      - Math.min(20, stockoutRisk.filter((r) => r.riskLevel === 'high').length * 5);
    const healthScore = Math.max(0, Math.min(100, Math.round(healthScoreRaw)));

    return {
      providerUsed: ai.provider,
      period,
      windows,
      summary: this.normalizeCurrencyText(String(parsed?.summary || '')),
      trendNarrative: this.normalizeCurrencyText(String(parsed?.trendNarrative || '')),
      priorityAction: this.normalizeCurrencyText(String(parsed?.priorityAction || '')),
      kpiHealthScore: {
        score: healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'watch' : 'critical',
        reasons: Array.isArray(parsed?.kpiHealthReasons)
          ? parsed.kpiHealthReasons.map((r: any) => this.normalizeCurrencyText(String(r)))
          : [],
      },
      topSellingProducts: snapshot.topSellingProducts,
      lowPerformingProducts: snapshot.lowPerformingProducts,
      deadStockAlerts: (inventoryFinance?.deadStock || []).slice(0, 10),
      stockoutRisk: snapshot.stockoutRisk,
      reorderSuggestions: snapshot.reorderSuggestions,
      paymentMethodInsights: paymentInsights,
      snapshot,
    };
  }

  async queryInventoryStockIntelligence(
    shopId: string,
    userId: string,
    query: string,
    period: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ) {
    const intelligence = await this.getInventoryStockIntelligence(shopId, userId, period);
    const prompt = `
You are ShopKeeper inventory assistant.
Answer only from this payload.
Query: ${query}
Payload:
${JSON.stringify(intelligence?.snapshot || {}, null, 2)}

Return concise, practical advice with bullets.
Currency rules: Use GHS, not "$" or "USD".
`;
    const ai = await this.callOpenAiThenClaude(prompt);
    return {
      providerUsed: ai.provider,
      period,
      query,
      answer: this.normalizeCurrencyText(ai.text),
      basedOn: {
        window: intelligence?.windows?.current,
        health: intelligence?.kpiHealthScore,
      },
    };
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

  private dateOnly(dt: Date) {
    return dt.toISOString().slice(0, 10);
  }

  private getDefaultRangeForIntent(intent: string) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(today.getUTCDate() - 6);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const quarterStartMonth = Math.floor(today.getUTCMonth() / 3) * 3;
    const quarterStart = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth, 1));

    if (intent === 'inventory_finance') {
      return { startDate: this.dateOnly(monthStart), endDate: this.dateOnly(today) };
    }
    if (intent === 'expenses_profit') {
      return { startDate: this.dateOnly(monthStart), endDate: this.dateOnly(today) };
    }
    if (intent === 'compliance_export') {
      return { startDate: this.dateOnly(quarterStart), endDate: this.dateOnly(today) };
    }
    return { startDate: this.dateOnly(sevenDaysAgo), endDate: this.dateOnly(today) };
  }

  private async callGeminiText(prompt: string): Promise<string> {
    if (!env.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
    const model = env.geminiModel || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 1200,
        },
      }),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini failed (${response.status}): ${errorText.slice(0, 300)}`);
    }
    const data: any = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p: any) => String(p?.text || '')).join('\n').trim();
    if (!text) throw new Error('Gemini returned empty content');
    return text;
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
          { role: 'system', content: 'You are a finance and retail analytics assistant. Return concise, accurate outputs.' },
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
        system: 'You are a business intelligence assistant for retail. Be concise and data-grounded.',
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
      logger.warn('OpenAI BI call failed; trying Claude fallback', { message: String(openErr?.message || openErr) });
      const text = await this.callClaudeText(prompt);
      return { provider: 'claude' as const, text };
    }
  }

  private async parseIntentWithAi(query: string) {
    const range = this.getDefaultRangeForIntent('dashboard');
    const prompt = `
You convert retail report questions into strict JSON.
Return JSON only:
{
  "intent": "dashboard" | "sales_intelligence" | "inventory_finance" | "expenses_profit" | "compliance_export",
  "language": "en" | "twi",
  "startDate": "YYYY-MM-DD" | null,
  "endDate": "YYYY-MM-DD" | null,
  "deadStockDays": number | null,
  "reason": string
}

Rules:
- If question is in Twi or requests Twi, set language=twi.
- If no date range is explicit, use ${range.startDate} to ${range.endDate}.
- inventory finance -> include deadStockDays (default 30).
- Keep reason short.

Question: ${query}
`;

    let provider: 'gemini' | 'openai' | null = null;
    let raw = '';
    const errors: string[] = [];
    try {
      raw = await this.callGeminiText(prompt);
      provider = 'gemini';
    } catch (err: any) {
      errors.push(String(err?.message || err));
      raw = await this.callOpenAiText(prompt);
      provider = 'openai';
    }
    const parsed = this.parseAiJson(raw);
    if (!parsed) {
      throw new Error(`Failed to parse AI intent JSON (${provider || 'none'}). ${errors.join(' | ')}`);
    }
    return { provider, parsed };
  }

  private heuristicIntent(query: string) {
    const q = query.toLowerCase();
    let intent: 'dashboard' | 'sales_intelligence' | 'inventory_finance' | 'expenses_profit' | 'compliance_export' = 'dashboard';
    if (q.includes('inventory') || q.includes('stock') || q.includes('dead stock')) intent = 'inventory_finance';
    else if (q.includes('expense') || q.includes('profit') || q.includes('loss') || q.includes('p&l')) intent = 'expenses_profit';
    else if (q.includes('tax') || q.includes('compliance')) intent = 'compliance_export';
    else if (q.includes('payment') || q.includes('peak') || q.includes('staff')) intent = 'sales_intelligence';
    const language: 'en' | 'twi' = q.includes('twi') ? 'twi' : 'en';
    const range = this.getDefaultRangeForIntent(intent);
    return {
      intent,
      language,
      startDate: range.startDate,
      endDate: range.endDate,
      deadStockDays: 30,
      reason: 'Fallback heuristic intent.',
    };
  }

  private buildSnapshot(intent: string, data: any) {
    if (intent === 'dashboard') {
      return {
        totalSales: Number(data?.totalSales || 0),
        totalExpenses: Number(data?.totalExpenses || 0),
        profit: Number(data?.profit || 0),
        transactions: Number(data?.totalTransactions || 0),
        lowStockCount: Number(data?.lowStockCount || 0),
      };
    }
    if (intent === 'sales_intelligence') {
      return {
        topProducts: (data?.topProducts || []).slice(0, 5),
        peakHours: (data?.peakHours || []).slice(0, 3),
        paymentMethodBreakdown: data?.paymentMethodBreakdown || {},
        dailyComparison: data?.dailyComparison || {},
      };
    }
    if (intent === 'inventory_finance') {
      return {
        totalStockValue: Number(data?.totalStockValue || 0),
        potentialRevenue: Number(data?.potentialRevenue || 0),
        potentialProfit: Number(data?.potentialProfit || 0),
        lowStockCount: Number((data?.lowStock || []).length),
        deadStockCount: Number((data?.deadStock || []).length),
      };
    }
    if (intent === 'expenses_profit') {
      return {
        totalRevenue: Number(data?.totalRevenue || 0),
        salesProfit: Number(data?.salesProfit || 0),
        totalExpenses: Number(data?.totalExpenses || 0),
        netProfit: Number(data?.netProfit || 0),
        topExpenseCategories: (data?.expensesByCategory || []).slice(0, 5),
      };
    }
    return {
      periodLabel: data?.periodLabel,
      totalSales: Number(data?.totalSales || 0),
      totalExpenses: Number(data?.totalExpenses || 0),
      profit: Number(data?.profit || 0),
      totalTransactions: Number(data?.totalTransactions || 0),
    };
  }

  private async summarizeWithAi(
    query: string,
    language: 'en' | 'twi',
    intent: string,
    snapshot: any,
    currency: string = 'GHS'
  ) {
    const langInstruction = language === 'twi'
      ? 'Respond in natural Ghanaian Twi. Keep numerals as-is.'
      : 'Respond in clear English.';
    const currencyRule = `Use ${currency} for all monetary amounts. Never use "$" or "USD".`;
    const prompt = `
You are ShopKeeper owner copilot.
${langInstruction}
${currencyRule}
Answer the owner question using only the report snapshot.
Keep answer practical and concise:
- one headline insight
- 3 bullet takeaways
- one recommended next action

Owner question: ${query}
Intent: ${intent}
Snapshot JSON:
${JSON.stringify(snapshot, null, 2)}
`;

    try {
      const answer = await this.callGeminiText(prompt);
      return { provider: 'gemini', answer };
    } catch (geminiErr: any) {
      logger.warn('Gemini summary failed; using OpenAI fallback', { message: String(geminiErr?.message || geminiErr) });
      const answer = await this.callOpenAiText(prompt);
      return { provider: 'openai', answer };
    }
  }

  async getNaturalLanguageReport(
    shopId: string,
    _userId: string,
    query: string,
    requestedLanguage: 'en' | 'twi' | 'auto' = 'auto'
  ) {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) throw new Error('query is required');

    let intentResult: any;
    let intentProvider: 'gemini' | 'openai' | 'heuristic' = 'heuristic';
    try {
      const ai = await this.parseIntentWithAi(cleanQuery);
      intentResult = ai.parsed;
      intentProvider = (ai.provider || 'openai') as 'gemini' | 'openai';
    } catch (err: any) {
      logger.warn('AI intent parsing failed; using heuristic', { message: String(err?.message || err) });
      intentResult = this.heuristicIntent(cleanQuery);
      intentProvider = 'heuristic';
    }

    const intent = String(intentResult?.intent || 'dashboard') as
      | 'dashboard'
      | 'sales_intelligence'
      | 'inventory_finance'
      | 'expenses_profit'
      | 'compliance_export';
    const defaults = this.getDefaultRangeForIntent(intent);
    const startDate = String(intentResult?.startDate || defaults.startDate);
    const endDate = String(intentResult?.endDate || defaults.endDate);
    const inferredLanguage: 'en' | 'twi' =
      String(intentResult?.language || 'en').toLowerCase() === 'twi' ? 'twi' : 'en';
    const language: 'en' | 'twi' =
      requestedLanguage === 'auto'
        ? inferredLanguage
        : requestedLanguage === 'twi'
          ? 'twi'
          : 'en';
    const deadStockDays = Number(intentResult?.deadStockDays || 30);

    let rawData: any;
    let periodLabel = `${startDate} to ${endDate}`;

    if (intent === 'sales_intelligence') {
      rawData = await this.getSalesIntelligence(shopId, startDate, endDate);
      periodLabel = `Sales intelligence (${startDate} to ${endDate})`;
    } else if (intent === 'inventory_finance') {
      rawData = await this.getInventoryFinance(shopId, Number.isFinite(deadStockDays) ? deadStockDays : 30);
      periodLabel = `Inventory finance (dead stock ${deadStockDays || 30} days)`;
    } else if (intent === 'expenses_profit') {
      rawData = await this.getExpensesProfitReport(shopId, startDate, endDate);
      periodLabel = `Expenses & profit (${startDate} to ${endDate})`;
    } else if (intent === 'compliance_export') {
      rawData = await this.getComplianceExport(shopId, 'tax', { startDate, endDate });
      periodLabel = String(rawData?.periodLabel || `Compliance (${startDate} to ${endDate})`);
    } else {
      rawData = await this.getDashboardStats(shopId, startDate, endDate);
      periodLabel = `Dashboard summary (${startDate} to ${endDate})`;
    }

    const snapshot = this.buildSnapshot(intent, rawData);
    const currency = await getShopCurrency(shopId);
    const summary = await this.summarizeWithAi(cleanQuery, language, intent, snapshot, currency);

    const chartReferences =
      intent === 'sales_intelligence'
        ? {
            key: 'recentDailyMetrics',
            title: 'Revenue/Expenses/Profit trend',
            points: (rawData?.recentDailyMetrics || []).slice(-14).map((d: any) => ({
              x: String(d?.date || ''),
              revenue: Number(d?.revenue || 0),
              expenses: Number(d?.expenses || 0),
              profit: Number(d?.profit || 0),
            })),
          }
        : intent === 'expenses_profit'
          ? {
              key: 'dailyNetProfit',
              title: 'Daily net profit trend',
              points: (rawData?.dailyNetProfit || []).slice(-14).map((d: any) => ({
                x: String(d?.date || ''),
                revenue: Number(d?.revenue || 0),
                expenses: Number(d?.expenses || 0),
                profit: Number(d?.profit || 0),
              })),
            }
          : intent === 'inventory_finance'
            ? {
                key: 'stockRisk',
                title: 'Low/dead stock risk list',
                points: [
                  { label: 'lowStockCount', value: Number((rawData?.lowStock || []).length) },
                  { label: 'deadStockCount', value: Number((rawData?.deadStock || []).length) },
                ],
              }
            : {
                key: 'kpis',
                title: 'KPI snapshot',
                points: [
                  { label: 'totalSales', value: Number(snapshot?.totalSales || 0) },
                  { label: 'totalExpenses', value: Number(snapshot?.totalExpenses || 0) },
                  { label: 'profit', value: Number(snapshot?.profit || 0) },
                ],
              };

    return {
      intent,
      language,
      periodLabel,
      providerUsed: summary.provider,
      intentProvider,
      answer: summary.answer,
      snapshot,
      chartReferences,
      sourceRange: { startDate, endDate },
    };
  }
}
