import { Router } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get('/receipts/:receiptRef', async (req, res) => {
  const receiptRef = decodeURIComponent(String(req.params.receiptRef || '')).trim();
  if (!receiptRef) {
    return res.status(400).json({ success: false, message: 'receiptRef is required' });
  }

  try {
    let sale: Record<string, any> | null = null;

    if (UUID_RE.test(receiptRef)) {
      const byId = await supabase
        .from('sales')
        .select(
          `
          id,
          shop_id,
          sale_number,
          total_amount,
          discount_amount,
          tax_amount,
          final_amount,
          payment_method,
          status,
          notes,
          created_at,
          items:sale_items(
            id,
            quantity,
            unit_price,
            total_price,
            product:products(name)
          )
        `
        )
        .eq('id', receiptRef)
        .maybeSingle();
      if (byId.error) throw byId.error;
      sale = (byId.data as Record<string, any> | null) || null;
    } else {
      const suffix = receiptRef.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const suffixDigits = suffix.replace(/\D/g, '');
      const byNumber = await supabase
        .from('sales')
        .select(
          `
          id,
          shop_id,
          sale_number,
          total_amount,
          discount_amount,
          tax_amount,
          final_amount,
          payment_method,
          status,
          notes,
          created_at,
          items:sale_items(
            id,
            quantity,
            unit_price,
            total_price,
            product:products(name)
          )
        `
        )
        .ilike('sale_number', `%${suffixDigits.slice(-8)}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byNumber.error) throw byNumber.error;
      sale = (byNumber.data as Record<string, any> | null) || null;
    }

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const shopRes = await supabase
      .from('shops')
      .select('id, name, address, phone, email, currency')
      .eq('id', String(sale.shop_id))
      .maybeSingle();
    if (shopRes.error) throw shopRes.error;

    const isCancelled = String(sale.status || '').toLowerCase() === 'cancelled';

    return res.json({
      success: true,
      data: {
        receiptRef,
        verifiedAt: new Date().toISOString(),
        isValid: !isCancelled,
        sale: {
          id: sale.id,
          sale_number: sale.sale_number,
          status: sale.status,
          created_at: sale.created_at,
          payment_method: sale.payment_method,
          total_amount: sale.total_amount,
          discount_amount: sale.discount_amount,
          tax_amount: sale.tax_amount,
          final_amount: sale.final_amount,
          notes: sale.notes || null,
          items: Array.isArray(sale.items) ? sale.items : [],
        },
        shop: shopRes.data || null,
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to verify receipt' });
  }
});

export default router;
