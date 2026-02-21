"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const supabase_1 = require("../../config/supabase");
const env_1 = require("../../config/env");
const validators_1 = require("../../domain/validators");
const logger_1 = require("../../utils/logger");
class InventoryService {
    normalizeSearchText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/ɛ/g, 'e')
            .replace(/ɔ/g, 'o')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }
    sanitizeSearchTerm(value) {
        return String(value || '')
            // Remove punctuation/symbols from voice transcripts (e.g. "drilling machine.")
            .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    expandSearchTermsForTwi(rawSearch) {
        const raw = String(rawSearch || '').trim();
        const normalized = this.normalizeSearchText(raw);
        const terms = new Set();
        if (raw)
            terms.add(this.sanitizeSearchTerm(raw));
        if (normalized)
            terms.add(this.sanitizeSearchTerm(normalized));
        // Twi <-> English mapping for common retail words.
        const synonymGroups = [
            ['asikyire', 'sugar'],
            ['emo', 'rice'],
            ['nkyene', 'salt'],
            ['ngo', 'oil'],
            ['samina', 'soap'],
            ['paanoo', 'bread'],
            ['kosua', 'egg'],
            ['nam', 'fish', 'meat'],
            ['nsuo', 'water'],
            ['nufuo', 'milk'],
            ['tomato', 'tomato paste', 'tomato mix'],
            ['borode', 'plantain'],
            ['banku', 'cassava dough'],
            ['fufu', 'cassava', 'plantain'],
            ['biscuit', 'bisket'],
        ];
        const normalizedTokens = normalized.split(/\s+/).filter(Boolean);
        synonymGroups.forEach((group) => {
            const normalizedGroup = group.map((item) => this.normalizeSearchText(item));
            const shouldExpand = normalizedGroup.some((g) => normalized === g ||
                normalized.includes(g) ||
                normalizedTokens.includes(g));
            if (!shouldExpand)
                return;
            normalizedGroup.forEach((item) => terms.add(this.sanitizeSearchTerm(item)));
        });
        return Array.from(terms)
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8);
    }
    parseAiJson(content) {
        const raw = String(content || '').trim();
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            const start = raw.indexOf('{');
            const end = raw.lastIndexOf('}');
            if (start >= 0 && end > start) {
                const sliced = raw.slice(start, end + 1);
                try {
                    return JSON.parse(sliced);
                }
                catch {
                    return null;
                }
            }
            return null;
        }
    }
    normalizeUnit(unit) {
        const value = String(unit || '').trim().toLowerCase();
        if (!value)
            return null;
        if (['piece', 'pcs', 'pc', 'unit'].includes(value))
            return 'piece';
        if (['kg', 'kilogram', 'kilo'].includes(value))
            return 'kg';
        if (['liter', 'litre', 'ltr', 'l'].includes(value))
            return 'liter';
        if (['box'].includes(value))
            return 'box';
        if (['pack', 'pkt'].includes(value))
            return 'pack';
        return null;
    }
    buildAiPrompt(categoryNames) {
        return `
Extract product onboarding details from this product photo.
Return STRICT JSON only with this shape:
{
  "name": string | null,
  "barcode": string | null,
  "unit": "piece" | "kg" | "liter" | "box" | "pack" | null,
  "category_name": string | null,
  "cost_price_hint": number | null,
  "selling_price_hint": number | null,
  "description_hint": string | null,
  "confidence": {
    "name": "high" | "medium" | "low",
    "barcode": "high" | "medium" | "low",
    "unit": "high" | "medium" | "low",
    "category_name": "high" | "medium" | "low",
    "cost_price_hint": "high" | "medium" | "low",
    "selling_price_hint": "high" | "medium" | "low"
  },
  "notes": string[]
}

Important rules:
- Barcode must be plain digits/letters only (remove spaces and non-essential symbols).
- If barcode unclear, return null.
- Use one of these categories if relevant: ${categoryNames.join(', ') || 'General'}
- If no price is visible, keep price hints null.
- Keep notes short and useful.
`;
    }
    async callOpenAiVision(imageDataUrl, prompt, hints) {
        if (!env_1.env.openaiApiKey)
            throw new Error('OPENAI_API_KEY not configured');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env_1.env.openaiApiKey}`,
            },
            body: JSON.stringify({
                model: env_1.env.openaiModel || 'gpt-4o-mini',
                temperature: 0.1,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a strict JSON extraction engine for retail product onboarding.',
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'text', text: `Hints: name=${hints?.name || ''}, barcode=${hints?.barcode || ''}` },
                            { type: 'image_url', image_url: { url: imageDataUrl } },
                        ],
                    },
                ],
            }),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`OpenAI request failed (${response.status}): ${errorText.slice(0, 300)}`);
        }
        const data = await response.json();
        return String(data?.choices?.[0]?.message?.content || '');
    }
    async callClaudeVision(imageDataUrl, prompt, hints) {
        if (!env_1.env.claudeApiKey)
            throw new Error('CLAUDE_API_KEY not configured');
        const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match)
            throw new Error('Invalid image data URL for Claude');
        const mediaType = match[1];
        const base64Data = match[2];
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': env_1.env.claudeApiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: env_1.env.claudeModel || 'claude-3-5-sonnet-latest',
                max_tokens: 700,
                temperature: 0,
                system: 'You are a strict JSON extraction engine for retail product onboarding.',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: `${prompt}\nHints: name=${hints?.name || ''}, barcode=${hints?.barcode || ''}` },
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType,
                                    data: base64Data,
                                },
                            },
                        ],
                    },
                ],
            }),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Claude request failed (${response.status}): ${errorText.slice(0, 300)}`);
        }
        const data = await response.json();
        const textBlock = Array.isArray(data?.content)
            ? data.content.find((block) => block?.type === 'text')
            : null;
        return String(textBlock?.text || '');
    }
    async aiOnboardFromImage(shopId, _userId, payload) {
        const imageDataUrl = String(payload?.imageDataUrl || '').trim();
        if (!imageDataUrl.startsWith('data:image/')) {
            throw new Error('A valid product image is required');
        }
        if (!env_1.env.openaiApiKey && !env_1.env.claudeApiKey) {
            throw new Error('Neither OPENAI_API_KEY nor CLAUDE_API_KEY is configured on backend');
        }
        const categories = await this.getCategories(shopId);
        const categoryNames = (categories || []).map((c) => String(c.name || '').trim()).filter(Boolean);
        const prompt = this.buildAiPrompt(categoryNames);
        let content = '';
        let providerUsed = '';
        const errors = [];
        if (env_1.env.openaiApiKey) {
            try {
                content = await this.callOpenAiVision(imageDataUrl, prompt, payload?.hints);
                providerUsed = 'openai';
            }
            catch (err) {
                const message = String(err?.message || 'OpenAI failed');
                errors.push(message);
                logger_1.logger.warn('AI onboarding OpenAI failed; trying Claude fallback', { message });
            }
        }
        if (!content && env_1.env.claudeApiKey) {
            try {
                content = await this.callClaudeVision(imageDataUrl, prompt, payload?.hints);
                providerUsed = 'claude';
            }
            catch (err) {
                const message = String(err?.message || 'Claude failed');
                errors.push(message);
                logger_1.logger.error('AI onboarding Claude fallback failed', { message });
            }
        }
        if (!content) {
            throw new Error(`Failed to process product image with AI. ${errors.join(' | ')}`);
        }
        const parsed = this.parseAiJson(content) || {};
        const suggestedName = String(parsed?.name || '').trim() || null;
        const suggestedBarcodeRaw = String(parsed?.barcode || '').trim();
        const suggestedBarcode = suggestedBarcodeRaw
            ? suggestedBarcodeRaw.replace(/[^0-9A-Za-z]/g, '')
            : null;
        const suggestedUnit = this.normalizeUnit(parsed?.unit);
        const categoryName = String(parsed?.category_name || '').trim() || null;
        const costPriceHint = Number(parsed?.cost_price_hint);
        const sellingPriceHint = Number(parsed?.selling_price_hint);
        const descriptionHint = String(parsed?.description_hint || '').trim() || null;
        const duplicateCheck = await this.checkDuplicate(shopId, suggestedBarcode || undefined, suggestedName || undefined);
        const recommendedAction = duplicateCheck?.existingByBarcode || (duplicateCheck?.possibleByName || []).length > 0
            ? 'update_existing'
            : 'create_new';
        return {
            provider: providerUsed,
            suggested: {
                name: suggestedName,
                barcode: suggestedBarcode,
                unit: suggestedUnit,
                category_name: categoryName,
                cost_price_hint: Number.isFinite(costPriceHint) ? Number(costPriceHint) : null,
                selling_price_hint: Number.isFinite(sellingPriceHint) ? Number(sellingPriceHint) : null,
                description_hint: descriptionHint,
            },
            confidence: {
                name: String(parsed?.confidence?.name || 'medium'),
                barcode: String(parsed?.confidence?.barcode || 'low'),
                unit: String(parsed?.confidence?.unit || 'low'),
                category_name: String(parsed?.confidence?.category_name || 'low'),
                cost_price_hint: String(parsed?.confidence?.cost_price_hint || 'low'),
                selling_price_hint: String(parsed?.confidence?.selling_price_hint || 'low'),
            },
            notes: Array.isArray(parsed?.notes) ? parsed.notes.map((n) => String(n)) : [],
            duplicateCheck,
            recommendedAction,
        };
    }
    async createProduct(shopId, userId, data) {
        const validated = validators_1.productSchema.parse(data);
        const normalizedBarcode = String(validated.barcode || '').trim();
        if (normalizedBarcode) {
            const { data: existingByBarcode, error: barcodeErr } = await supabase_1.supabase
                .from('products')
                .select('id,name')
                .eq('shop_id', shopId)
                .eq('barcode', normalizedBarcode)
                .eq('is_active', true)
                .maybeSingle();
            if (barcodeErr) {
                logger_1.logger.error('Error checking duplicate barcode:', barcodeErr);
                throw new Error('Failed to validate barcode uniqueness');
            }
            if (existingByBarcode?.id) {
                throw new Error(`Barcode already exists on product "${existingByBarcode.name}". Open that product and update stock instead.`);
            }
        }
        const { data: product, error: productError } = await supabase_1.supabase
            .from('products')
            .insert({
            ...validated,
            barcode: normalizedBarcode || undefined,
            shop_id: shopId,
        })
            .select()
            .single();
        if (productError) {
            logger_1.logger.error('Error creating product:', productError);
            throw new Error('Failed to create product');
        }
        if (validated.stock_quantity > 0) {
            await this.addCostLayer(shopId, product.id, userId, Number(validated.stock_quantity), Number(validated.cost_price || 0), 'initial_stock', product.id);
            await this.logStockMovement(shopId, product.id, userId, 'purchase', validated.stock_quantity, 0, validated.stock_quantity, 'Initial stock');
        }
        return product;
    }
    async checkDuplicate(shopId, barcode, name) {
        const result = {
            existingByBarcode: null,
            possibleByName: [],
        };
        if (barcode?.trim()) {
            const byBarcode = await this.getProductByBarcode(shopId, barcode.trim());
            result.existingByBarcode = byBarcode ? { id: byBarcode.id, name: byBarcode.name } : null;
        }
        if (name?.trim()) {
            const list = await this.getProducts(shopId, { search: name.trim() });
            result.possibleByName = (list || []).slice(0, 5).map((p) => ({ id: p.id, name: p.name, barcode: p.barcode }));
        }
        return result;
    }
    async receiveStock(shopId, productId, userId, quantity, note, unitCost) {
        const product = await this.getProductById(productId);
        if (product.shop_id !== shopId)
            throw new Error('Product not found');
        const prev = Number(product.stock_quantity);
        const newQty = prev + quantity;
        if (newQty < 0)
            throw new Error('Stock cannot be negative');
        const appliedUnitCost = Number.isFinite(unitCost)
            ? Number(unitCost)
            : Number(product.cost_price || 0);
        const { error } = await supabase_1.supabase
            .from('products')
            .update({
            stock_quantity: newQty,
            cost_price: appliedUnitCost,
            updated_at: new Date().toISOString(),
        })
            .eq('id', productId);
        if (error)
            throw new Error('Failed to update stock');
        await this.addCostLayer(shopId, productId, userId, Number(quantity), appliedUnitCost, 'purchase', productId);
        await this.logStockMovement(shopId, productId, userId, 'purchase', quantity, prev, newQty, note || 'Receive stock');
        return this.getProductById(productId);
    }
    async getProducts(shopId, filters) {
        const includeActiveOnly = filters?.is_active === undefined ? true : filters.is_active;
        const runQuery = async (terms) => {
            let query = supabase_1.supabase
                .from('products')
                .select('*, category:categories(*)')
                .eq('shop_id', shopId)
                .order('created_at', { ascending: false });
            if (filters?.category_id)
                query = query.eq('category_id', filters.category_id);
            query = query.eq('is_active', includeActiveOnly);
            const validTerms = (terms || []).map((t) => this.sanitizeSearchTerm(t)).filter(Boolean);
            if (validTerms.length) {
                const orQuery = validTerms
                    .flatMap((term) => [
                    `name.ilike.%${term}%`,
                    `barcode.ilike.%${term}%`,
                    `sku.ilike.%${term}%`,
                ])
                    .join(',');
                if (orQuery)
                    query = query.or(orQuery);
            }
            const { data, error } = await query;
            if (error) {
                logger_1.logger.error('Error fetching products:', error);
                throw new Error('Failed to fetch products');
            }
            return data || [];
        };
        let list = [];
        const rawSearch = String(filters?.search || '').trim();
        if (!rawSearch) {
            list = await runQuery();
        }
        else if (filters?.search_mode === 'english_first') {
            const englishTerms = Array.from(new Set([
                this.sanitizeSearchTerm(rawSearch),
                this.sanitizeSearchTerm(this.normalizeSearchText(rawSearch)),
            ].filter(Boolean)));
            list = englishTerms.length ? await runQuery(englishTerms) : [];
            if (!list.length) {
                const expandedTerms = this.expandSearchTermsForTwi(rawSearch);
                list = expandedTerms.length ? await runQuery(expandedTerms) : [];
            }
        }
        else {
            const expandedTerms = this.expandSearchTermsForTwi(rawSearch);
            list = expandedTerms.length ? await runQuery(expandedTerms) : [];
        }
        let result = (list || []).map((p) => ({
            ...p,
            category: p.category,
            category_id: p.category_id,
        }));
        if (filters?.low_stock) {
            result = result.filter((p) => p.stock_quantity <= (p.min_stock_level || 0));
        }
        return result;
    }
    async getProductById(productId) {
        const { data: product, error } = await supabase_1.supabase
            .from('products')
            .select('*, category:categories(*)')
            .eq('id', productId)
            .single();
        if (error) {
            logger_1.logger.error('Error fetching product:', error);
            throw new Error('Product not found');
        }
        return { ...product, category: product.category };
    }
    async getProductByBarcode(shopId, barcode) {
        const { data: product, error } = await supabase_1.supabase
            .from('products')
            .select('*, category:categories(*)')
            .eq('shop_id', shopId)
            .eq('barcode', barcode)
            .eq('is_active', true)
            .maybeSingle();
        if (error || !product)
            return null;
        return { ...product, category: product.category };
    }
    async updateProduct(productId, shopId, userId, data) {
        const existing = await this.getProductById(productId);
        if (existing.shop_id !== shopId) {
            throw new Error('Product does not belong to this shop');
        }
        const validated = validators_1.productUpdateSchema.parse(data);
        const normalizedBarcode = validated.barcode !== undefined ? String(validated.barcode || '').trim() : undefined;
        if (normalizedBarcode) {
            const { data: dup, error: dupErr } = await supabase_1.supabase
                .from('products')
                .select('id,name')
                .eq('shop_id', shopId)
                .eq('barcode', normalizedBarcode)
                .eq('is_active', true)
                .neq('id', productId)
                .maybeSingle();
            if (dupErr) {
                logger_1.logger.error('Error checking duplicate barcode on update:', dupErr);
                throw new Error('Failed to validate barcode uniqueness');
            }
            if (dup?.id) {
                throw new Error(`Barcode already exists on product "${dup.name}".`);
            }
        }
        const previousQuantity = existing.stock_quantity;
        const newQuantity = validated.stock_quantity ?? previousQuantity;
        const { data: product, error } = await supabase_1.supabase
            .from('products')
            .update({
            ...validated,
            ...(normalizedBarcode !== undefined ? { barcode: normalizedBarcode || null } : {}),
            updated_at: new Date().toISOString(),
        })
            .eq('id', productId)
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error updating product:', error);
            throw new Error('Failed to update product');
        }
        if (validated.stock_quantity !== undefined && validated.stock_quantity !== previousQuantity) {
            const quantityDiff = validated.stock_quantity - previousQuantity;
            await this.logStockMovement(shopId, productId, userId, 'adjustment', Math.abs(quantityDiff), previousQuantity, validated.stock_quantity, `Stock adjustment: ${quantityDiff > 0 ? '+' : ''}${quantityDiff}`);
        }
        return product;
    }
    async deleteProduct(productId, shopId) {
        await supabase_1.supabase
            .from('products')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', productId)
            .eq('shop_id', shopId);
        return { success: true };
    }
    async restoreProduct(productId, shopId) {
        const { data: product, error } = await supabase_1.supabase
            .from('products')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('id', productId)
            .eq('shop_id', shopId)
            .select()
            .single();
        if (error || !product) {
            logger_1.logger.error('Error restoring product:', error);
            throw new Error('Failed to restore product');
        }
        return product;
    }
    async getLowStockProducts(shopId) {
        const { data, error } = await supabase_1.supabase
            .from('products')
            .select('*')
            .eq('shop_id', shopId)
            .eq('is_active', true);
        if (error)
            throw new Error('Failed to fetch products');
        return (data || []).filter((p) => Number(p.stock_quantity) <= Number(p.min_stock_level || 0));
    }
    async logStockMovement(shopId, productId, userId, action, quantity, previousQuantity, newQuantity, notes) {
        await supabase_1.supabase.from('stock_movements').insert({
            shop_id: shopId,
            product_id: productId,
            action,
            quantity,
            previous_quantity: previousQuantity,
            new_quantity: newQuantity,
            notes,
            created_by: userId,
        });
    }
    async addCostLayer(shopId, productId, userId, quantity, unitCost, sourceType, sourceId) {
        if (!Number.isFinite(quantity) || quantity <= 0)
            return;
        const safeCost = Number.isFinite(unitCost) ? Number(unitCost) : 0;
        await supabase_1.supabase.from('stock_cost_layers').insert({
            shop_id: shopId,
            product_id: productId,
            source_type: sourceType,
            source_id: sourceId || null,
            unit_cost: safeCost,
            initial_quantity: Number(quantity),
            remaining_quantity: Number(quantity),
            created_by: userId,
        });
    }
    async getStockHistory(productId, limit = 50) {
        const { data, error } = await supabase_1.supabase
            .from('stock_movements')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error)
            throw new Error('Failed to fetch stock history');
        return data || [];
    }
    async createCategory(shopId, data) {
        const { data: category, error } = await supabase_1.supabase
            .from('categories')
            .insert({ shop_id: shopId, ...data })
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error creating category:', error);
            throw new Error('Failed to create category');
        }
        return category;
    }
    async getCategories(shopId) {
        const { data, error } = await supabase_1.supabase
            .from('categories')
            .select('*')
            .eq('shop_id', shopId)
            .order('name');
        if (error)
            throw new Error('Failed to fetch categories');
        return data || [];
    }
}
exports.InventoryService = InventoryService;
//# sourceMappingURL=inventory.service.js.map