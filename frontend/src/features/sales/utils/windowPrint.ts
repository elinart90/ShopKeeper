/**
 * Receipt printing via window.print() — optimised for 58mm thermal paper.
 * Uses @page CSS to set 58mm paper size, 2-column item rows, and left-aligned layout.
 */

export type ReceiptPrintPayload = {
  sale: {
    id?: string;
    sale_number?: string;
    created_at?: string;
    payment_method?: string;
    total_amount?: number;
    tax_amount?: number;
    final_amount?: number;
    discount_amount?: number;
    payment_reference?: string;
    auth_code?: string;
    customer?: { name?: string; phone?: string };
    items?: Array<{
      id?: string;
      quantity?: number;
      unit_price?: number;
      total_price?: number;
      product?: { name?: string };
    }>;
  };
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  cashierName?: string;
  currency: string;
};

function fmt(amount: number, currency: string): string {
  const v = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${v.toFixed(2)}`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  return `<div class="info-row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function withAutoPrintScript(html: string): string {
  const script = [
    "<script>",
    "(function(){",
    "  function runPrint(){",
    "    try { window.focus(); window.print(); } catch (e) {}",
    "  }",
    "  if (document.readyState === 'complete') setTimeout(runPrint, 180);",
    "  else window.addEventListener('load', function(){ setTimeout(runPrint, 180); }, { once: true });",
    "})();",
    "</script>",
  ].join("");
  return html.replace("</body>", `${script}</body>`);
}

