// =====================================================
// EDGE FUNCTION: scrape-coordinadora
// =====================================================
// Estrategias para extraer "Guía Asociada" de Coordinadora:
// 1. API interna JSON (endpoint AJAX que usa la página)
// 2. HTML parsing + buscar JSON en script tags
// 3. HTML parsing con múltiples regex
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
};

// Extrae número de guía asociada de un string (HTML o JSON)
function extractAssociatedGuide(content: string): string | null {
  const patterns = [
    // "Guía Asociada: 56813981708"
    /Gu[íi]a\s+Asociada[:\s"']+([0-9]{8,15})/i,
    // "guia_anterior":"56813981708"
    /guia_anterior["'\s:]+([0-9]{8,15})/i,
    // "associated_guide":"56813981708"
    /associated_guide["'\s:]+([0-9]{8,15})/i,
    // "guiaAsociada":"56813981708"
    /guiaAsociada["'\s:]+([0-9]{8,15})/i,
    // "guia_asociada":"56813981708"
    /guia_asociada["'\s:]+([0-9]{8,15})/i,
    // "anterior":"56813981708"
    /"anterior["'\s:]+([0-9]{8,15})/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

// Extrae estado del envío
function extractStatus(content: string): string | null {
  const patterns = [
    /Estado de la gu[íi]a[^<>"]*[:<>"\s]+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+)/i,
    /"estado["'\s:]+["']([^"']+)["']/i,
    /"status["'\s:]+["']([^"']+)["']/i,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (m) return m[1].trim().replace(/<[^>]+>/g, '').trim();
  }
  return null;
}

// Estrategia 1: API interna de Coordinadora (endpoints conocidos)
async function tryInternalAPI(guideNumber: string): Promise<string | null> {
  const endpoints = [
    // Posibles endpoints internos que usa la SPA
    `https://coordinadora.com/rastreo/rastreo-de-guia/?guia=${guideNumber}&format=json`,
    `https://coordinadora.com/api/rastreo/${guideNumber}`,
    `https://coordinadora.com/wp-json/coordinadora/v1/guia/${guideNumber}`,
    `https://coordinadora.com/rastreo/?action=get_guia&guia=${guideNumber}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { ...BROWSER_HEADERS, "Accept": "application/json, text/plain, */*" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const text = await res.text();
        // Si parece JSON, buscar la guía asociada
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          const guide = extractAssociatedGuide(text);
          if (guide) return guide;
        }
      }
    } catch {
      // Continuar con siguiente endpoint
    }
  }
  return null;
}

// Estrategia 2: Fetch del HTML completo + buscar JSON en script tags
async function tryHTMLParsing(guideNumber: string): Promise<{ associatedGuide: string | null; guideStatus: string | null; html: string }> {
  const url = `https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=${guideNumber}`;

  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    return { associatedGuide: null, guideStatus: null, html: '' };
  }

  const html = await res.text();

  // Busca directamente en el HTML
  let associatedGuide = extractAssociatedGuide(html);

  // Si no encontró, busca dentro de bloques <script> que contengan datos JSON
  if (!associatedGuide) {
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of scriptMatches) {
      const scriptContent = match[1];
      if (scriptContent.length > 50) {
        associatedGuide = extractAssociatedGuide(scriptContent);
        if (associatedGuide) break;
      }
    }
  }

  // Busca en atributos data-* del HTML
  if (!associatedGuide) {
    const dataMatch = html.match(/data-guia[^=]*=["']([0-9]{8,15})["']/i);
    if (dataMatch) associatedGuide = dataMatch[1];
  }

  const guideStatus = extractStatus(html);

  return { associatedGuide, guideStatus, html: html.slice(0, 500) };
}

// Estrategia 3: POST form (algunos tracking sites usan POST)
async function tryFormPost(guideNumber: string): Promise<string | null> {
  const url = 'https://coordinadora.com/rastreo/rastreo-de-guia/';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `guia=${encodeURIComponent(guideNumber)}&action=rastrear`,
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const text = await res.text();
      return extractAssociatedGuide(text);
    }
  } catch {
    // ignorar
  }
  return null;
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

    // Ejecutar las 3 estrategias
    const [apiResult, htmlResult, postResult] = await Promise.allSettled([
      tryInternalAPI(guideNumber),
      tryHTMLParsing(guideNumber),
      tryFormPost(guideNumber),
    ]);

    const associatedGuide =
      (apiResult.status === 'fulfilled' && apiResult.value) ||
      (htmlResult.status === 'fulfilled' && htmlResult.value.associatedGuide) ||
      (postResult.status === 'fulfilled' && postResult.value) ||
      null;

    const guideStatus =
      (htmlResult.status === 'fulfilled' && htmlResult.value.guideStatus) || null;

    // Log para debug en Supabase Functions dashboard
    console.log(`[scrape-coordinadora] guia=${guideNumber} → asociada=${associatedGuide} status=${guideStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        guideNumber,
        associatedGuide,
        guideStatus,
        // Indica si la página cargó correctamente (para debug)
        pageLoaded: htmlResult.status === 'fulfilled',
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
