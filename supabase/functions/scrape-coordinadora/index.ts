// =====================================================
// EDGE FUNCTION: scrape-coordinadora
// =====================================================
// Proxy server-side para evitar CORS al consultar
// el tracking de Coordinadora y extraer la Guía Asociada
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
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

    const trackingUrl = `https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=${guideNumber}`;

    const response = await fetch(trackingUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`Coordinadora respondió con HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extrae número de "Guía Asociada: XXXXXXXXX"
    // El HTML muestra algo como: "Guía Asociada: 56813981708"
    const assocMatch = html.match(
      /Gu[íi]a\s+Asociada[^0-9]*([0-9]{8,15})/i
    );
    const associatedGuide = assocMatch ? assocMatch[1].trim() : null;

    // Extrae estado de la guía (ej: "Entregado", "En reparto", etc.)
    // El HTML tiene algo como: Estado de la guía: <h2>Entregado</h2>
    const statusMatch = html.match(
      /Estado de la gu[íi]a[^<]*<[^>]+>([^<]+)</i
    );
    const guideStatus = statusMatch ? statusMatch[1].trim() : null;

    // Detecta si la guía existe (página de error vs tracking real)
    const notFound =
      html.includes("No se encontraron resultados") ||
      html.includes("no se encontró") ||
      html.includes("Número de guía inválido");

    if (notFound) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Guía no encontrada en Coordinadora",
          guideNumber,
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        guideNumber,
        associatedGuide,   // null si no tiene guía asociada (es la original)
        guideStatus,       // estado del envío
      }),
      {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