function buildReceiptHtml(p: ReceiptPrintPayload): string {
  const { sale, shopName, shopAddress, shopPhone, shopEmail, cashierName, currency } = p;
  const saleDate = sale?.created_at ? new Date(sale.created_at) : new Date();
  const paymentLabel = String(sale?.payment_method || "cash").replace(/_/g, " ");
  const paymentDisplay = paymentLabel.toUpperCase();
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const discount = Number(sale?.discount_amount || 0);
  const total = Number(sale?.final_amount || 0);

  // 2-column item rows: "Name + qty x unit" | "Total"
  const itemRows = items.length
    ? items.map((item) => {
        const qty = Number(item?.quantity || 0);
        const unitPrice = Number(item?.unit_price || 0);
        const lineTotal = Number(item?.total_price || 0);
        const name = esc(item?.product?.name || "Product");
        return `<div class="item-row"><span class="item-main"><span class="item-name">${name}</span><span class="item-meta">${qty} x ${fmt(unitPrice, currency)}</span></span><span class="item-total">${fmt(lineTotal, currency)}</span></div>`;
      }).join("")
    : `<div class="item-row"><span class="item-main"><span class="item-name muted">No items</span></span></div>`;

  const discountLine = discount > 0
    ? `<div class="summary-row"><span>Discount</span><span class="red">-${fmt(discount, currency)}</span></div>`
    : "";

  const customerLine = sale?.customer?.name
    ? row("Customer", esc(sale.customer.name) + (sale.customer.phone ? " / " + esc(sale.customer.phone) : ""))
    : "";

  const refLine = sale?.payment_reference
    ? `<div class="ref">Ref: ${esc(sale.payment_reference)}</div>`
    : "";

  const css = [
    "@page { size: 58mm auto; margin: 0; }",
    "* { box-sizing:border-box; margin:0; padding:0; }",
    "html, body { background:#fff !important; color:#000 !important; width:58mm !important; height:auto !important; min-height:0 !important; overflow:hidden !important; }",
    "body { font-family:'Courier New',Courier,monospace; font-size:11px; line-height:1.3; width:58mm; padding:2mm; text-rendering:optimizeLegibility; -webkit-font-smoothing:none; font-smooth:never; display:inline-block; }",
    ".receipt { width:100%; color:#000; display:block; }",
    // Header — centered
    ".header { text-align:center; margin-bottom:4px; }",
    ".shop-name { font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:2px; color:#000; }",
    ".header p { font-size:10.5px; color:#000; line-height:1.35; }",
    // Divider
    ".div { border-top:1px dashed #000; margin:4px 0; }",
    ".div-solid { border-top:1.2px solid #000; margin:4px 0; }",
    // Sale info rows
    ".info-row { display:flex; justify-content:space-between; margin:1.5px 0; font-size:10.5px; }",
    ".info-row .label { color:#000; white-space:nowrap; margin-right:4px; }",
    ".info-row .value { text-align:right; font-weight:700; word-break:break-all; color:#000; }",
    ".payment-row .label { font-weight:800; }",
    ".payment-row .value { font-size:11.5px; font-weight:800; letter-spacing:0.2px; }",
    ".ref { font-size:10px; color:#000; margin-top:2px; }",
    // Item column header
    ".item-header { display:flex; justify-content:space-between; font-size:10.5px; font-weight:800; border-bottom:1px solid #000; padding-bottom:2px; margin-bottom:2px; color:#000; }",
    // Item rows
    ".item-row { display:flex; justify-content:space-between; align-items:flex-start; gap:4px; padding:2px 0; border-bottom:1px dashed #000; font-size:10.5px; }",
    ".item-main { flex:1; min-width:0; display:flex; flex-direction:column; }",
    ".item-name { font-weight:700; margin-right:4px; word-break:break-word; }",
    ".item-meta { font-size:9.5px; color:#111; margin-top:1px; }",
    ".item-total { white-space:nowrap; font-weight:700; color:#000; }",
    // Summary rows
    ".summary-row { display:flex; justify-content:space-between; font-size:10.5px; padding:1.5px 0; color:#000; }",
    ".red { color:#c00; }",
    ".muted { color:#000; }",
    // Grand total
    ".total-row { display:flex; justify-content:space-between; align-items:baseline; border-top:1.3px solid #000; border-bottom:1.3px solid #000; padding:3px 0; margin:3px 0; color:#000; }",
    ".total-label { font-size:12.5px; font-weight:800; }",
    ".total-amount { font-size:14px; font-weight:800; }",
    // Footer
    ".footer { text-align:center; font-size:10px; color:#000; margin-top:6px; line-height:1.45; }",
    "@media print { html,body { margin:0 !important; padding:0 !important; width:58mm !important; height:auto !important; min-height:0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { overflow:hidden !important; display:inline-block !important; } }",
  ].join(" ");

  const parts: string[] = [
    "<!DOCTYPE html>",
    `<html lang="en"><head><meta charset="UTF-8"/><title>Receipt</title><style>${css}</style></head>`,
    "<body><div class='receipt'>",

    // === HEADER ===
    "<div class='header'>",
    `<p class='shop-name'>${esc(shopName)}</p>`,
    shopAddress ? `<p>${esc(shopAddress)}</p>` : "",
    shopPhone   ? `<p>Tel: ${esc(shopPhone)}</p>` : "",
    shopEmail   ? `<p>${esc(shopEmail)}</p>` : "",
    "</div>",

    "<div class='div-solid'></div>",

    // === SALE INFO ===
    sale?.sale_number ? row("Receipt #", esc(sale.sale_number)) : "",
    row("Date", saleDate.toLocaleDateString() + " " + saleDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
    `<div class="info-row payment-row"><span class="label">Payment</span><span class="value">${esc(paymentDisplay)}</span></div>`,
    cashierName ? row("Cashier", esc(cashierName)) : "",
    customerLine,
    refLine,

    "<div class='div'></div>",

    // === ITEMS ===
    "<div class='item-header'><span>ITEM (QTY x UNIT)</span><span>TOTAL</span></div>",
    itemRows,

    "<div class='div'></div>",

    // === TOTALS ===
    discountLine,
    "<div class='total-row'>",
    "<span class='total-label'>TOTAL</span>",
    `<span class='total-amount'>${fmt(total, currency)}</span>`,
    "</div>",

    "<div class='div'></div>",

    // === FOOTER ===
    "<div class='footer'>",
    "<p>Thank you for shopping with us!</p>",
    "<p>Powered by ShopKeeper</p>",
    "</div>",

    "</div></body></html>",
  ];

  return parts.join("");
}

/** Returns true when running on Android or iOS. */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Mobile path: build the receipt as a Blob URL and open it in a new tab.
 * The user can then tap the browser's Share / Print button from there.
 */
function printReceiptMobile(html: string): void {
  const printableHtml = withAutoPrintScript(html);

  // Preferred: open a transient window and print immediately.
  const win = window.open("", "_blank");
  if (win) {
    win.document.open();
    win.document.write(printableHtml);
    win.document.close();
    return;
  }

  // Fallback: Blob URL (some browsers block about:blank popup writing).
  const blob = new Blob([printableHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  // If popup was blocked, fall back to navigating in the same tab
  if (!opened) {
    window.location.href = url;
  }
  // Revoke the object URL after enough time for the page to load
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/**
 * Desktop path: open a popup with a styled 58mm receipt and call window.print().
 * Falls back to a hidden iframe if popups are blocked.
 */
function printReceiptDesktop(html: string): void {
  const win = window.open("", "_blank", "width=300,height=600");
  if (!win) {
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed", width: "0", height: "0",
      border: "none", left: "-9999px", top: "0",
    });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
    setTimeout(() => document.body.removeChild(iframe), 3000);
    return;
  }
  win.document.open();
  win.document.write(withAutoPrintScript(html));
  win.document.close();

  // Close after actual print when supported; fallback close after delay.
  win.onafterprint = () => {
    try { win.close(); } catch {}
  };
  setTimeout(() => {
    try { if (!win.closed) win.close(); } catch {}
  }, 30_000);
}

/**
 * Prints a receipt.
 * • Desktop/PC  → opens a popup and calls window.print() (works with thermal printers).
 * • Android/iOS → opens the receipt as a HTML page in a new tab so the user can use
 *                 the browser's built-in Share / Print menu.
 */
export function printReceipt(payload: ReceiptPrintPayload): void {
  const html = buildReceiptHtml(payload);
  if (isMobileDevice()) {
    printReceiptMobile(html);
  } else {
    printReceiptDesktop(html);
  }
}
