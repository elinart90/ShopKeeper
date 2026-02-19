import { supabase } from '../../config/supabase';
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

export class ReportsService {
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
}
