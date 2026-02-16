export default function AlertsTab() {
  const alerts = [
    "Stock of X will finish in N days",
    "Cash sales unusually high today",
    "Profit dropped 15% this week",
    "Restock these 5 items",
  ];
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 max-w-2xl w-full"
      data-testid="alerts-insights-card"
      role="region"
      aria-label="Alerts and Insights"
    >
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Alerts & Insights
      </h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Automated intelligence: low stock, unusual cash, profit drop, restock suggestions.
      </p>
      <ul className="space-y-3 mb-6 list-none p-0 m-0">
        {alerts.map((alert, i) => (
          <li key={i} className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500"
              aria-hidden
            />
            <span>{alert}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-gray-500 dark:text-gray-400">Coming soon</p>
    </div>
  );
}
