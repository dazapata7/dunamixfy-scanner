// =====================================================
// EDGE FUNCTION: scrape-coordinadora
// =====================================================
// API: GET https://coordinadora.com/wp-json/rgc/v1/detail_tracking?remission_code={guia}
// Requiere Bearer JWT — se extrae del HTML de la página si es necesario
// Guía asociada: history[].code === "pre_binded" → associated_tracking_number
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRACKING_PAGE = (guia: string) =>
  `https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=${guia}`;

const API_URL = (code: string) =>
  `https://coordinadora.com/wp-json/rgc/v1/detail_tracking?remission_code=${code}`;

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "Referer": "https://coordinadora.com/",
  "Origin": "https://coordinadora.com",
};

// Extrae el Bearer token del HTML de la página
function extractToken(html: string): string | null {
  // Patterns comunes de WordPress para embeber tokens en JS
  const patterns = [
    /"token"\s*:\s*"([^"]{20,})"/,
    /token["'\s:]+["']([A-Za-z0-9._\-]{20,})["']/,
    /authorization["'\s:]+["']Bearer ([A-Za-z0-9._\-]{20,})["']/i,
    /eyJ[A-Za-z0-9._\-]{20,}/,  // Busca cualquier JWT (empieza con eyJ)
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1] ?? m[0];
  }
  return null;
}

// Llama la API de Coordinadora con o sin token
async function callTrackingAPI(guideNumber: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(API_URL(guideNumber), {
    headers,
    signal: AbortSignal.timeout(10000),
  });
}

// Parsea el JSON y extrae la guía asociada (pre_binded)
function parseTrackingResponse(data: Record<string, unknown>): {
  associatedGuide: string | null;
  guideStatus: string | null;
  origin: string | null;
  destination: string | null;
} {
  const history = (data.history ?? []) as Array<Record<string, unknown>>;

  // Busca el item con code === "pre_binded" — guía original/anterior
  const preBinded = history.find((h) => h.code === "pre_binded");
  const associatedGuide = preBinded
    ? String(preBinded.associated_tracking_number ?? "")
    : null;

  return {
    associatedGuide: associatedGuide || null,
    guideStatus: String(data.current_state_text ?? ""),
    origin: String(data.origin ?? ""),
    destination: String(data.destination ?? ""),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { guideNumber } = await req.json();

    if (!guideNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "guideNumber es requerido" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.log(`[scrape-coordinadora] Consultando guía: ${guideNumber}`);

    // ── Estrategia 1: Llamar API sin token ────────────────
    let apiRes = await callTrackingAPI(guideNumber);
    let trackingData: Record<string, unknown> | null = null;

    if (apiRes.ok) {
      const json = await apiRes.json() as Record<string, unknown>;
      trackingData = json;
      console.log(`[scrape-coordinadora] API sin token: OK`);
    } else {
      console.log(`[scrape-coordinadora] API sin token: ${apiRes.status} — intentando con token`);

      // ── Estrategia 2: Extraer token del HTML ─────────────
      try {
        const pageRes = await fetch(TRACKING_PAGE(guideNumber), {
          headers: {
            ...BASE_HEADERS,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(12000),
        });

        if (pageRes.ok) {
          const html = await pageRes.text();
          const token = extractToken(html);
          console.log(`[scrape-coordinadora] Token extraído: ${token ? "SÍ" : "NO"}`);

          if (token) {
            apiRes = await callTrackingAPI(guideNumber, token);
            if (apiRes.ok) {
              trackingData = await apiRes.json() as Record<string, unknown>;
              console.log(`[scrape-coordinadora] API con token: OK`);
            } else {
              console.log(`[scrape-coordinadora] API con token: ${apiRes.status}`);
            }
          }
        }
      } catch (e) {
        console.error(`[scrape-coordinadora] Error extrayendo HTML:`, e);
      }
    }

    if (!trackingData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No se pudo consultar el tracking de Coordinadora",
          guideNumber,
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const result = parseTrackingResponse(trackingData);
    console.log(`[scrape-coordinadora] Resultado: asociada=${result.associatedGuide} estado=${result.guideStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        guideNumber,
        associatedGuide: result.associatedGuide,
        guideStatus: result.guideStatus,
        origin: result.origin,
        destination: result.destination,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[scrape-coordinadora] ERROR:`, message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
