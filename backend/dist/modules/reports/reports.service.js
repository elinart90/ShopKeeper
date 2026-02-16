"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const supabase_1 = require("../../config/supabase");
const logger_1 = require("../../utils/logger");
/** Normalize date range to full days: start = 00:00:00, end = 23:59:59.999 (UTC) so sales that day are included. */
function toDateRange(startDate, endDate) {
    const start = startDate ? `${startDate}T00:00:00.000Z` : undefined;
    const end = endDate ? `${endDate}T23:59:59.999Z` : undefined;
    return { start, end };
}
/** When shop has data_cleared_at, dashboard only shows data on or after that time. */
async function getDataClearedAt(shopId) {
    const { data } = await supabase_1.supabase
        .from('shops')
        .select('data_cleared_at')
        .eq('id', shopId)
        .single();
    return data?.data_cleared_at ?? null;
}
class ReportsService {
    async getDashboardStats(shopId, startDate, endDate) {
        try {
            const { start: startTs, end: endTs } = toDateRange(startDate, endDate);
            const dataClearedAt = await getDataClearedAt(shopId);
            const effectiveStart = dataClearedAt && (!startTs || dataClearedAt > startTs) ? dataClearedAt : startTs;
            let salesQuery = supabase_1.supabase
                .from('sales')
                .select('id, final_amount, payment_method, created_at, created_by')
                .eq('shop_id', shopId)
                .eq('status', 'completed');
            if (effectiveStart)
                salesQuery = salesQuery.gte('created_at', effectiveStart);
            if (endTs)
                salesQuery = salesQuery.lte('created_at', endTs);
            const { data: sales } = await salesQuery;
            const filteredSales = sales || [];
            const totalSales = filteredSales.reduce((sum, s) => sum + Number(s.final_amount), 0);
            const totalTransactions = filteredSales.length;
            const saleIds = filteredSales.map((s) => s.id).filter(Boolean);
            // Sales profit (gross profit) = sum of sold item totals - item costs (cost_price * quantity).
            // This keeps the dashboard profit tied to actual sales made in the selected period.
            let salesProfit = 0;
            if (saleIds.length > 0) {
                const { data: saleItems } = await supabase_1.supabase
                    .from('sale_items')
                    .select('product_id, quantity, total_price')
                    .in('sale_id', saleIds);
                const items = (saleItems || []);
                const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean)));
                let costByProductId = {};
                if (productIds.length > 0) {
                    const { data: products } = await supabase_1.supabase
                        .from('products')
                        .select('id, cost_price')
                        .in('id', productIds);
                    costByProductId = (products || []).reduce((acc, p) => {
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
            const paymentMethodBreakdown = filteredSales.reduce((acc, s) => {
                const method = s.payment_method || 'cash';
                acc[method] = (acc[method] || 0) + Number(s.final_amount || 0);
                return acc;
            }, {});
            const activeStaffToday = new Set(filteredSales.map((s) => s.created_by).filter(Boolean)).size;
            const clearedDateOnly = dataClearedAt ? dataClearedAt.slice(0, 10) : null;
            const effectiveExpenseStart = clearedDateOnly && (!startDate || clearedDateOnly > startDate) ? clearedDateOnly : startDate;
            let expensesQuery = supabase_1.supabase
                .from('expenses')
                .select('amount, expense_date')
                .eq('shop_id', shopId);
            if (effectiveExpenseStart)
                expensesQuery = expensesQuery.gte('expense_date', effectiveExpenseStart);
            if (endTs)
                expensesQuery = expensesQuery.lte('expense_date', endDate);
            const { data: expenses } = await expensesQuery;
            const filteredExpenses = expenses || [];
            const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
            const profit = totalSales - totalExpenses;
            const { data: products } = await supabase_1.supabase
                .from('products')
                .select('id, stock_quantity, min_stock_level')
                .eq('shop_id', shopId)
                .eq('is_active', true);
            const lowStockCount = (products || []).filter((p) => Number(p.stock_quantity) <= Number(p.min_stock_level || 0)).length;
            return {
                totalSales,
                totalExpenses,
                profit,
                salesProfit,
                totalTransactions,
                lowStockCount,
                averageTransaction: totalTransactions > 0 ? totalSales / totalTransactions : 0,
                paymentMethodBreakdown,
                activeStaffToday,
            };
        }
        catch (error) {
            logger_1.logger.error('Error fetching dashboard stats:', error);
            throw new Error('Failed to fetch dashboard stats');
        }
    }
    async getSalesIntelligence(shopId, startDate, endDate) {
        try {
            const { start: startTs, end: endTs } = toDateRange(startDate, endDate);
            const dataClearedAt = await getDataClearedAt(shopId);
            const effectiveStart = dataClearedAt && (!startTs || dataClearedAt > startTs) ? dataClearedAt : startTs;
            let salesQuery = supabase_1.supabase
                .from('sales')
                .select('id, final_amount, payment_method, created_at, created_by')
                .eq('shop_id', shopId)
                .eq('status', 'completed');
            if (effectiveStart)
                salesQuery = salesQuery.gte('created_at', effectiveStart);
            if (endTs)
                salesQuery = salesQuery.lte('created_at', endTs);
            const { data: sales } = await salesQuery;
            const saleIds = (sales || []).map((s) => s.id);
            const paymentMethodBreakdown = (sales || []).reduce((acc, s) => {
                const method = s.payment_method || 'cash';
                if (!acc[method])
                    acc[method] = { amount: 0, count: 0 };
                acc[method].amount += Number(s.final_amount || 0);
                acc[method].count += 1;
                return acc;
            }, {});
            const salesByHour = {};
            for (let h = 0; h < 24; h++)
                salesByHour[h] = 0;
            (sales || []).forEach((s) => {
                const hour = new Date(s.created_at).getHours();
                salesByHour[hour] = (salesByHour[hour] || 0) + Number(s.final_amount || 0);
            });
            const peakHours = Object.entries(salesByHour)
                .map(([hour, amount]) => ({ hour: Number(hour), amount }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5);
            const salesByStaff = {};
            (sales || []).forEach((s) => {
                const id = s.created_by || 'unknown';
                if (!salesByStaff[id])
                    salesByStaff[id] = { amount: 0, count: 0 };
                salesByStaff[id].amount += Number(s.final_amount || 0);
                salesByStaff[id].count += 1;
            });
            if (saleIds.length === 0) {
                return {
                    topProducts: [],
                    slowMovingProducts: [],
                    paymentMethodBreakdown,
                    peakHours,
                    salesByStaff: Object.entries(salesByStaff).map(([staffId, v]) => ({ staffId, ...v })),
                };
            }
            const { data: items } = await supabase_1.supabase
                .from('sale_items')
                .select('product_id, quantity, total_price')
                .in('sale_id', saleIds);
            const productTotals = {};
            (items || []).forEach((i) => {
                const pid = i.product_id;
                if (!productTotals[pid])
                    productTotals[pid] = { quantity: 0, revenue: 0 };
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
            const { data: products } = await supabase_1.supabase
                .from('products')
                .select('id, name, selling_price, cost_price, stock_quantity')
                .in('id', productIds);
            const byId = (products || []).reduce((acc, p) => {
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
                salesByStaff: Object.entries(salesByStaff).map(([staffId, v]) => ({ staffId, ...v })),
            };
        }
        catch (error) {
            logger_1.logger.error('Error fetching sales intelligence:', error);
            throw new Error('Failed to fetch sales intelligence');
        }
    }
    async getInventoryFinance(shopId, deadStockDays = 30) {
        try {
            const { data: products } = await supabase_1.supabase
                .from('products')
                .select('id, name, cost_price, selling_price, stock_quantity, min_stock_level')
                .eq('shop_id', shopId)
                .eq('is_active', true);
            const prods = products || [];
            let totalStockValue = 0;
            let potentialRevenue = 0;
            const lowStock = [];
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
            const { data: recentSalesList } = await supabase_1.supabase
                .from('sales')
                .select('id')
                .eq('shop_id', shopId)
                .eq('status', 'completed')
                .gte('created_at', cutoffStr);
            const saleIds = (recentSalesList || []).map((s) => s.id);
            const recentlySoldIds = new Set();
            if (saleIds.length > 0) {
                const { data: items } = await supabase_1.supabase
                    .from('sale_items')
                    .select('product_id')
                    .in('sale_id', saleIds);
                (items || []).forEach((i) => recentlySoldIds.add(i.product_id));
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
        }
        catch (error) {
            logger_1.logger.error('Error fetching inventory finance:', error);
            throw new Error('Failed to fetch inventory finance');
        }
    }
    async getExpensesProfitReport(shopId, startDate, endDate) {
        try {
            const computeSalesProfitForSaleIds = async (saleIds) => {
                if (!saleIds.length)
                    return 0;
                const { data: saleItems } = await supabase_1.supabase
                    .from('sale_items')
                    .select('product_id, quantity, total_price')
                    .in('sale_id', saleIds);
                const items = (saleItems || []);
                if (!items.length)
                    return 0;
                const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean)));
                let costByProductId = {};
                if (productIds.length > 0) {
                    const { data: products } = await supabase_1.supabase
                        .from('products')
                        .select('id, cost_price')
                        .in('id', productIds);
                    costByProductId = (products || []).reduce((acc, p) => {
                        acc[p.id] = Number(p.cost_price || 0);
                        return acc;
                    }, {});
                }
                return items.reduce((sum, item) => {
                    const lineRevenue = Number(item.total_price || 0);
                    const lineCost = Number(costByProductId[item.product_id] || 0) * Number(item.quantity || 0);
                    return sum + (lineRevenue - lineCost);
                }, 0);
            };
            const { start: startTs, end: endTs } = toDateRange(startDate, endDate);
            const dataClearedAt = await getDataClearedAt(shopId);
            const effectiveStart = dataClearedAt && (!startTs || dataClearedAt > startTs) ? dataClearedAt : startTs;
            const clearedDateOnly = dataClearedAt ? dataClearedAt.slice(0, 10) : null;
            const effectiveExpenseStart = clearedDateOnly && (!startDate || clearedDateOnly > startDate) ? clearedDateOnly : startDate;
            let salesQuery = supabase_1.supabase
                .from('sales')
                .select('id, final_amount, created_at')
                .eq('shop_id', shopId)
                .eq('status', 'completed');
            if (effectiveStart)
                salesQuery = salesQuery.gte('created_at', effectiveStart);
            if (endTs)
                salesQuery = salesQuery.lte('created_at', endTs);
            const { data: sales } = await salesQuery;
            const salesList = sales || [];
            const totalRevenue = salesList.reduce((s, r) => s + Number(r.final_amount || 0), 0);
            const salesProfit = await computeSalesProfitForSaleIds(salesList.map((s) => s.id).filter(Boolean));
            let expensesQuery = supabase_1.supabase
                .from('expenses')
                .select('amount, expense_date, category_id, category:expense_categories(name)')
                .eq('shop_id', shopId);
            if (effectiveExpenseStart)
                expensesQuery = expensesQuery.gte('expense_date', effectiveExpenseStart);
            if (endDate)
                expensesQuery = expensesQuery.lte('expense_date', endDate);
            const { data: expenses } = await expensesQuery;
            const expensesList = expenses || [];
            const totalExpenses = expensesList.reduce((s, e) => s + Number(e.amount || 0), 0);
            const netProfit = salesProfit - totalExpenses;
            const expenseVsRevenueRatio = totalRevenue > 0 ? totalExpenses / totalRevenue : 0;
            const byCategory = {};
            expensesList.forEach((e) => {
                const catId = e.category_id || 'uncategorized';
                const name = e.category?.name || 'Uncategorized';
                if (!byCategory[catId])
                    byCategory[catId] = { name, amount: 0, count: 0 };
                byCategory[catId].amount += Number(e.amount || 0);
                byCategory[catId].count += 1;
            });
            const expensesByCategory = Object.entries(byCategory).map(([id, v]) => ({
                categoryId: id,
                categoryName: v.name,
                amount: v.amount,
                count: v.count,
            })).sort((a, b) => b.amount - a.amount);
            const revenueByDay = {};
            const saleIdsByDay = {};
            salesList.forEach((s) => {
                const day = (s.created_at || '').slice(0, 10);
                if (day) {
                    revenueByDay[day] = (revenueByDay[day] || 0) + Number(s.final_amount || 0);
                    if (!saleIdsByDay[day])
                        saleIdsByDay[day] = [];
                    if (s.id)
                        saleIdsByDay[day].push(String(s.id));
                }
            });
            const salesProfitByDay = {};
            for (const [day, ids] of Object.entries(saleIdsByDay)) {
                salesProfitByDay[day] = await computeSalesProfitForSaleIds(ids);
            }
            const expensesByDay = {};
            expensesList.forEach((e) => {
                const day = (e.expense_date || '').toString().slice(0, 10);
                if (day)
                    expensesByDay[day] = (expensesByDay[day] || 0) + Number(e.amount || 0);
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
            const monthlyTrend = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const y = d.getFullYear();
                const m = d.getMonth();
                const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
                const monthEnd = new Date(y, m + 1, 0);
                const monthEndStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;
                const monthLabel = monthEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                const { data: ms } = await supabase_1.supabase
                    .from('sales')
                    .select('id, final_amount')
                    .eq('shop_id', shopId)
                    .eq('status', 'completed')
                    .gte('created_at', `${monthStart}T00:00:00.000Z`)
                    .lte('created_at', `${monthEndStr}T23:59:59.999Z`);
                const monthRevenue = (ms || []).reduce((s, r) => s + Number(r.final_amount || 0), 0);
                const monthSalesProfit = await computeSalesProfitForSaleIds((ms || []).map((r) => r.id).filter(Boolean));
                const { data: me } = await supabase_1.supabase
                    .from('expenses')
                    .select('amount')
                    .eq('shop_id', shopId)
                    .gte('expense_date', monthStart)
                    .lte('expense_date', monthEndStr);
                const monthExpenses = (me || []).reduce((s, e) => s + Number(e.amount || 0), 0);
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
        }
        catch (error) {
            logger_1.logger.error('Error fetching expenses & profit report:', error);
            throw new Error('Failed to fetch expenses & profit report');
        }
    }
    /** Compliance export: daily | monthly | pl | tax. Returns one payload for PDF/email. */
    async getComplianceExport(shopId, type, opts) {
        let startDate;
        let endDate;
        let periodLabel;
        if (type === 'daily' && opts.date) {
            startDate = opts.date;
            endDate = opts.date;
            periodLabel = `Daily report – ${opts.date}`;
        }
        else if (type === 'monthly' && (opts.month || opts.date)) {
            const m = opts.month || (opts.date ? opts.date.slice(0, 7) : undefined);
            if (!m)
                throw new Error('month or date required for monthly report');
            const [y, mo] = m.split('-').map(Number);
            const first = `${y}-${String(mo).padStart(2, '0')}-01`;
            const lastDay = new Date(y, mo, 0).getDate();
            const last = `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            startDate = first;
            endDate = last;
            periodLabel = `Monthly summary – ${m}`;
        }
        else if ((type === 'pl' || type === 'tax') && opts.startDate && opts.endDate) {
            startDate = opts.startDate;
            endDate = opts.endDate;
            periodLabel = type === 'pl' ? `Profit & Loss – ${startDate} to ${endDate}` : `Tax-ready export – ${startDate} to ${endDate}`;
        }
        else {
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
exports.ReportsService = ReportsService;
//# sourceMappingURL=reports.service.js.map