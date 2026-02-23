-- Platform-level analytics views for super admin dashboard

CREATE OR REPLACE VIEW public.v_admin_shop_kpis AS
WITH sales_agg AS (
  SELECT
    s.shop_id,
    SUM(CASE WHEN s.status = 'completed' THEN COALESCE(s.final_amount, 0) ELSE 0 END) AS total_sales_volume,
    COUNT(*) FILTER (WHERE s.status = 'completed') AS transaction_count,
    MAX(s.created_at) FILTER (WHERE s.status = 'completed') AS last_transaction_at
  FROM public.sales s
  GROUP BY s.shop_id
),
products_agg AS (
  SELECT
    p.shop_id,
    COUNT(*) FILTER (WHERE COALESCE(p.is_active, true) = true) AS products_listed
  FROM public.products p
  GROUP BY p.shop_id
)
SELECT
  sh.id AS shop_id,
  sh.name AS shop_name,
  sh.owner_id,
  COALESCE(sh.is_active, true) AS is_active,
  sh.created_at,
  COALESCE(sa.total_sales_volume, 0)::DECIMAL(15, 2) AS total_sales_volume,
  COALESCE(sa.transaction_count, 0)::BIGINT AS transaction_count,
  COALESCE(pa.products_listed, 0)::BIGINT AS products_listed,
  sa.last_transaction_at
FROM public.shops sh
LEFT JOIN sales_agg sa ON sa.shop_id = sh.id
LEFT JOIN products_agg pa ON pa.shop_id = sh.id;

CREATE OR REPLACE VIEW public.v_admin_user_activity AS
WITH login_agg AS (
  SELECT
    ulh.user_id,
    COUNT(*) AS login_events,
    COUNT(*) FILTER (WHERE ulh.success = true) AS successful_logins,
    COUNT(*) FILTER (WHERE ulh.success = false) AS failed_logins,
    MAX(ulh.created_at) AS last_active_at
  FROM public.user_login_history ulh
  GROUP BY ulh.user_id
),
owner_shops AS (
  SELECT
    sh.owner_id::TEXT AS owner_id_txt,
    COUNT(*) AS owned_shops_count
  FROM public.shops sh
  GROUP BY sh.owner_id::TEXT
),
staff_memberships AS (
  SELECT
    sm.user_id::TEXT AS user_id_txt,
    COUNT(*) AS staff_memberships_count
  FROM public.shop_members sm
  GROUP BY sm.user_id::TEXT
)
SELECT
  u.id AS user_id,
  u.name,
  u.email,
  u.role,
  u.created_at,
  la.last_active_at,
  COALESCE(la.login_events, 0)::BIGINT AS login_events,
  COALESCE(la.successful_logins, 0)::BIGINT AS successful_logins,
  COALESCE(la.failed_logins, 0)::BIGINT AS failed_logins,
  COALESCE(os.owned_shops_count, 0)::BIGINT AS owned_shops_count,
  COALESCE(sm.staff_memberships_count, 0)::BIGINT AS staff_memberships_count
FROM public.users u
LEFT JOIN login_agg la ON la.user_id = u.id
LEFT JOIN owner_shops os ON os.owner_id_txt = u.id::TEXT
LEFT JOIN staff_memberships sm ON sm.user_id_txt = u.id::TEXT;

CREATE OR REPLACE VIEW public.v_admin_platform_daily_metrics AS
WITH sales_daily AS (
  SELECT
    DATE_TRUNC('day', s.created_at)::DATE AS metric_date,
    SUM(CASE WHEN s.status = 'completed' THEN COALESCE(s.final_amount, 0) ELSE 0 END) AS total_sales_volume,
    COUNT(*) FILTER (WHERE s.status = 'completed') AS transaction_count
  FROM public.sales s
  GROUP BY DATE_TRUNC('day', s.created_at)::DATE
),
users_daily AS (
  SELECT
    DATE_TRUNC('day', u.created_at)::DATE AS metric_date,
    COUNT(*) AS new_users
  FROM public.users u
  GROUP BY DATE_TRUNC('day', u.created_at)::DATE
),
shops_daily AS (
  SELECT
    DATE_TRUNC('day', sh.created_at)::DATE AS metric_date,
    COUNT(*) AS new_shops
  FROM public.shops sh
  GROUP BY DATE_TRUNC('day', sh.created_at)::DATE
),
active_shops_daily AS (
  SELECT
    DATE_TRUNC('day', s.created_at)::DATE AS metric_date,
    COUNT(DISTINCT s.shop_id) FILTER (WHERE s.status = 'completed') AS active_shops
  FROM public.sales s
  GROUP BY DATE_TRUNC('day', s.created_at)::DATE
),
all_days AS (
  SELECT metric_date FROM sales_daily
  UNION
  SELECT metric_date FROM users_daily
  UNION
  SELECT metric_date FROM shops_daily
  UNION
  SELECT metric_date FROM active_shops_daily
)
SELECT
  d.metric_date,
  COALESCE(sd.total_sales_volume, 0)::DECIMAL(15, 2) AS total_sales_volume,
  COALESCE(sd.transaction_count, 0)::BIGINT AS transaction_count,
  COALESCE(ud.new_users, 0)::BIGINT AS new_users,
  COALESCE(shd.new_shops, 0)::BIGINT AS new_shops,
  COALESCE(asd.active_shops, 0)::BIGINT AS active_shops
FROM all_days d
LEFT JOIN sales_daily sd ON sd.metric_date = d.metric_date
LEFT JOIN users_daily ud ON ud.metric_date = d.metric_date
LEFT JOIN shops_daily shd ON shd.metric_date = d.metric_date
LEFT JOIN active_shops_daily asd ON asd.metric_date = d.metric_date
ORDER BY d.metric_date DESC;

CREATE OR REPLACE VIEW public.v_admin_billing_mrr AS
WITH base AS (
  SELECT
    us.user_id,
    us.status,
    us.billing_cycle,
    COALESCE(us.amount, 0)::DECIMAL(15, 2) AS amount,
    COALESCE(us.current_period_start, us.created_at)::DATE AS period_date
  FROM public.user_subscriptions us
),
normalized AS (
  SELECT
    DATE_TRUNC('month', b.period_date)::DATE AS month_start,
    b.user_id,
    b.status,
    CASE
      WHEN b.billing_cycle = 'yearly' THEN (b.amount / 12.0)
      ELSE b.amount
    END AS monthly_equivalent
  FROM base b
)
SELECT
  n.month_start,
  COUNT(*) FILTER (WHERE n.status = 'active')::BIGINT AS active_subscriptions,
  COALESCE(SUM(n.monthly_equivalent) FILTER (WHERE n.status = 'active'), 0)::DECIMAL(15, 2) AS mrr_amount,
  (COALESCE(SUM(n.monthly_equivalent) FILTER (WHERE n.status = 'active'), 0) * 12)::DECIMAL(15, 2) AS arr_amount
FROM normalized n
GROUP BY n.month_start
ORDER BY n.month_start DESC;
