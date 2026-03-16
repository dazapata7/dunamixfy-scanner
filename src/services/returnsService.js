// =====================================================
// RETURNS SERVICE - Módulo de Devoluciones
// =====================================================
// Coordinadora: scrape de tracking via Edge Function
// para encontrar guía original y reponer stock
// =====================================================

import { supabase } from './supabase';

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const EDGE_FN_URL      = `${SUPABASE_URL}/functions/v1/scrape-coordinadora`;

// ── Lookup de guía en Coordinadora (via Edge Function) ─
async function lookupCoordinadora(guideNumber) {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ guideNumber }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al consultar tracking de Coordinadora');
  }

  return data; // { guideNumber, associatedGuide, guideStatus }
}

// ── Busca el dispatch original por código de guía ─────
async function findOriginalDispatch(guideCode) {
  const { data, error } = await supabase
    .from('dispatches')
    .select(`
      *,
      dispatch_items(*, products(*)),
      shipment_record:shipment_records(*, carriers(*))
    `)
    .eq('guide_code', guideCode)
    .single();

  if (error?.code === 'PGRST116') return null; // not found
  if (error) throw error;
  return data;
}

// ── CRUD ──────────────────────────────────────────────
export const returnsService = {

  /**
   * Paso 1 completo: escanear guía retorno → Coordinadora → dispatch original
   * Retorna: { coordinadora, dispatch }
   */
  async resolve(returnGuideCode) {
    // Consulta Coordinadora para obtener guía original
    const coordinadora = await lookupCoordinadora(returnGuideCode);

    let dispatch = null;

    if (coordinadora.associatedGuide) {
      // Busca en nuestra BD el despacho con esa guía original
      dispatch = await findOriginalDispatch(coordinadora.associatedGuide);
    }

    // También intenta con la propia guía de devolución (por si acaso)
    if (!dispatch) {
      dispatch = await findOriginalDispatch(returnGuideCode);
    }

    return { coordinadora, dispatch };
  },

  /**
   * Crea devolución en borrador con sus ítems
   */
  async create({ returnGuideCode, originalGuideCode, originalDispatchId, warehouseId, operatorId, carrierId, notes }, items) {
    // Generar número de devolución
    const { data: returnNumber, error: numErr } = await supabase
      .rpc('generate_return_number');
    if (numErr) throw numErr;

    const { data: ret, error } = await supabase
      .from('returns')
      .insert({
        return_number:        returnNumber,
        return_guide_code:    returnGuideCode,
        original_guide_code:  originalGuideCode ?? null,
        original_dispatch_id: originalDispatchId ?? null,
        warehouse_id:         warehouseId,
        operator_id:          operatorId ?? null,
        carrier_id:           carrierId ?? null,
        notes:                notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    if (items?.length > 0) {
      const { error: itemsErr } = await supabase
        .from('return_items')
        .insert(items.map(i => ({
          return_id:  ret.id,
          product_id: i.product_id,
          qty:        i.qty,
          condition:  i.condition ?? 'good',
          notes:      i.notes ?? null,
        })));
      if (itemsErr) throw itemsErr;
    }

    return ret;
  },

  /**
   * Confirma devolución: crea movimientos IN de inventario
   */
  async confirm(returnId, operatorId) {
    const { data, error } = await supabase.rpc('confirm_return', {
      p_return_id:   returnId,
      p_operator_id: operatorId,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Cancela una devolución en borrador
   */
  async cancel(returnId) {
    const { error } = await supabase
      .from('returns')
      .update({ status: 'cancelled' })
      .eq('id', returnId)
      .eq('status', 'draft');
    if (error) throw error;
  },

  /**
   * Lista de devoluciones (con conteo de ítems)
   */
  async getAll(warehouseId = null) {
    let query = supabase
      .from('returns')
      .select('*, return_items(count)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (warehouseId) query = query.eq('warehouse_id', warehouseId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Devolución por ID con todos sus ítems y productos
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('returns')
      .select('*, return_items(*, products(*))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
};

export default returnsService;
