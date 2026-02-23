export declare class ReportsService {
    private normalizeCurrencyText;
    getDashboardStats(shopId: string, startDate?: string, endDate?: string): Promise<{
        totalSales: number;
        totalExpenses: number;
        profit: number;
        salesProfit: number;
        totalTransactions: number;
        lowStockCount: number;
        lowStockItems: {
            productId: any;
            name: any;
            stockQuantity: number;
            minStockLevel: number;
        }[];
        averageTransaction: number;
        paymentMethodBreakdown: Record<string, number>;
        activeStaffToday: number;
    }>;
    getSalesIntelligence(shopId: string, startDate?: string, endDate?: string): Promise<{
        topProducts: never[];
        slowMovingProducts: never[];
        paymentMethodBreakdown: Record<string, {
            amount: number;
            count: number;
        }>;
        peakHours: {
            hour: number;
            amount: number;
        }[];
        salesByStaff: {
            amount: number;
            count: number;
            staffId: string;
        }[];
        dailyComparison?: undefined;
        recentDailyMetrics?: undefined;
    } | {
        topProducts: {
            productId: string;
            name: any;
            quantitySold: number;
            revenue: number;
        }[];
        slowMovingProducts: {
            productId: any;
            name: any;
            quantitySold: any;
            revenue: any;
        }[];
        paymentMethodBreakdown: Record<string, {
            amount: number;
            count: number;
        }>;
        peakHours: {
            hour: number;
            amount: number;
        }[];
        dailyComparison: {
            revenueToday: number;
            revenueYesterday: number;
            revenueChangePercent: number;
            expenseToday: number;
            expenseYesterday: number;
            expenseChangePercent: number;
            profitToday: number;
            profitYesterday: number;
            profitChangePercent: number;
        };
        recentDailyMetrics: {
            date: string;
            revenue: number;
            expenses: number;
            profit: number;
        }[];
        salesByStaff: {
            amount: number;
            count: number;
            staffId: string;
        }[];
    }>;
    getInventoryFinance(shopId: string, deadStockDays?: number): Promise<{
        totalStockValue: number;
        potentialRevenue: number;
        potentialProfit: number;
        lowStock: {
            productId: string;
            name: string;
            stockQuantity: number;
            minStockLevel: number;
            costPrice: number;
            valueAtRisk: number;
            replenishCost: number;
        }[];
        deadStock: {
            productId: any;
            name: any;
            stockQuantity: number;
            stockValue: number;
        }[];
        productCount: number;
    }>;
    getExpensesProfitReport(shopId: string, startDate?: string, endDate?: string): Promise<{
        totalRevenue: any;
        salesProfit: number;
        totalExpenses: any;
        netProfit: number;
        expenseVsRevenueRatio: number;
        expensesByCategory: {
            categoryId: string;
            categoryName: string;
            amount: number;
            count: number;
        }[];
        dailyNetProfit: {
            date: string;
            revenue: number;
            salesProfit: number;
            expenses: number;
            profit: number;
        }[];
        monthlyTrend: {
            month: string;
            year: number;
            monthLabel: string;
            revenue: number;
            salesProfit: number;
            expenses: number;
            profit: number;
        }[];
    }>;
    /** Compliance export: daily | weekly | monthly | pl | tax. Returns one payload for PDF/email. */
    getComplianceExport(shopId: string, type: 'daily' | 'weekly' | 'monthly' | 'pl' | 'tax', opts: {
        date?: string;
        week?: string;
        startDate?: string;
        endDate?: string;
        month?: string;
    }): Promise<{
        monthlyTrend?: {
            month: string;
            year: number;
            monthLabel: string;
            revenue: number;
            salesProfit: number;
            expenses: number;
            profit: number;
        }[] | undefined;
        type: "monthly" | "pl" | "daily" | "weekly" | "tax";
        periodLabel: string;
        startDate: string;
        endDate: string;
        totalSales: number;
        totalExpenses: number;
        profit: number;
        totalTransactions: number;
        paymentMethodBreakdown: Record<string, number>;
        expensesByCategory: {
            categoryId: string;
            categoryName: string;
            amount: number;
            count: number;
        }[];
        dailyNetProfit: {
            date: string;
            revenue: number;
            salesProfit: number;
            expenses: number;
            profit: number;
        }[];
    }>;
    private getPeriodWindows;
    private buildForecast;
    private computeKpiHealthScore;
    getBusinessIntelligence(shopId: string, _userId: string, period?: 'daily' | 'weekly' | 'monthly'): Promise<{
        providerUsed: "openai" | "claude";
        period: "monthly" | "daily" | "weekly";
        windows: {
            current: {
                startDate: string;
                endDate: string;
            };
            previous: {
                startDate: string;
                endDate: string;
            };
            days: number;
        };
        dailyWeeklyMonthlySummary: string;
        todayVsYesterdayExplanation: string;
        trendDetection: {
            aiNarrative: string;
            revenueTrend: string;
            profitTrend: string;
            narrative: string;
        };
        forecast: {
            next7Days: {
                revenue: number;
                profit: number;
            };
            next30Days: {
                revenue: number;
                profit: number;
            };
            confidence: string;
        };
        kpiHealthScore: {
            score: number;
            status: string;
            reasons: string[];
        };
        whyProfitDown: string;
        topSellingProducts: {
            productId: string;
            name: any;
            quantitySold: number;
            revenue: number;
        }[];
        lowPerformingProducts: {
            productId: any;
            name: any;
            quantitySold: any;
            revenue: any;
        }[];
        paymentMethodInsights: {
            mix: {
                sharePercent: number;
                method: string;
                amount: number;
            }[];
            narrative: string;
        };
        naturalLanguageDashboardQueryHint: string;
        snapshot: {
            period: "monthly" | "daily" | "weekly";
            window: {
                startDate: string;
                endDate: string;
            };
            comparison: {
                revenueNow: number;
                revenuePrev: number;
                revenueChangePercent: number;
                profitNow: number;
                profitPrev: number;
                profitChangePercent: number;
                netProfitNow: number;
                netProfitPrev: number;
                netProfitChangePercent: number;
                txNow: number;
                txPrev: number;
                txChangePercent: number;
            };
            kpis: {
                sales: number;
                expenses: number;
                grossProfit: number;
                netProfit: number;
                transactions: number;
            };
            topSellingProducts: {
                productId: string;
                name: any;
                quantitySold: number;
                revenue: number;
            }[];
            lowPerformingProducts: {
                productId: any;
                name: any;
                quantitySold: any;
                revenue: any;
            }[];
            paymentMix: {
                sharePercent: number;
                method: string;
                amount: number;
            }[];
            forecast: {
                next7Days: {
                    revenue: number;
                    profit: number;
                };
                next30Days: {
                    revenue: number;
                    profit: number;
                };
                confidence: string;
            };
            health: {
                score: number;
                status: string;
                reasons: string[];
            };
        };
    }>;
    queryBusinessIntelligence(shopId: string, userId: string, query: string, period?: 'daily' | 'weekly' | 'monthly'): Promise<{
        providerUsed: "openai" | "claude";
        period: "monthly" | "daily" | "weekly";
        query: string;
        answer: string;
        basedOn: {
            window: {
                startDate: string;
                endDate: string;
            };
            health: {
                score: number;
                status: string;
                reasons: string[];
            };
        };
    }>;
    getInventoryStockIntelligence(shopId: string, _userId: string, period?: 'daily' | 'weekly' | 'monthly'): Promise<{
        providerUsed: "openai" | "claude";
        period: "monthly" | "daily" | "weekly";
        windows: {
            current: {
                startDate: string;
                endDate: string;
            };
            previous: {
                startDate: string;
                endDate: string;
            };
            days: number;
        };
        summary: string;
        trendNarrative: string;
        priorityAction: string;
        kpiHealthScore: {
            score: number;
            status: string;
            reasons: any;
        };
        topSellingProducts: {
            productId: string;
            name: any;
            quantitySold: number;
            revenue: number;
        }[];
        lowPerformingProducts: {
            productId: any;
            name: any;
            quantitySold: any;
            revenue: any;
        }[];
        deadStockAlerts: {
            productId: any;
            name: any;
            stockQuantity: number;
            stockValue: number;
        }[];
        stockoutRisk: {
            productId: any;
            name: any;
            stockQty: number;
            avgDailySold: number;
            daysOfCover: number;
            riskLevel: string;
            reorderQty: number;
            estimatedReorderCost: number;
        }[];
        reorderSuggestions: {
            productId: any;
            name: any;
            stockQty: number;
            avgDailySold: number;
            daysOfCover: number;
            riskLevel: string;
            reorderQty: number;
            estimatedReorderCost: number;
        }[];
        paymentMethodInsights: {
            cashShareNow: number;
            momoShareNow: number;
            cashSharePrev: number;
            momoSharePrev: number;
            cashTrendPct: number;
            momoTrendPct: number;
        };
        snapshot: {
            period: "monthly" | "daily" | "weekly";
            window: {
                startDate: string;
                endDate: string;
            };
            totalStockValue: number;
            lowStockCount: number;
            deadStockCount: number;
            deadStockValue: number;
            topSellingProducts: {
                productId: string;
                name: any;
                quantitySold: number;
                revenue: number;
            }[];
            lowPerformingProducts: {
                productId: any;
                name: any;
                quantitySold: any;
                revenue: any;
            }[];
            stockoutRisk: {
                productId: any;
                name: any;
                stockQty: number;
                avgDailySold: number;
                daysOfCover: number;
                riskLevel: string;
                reorderQty: number;
                estimatedReorderCost: number;
            }[];
            reorderSuggestions: {
                productId: any;
                name: any;
                stockQty: number;
                avgDailySold: number;
                daysOfCover: number;
                riskLevel: string;
                reorderQty: number;
                estimatedReorderCost: number;
            }[];
            paymentInsights: {
                cashShareNow: number;
                momoShareNow: number;
                cashSharePrev: number;
                momoSharePrev: number;
                cashTrendPct: number;
                momoTrendPct: number;
            };
        };
    }>;
    queryInventoryStockIntelligence(shopId: string, userId: string, query: string, period?: 'daily' | 'weekly' | 'monthly'): Promise<{
        providerUsed: "openai" | "claude";
        period: "monthly" | "daily" | "weekly";
        query: string;
        answer: string;
        basedOn: {
            window: {
                startDate: string;
                endDate: string;
            };
            health: {
                score: number;
                status: string;
                reasons: any;
            };
        };
    }>;
    private parseAiJson;
    private dateOnly;
    private getDefaultRangeForIntent;
    private callGeminiText;
    private callOpenAiText;
    private callClaudeText;
    private callOpenAiThenClaude;
    private parseIntentWithAi;
    private heuristicIntent;
    private buildSnapshot;
    private summarizeWithAi;
    getNaturalLanguageReport(shopId: string, _userId: string, query: string, requestedLanguage?: 'en' | 'twi' | 'auto'): Promise<{
        intent: "inventory_finance" | "expenses_profit" | "compliance_export" | "dashboard" | "sales_intelligence";
        language: "en" | "twi";
        periodLabel: string;
        providerUsed: string;
        intentProvider: "openai" | "gemini" | "heuristic";
        answer: string;
        snapshot: {
            totalSales: number;
            totalExpenses: number;
            profit: number;
            transactions: number;
            lowStockCount: number;
            topProducts?: undefined;
            peakHours?: undefined;
            paymentMethodBreakdown?: undefined;
            dailyComparison?: undefined;
            totalStockValue?: undefined;
            potentialRevenue?: undefined;
            potentialProfit?: undefined;
            deadStockCount?: undefined;
            totalRevenue?: undefined;
            salesProfit?: undefined;
            netProfit?: undefined;
            topExpenseCategories?: undefined;
            periodLabel?: undefined;
            totalTransactions?: undefined;
        } | {
            topProducts: any;
            peakHours: any;
            paymentMethodBreakdown: any;
            dailyComparison: any;
            totalSales?: undefined;
            totalExpenses?: undefined;
            profit?: undefined;
            transactions?: undefined;
            lowStockCount?: undefined;
            totalStockValue?: undefined;
            potentialRevenue?: undefined;
            potentialProfit?: undefined;
            deadStockCount?: undefined;
            totalRevenue?: undefined;
            salesProfit?: undefined;
            netProfit?: undefined;
            topExpenseCategories?: undefined;
            periodLabel?: undefined;
            totalTransactions?: undefined;
        } | {
            totalStockValue: number;
            potentialRevenue: number;
            potentialProfit: number;
            lowStockCount: number;
            deadStockCount: number;
            totalSales?: undefined;
            totalExpenses?: undefined;
            profit?: undefined;
            transactions?: undefined;
            topProducts?: undefined;
            peakHours?: undefined;
            paymentMethodBreakdown?: undefined;
            dailyComparison?: undefined;
            totalRevenue?: undefined;
            salesProfit?: undefined;
            netProfit?: undefined;
            topExpenseCategories?: undefined;
            periodLabel?: undefined;
            totalTransactions?: undefined;
        } | {
            totalRevenue: number;
            salesProfit: number;
            totalExpenses: number;
            netProfit: number;
            topExpenseCategories: any;
            totalSales?: undefined;
            profit?: undefined;
            transactions?: undefined;
            lowStockCount?: undefined;
            topProducts?: undefined;
            peakHours?: undefined;
            paymentMethodBreakdown?: undefined;
            dailyComparison?: undefined;
            totalStockValue?: undefined;
            potentialRevenue?: undefined;
            potentialProfit?: undefined;
            deadStockCount?: undefined;
            periodLabel?: undefined;
            totalTransactions?: undefined;
        } | {
            periodLabel: any;
            totalSales: number;
            totalExpenses: number;
            profit: number;
            totalTransactions: number;
            transactions?: undefined;
            lowStockCount?: undefined;
            topProducts?: undefined;
            peakHours?: undefined;
            paymentMethodBreakdown?: undefined;
            dailyComparison?: undefined;
            totalStockValue?: undefined;
            potentialRevenue?: undefined;
            potentialProfit?: undefined;
            deadStockCount?: undefined;
            totalRevenue?: undefined;
            salesProfit?: undefined;
            netProfit?: undefined;
            topExpenseCategories?: undefined;
        };
        chartReferences: {
            key: string;
            title: string;
            points: any;
        };
        sourceRange: {
            startDate: string;
            endDate: string;
        };
    }>;
}
//# sourceMappingURL=reports.service.d.ts.map