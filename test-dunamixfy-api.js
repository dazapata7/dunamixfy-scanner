/**
 * Script de prueba para inicializar endpoint de Dunamixfy CO
 *
 * Uso:
 * node test-dunamixfy-api.js
 *
 * Este script envía una petición de prueba al endpoint para:
 * 1. Verificar que la API responde
 * 2. Ver el formato de respuesta
 * 3. Configurar el workflow en Bubble
 */

const API_KEY = "d82b1fe06d0267b8efb596dd8190c983";
const BASE_URL = "https://dunamixfy.bubbleapps.io/version-test/api/1.1/wf";

// Código de prueba - usa uno válido de tu sistema
const TEST_CODE = "123456789"; // Reemplaza con un código real

async function testDunamixfyAPI() {
  console.log("🚀 Iniciando prueba de API Dunamixfy CO...\n");
  console.log("📍 Endpoint:", `${BASE_URL}/dfx_scanner_get_orderinfo`);
  console.log("🔑 API Key:", API_KEY);
  console.log("📦 Código de prueba:", TEST_CODE);
  console.log("\n" + "=".repeat(60) + "\n");

  try {
    console.log("📤 Enviando petición...\n");

    const response = await fetch(`${BASE_URL}/dfx_scanner_get_orderinfo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        code: TEST_CODE,
      }),
    });

    console.log("📊 Status Code:", response.status);
    console.log("📊 Status Text:", response.statusText);
    console.log("\n" + "-".repeat(60) + "\n");

    if (!response.ok) {
      console.error("❌ Error HTTP:", response.status, response.statusText);

      // Intentar leer el cuerpo del error
      const errorText = await response.text();
      console.log("📄 Respuesta del servidor:");
      console.log(errorText);

      return;
    }

    const data = await response.json();

    console.log("✅ Respuesta exitosa!\n");
    console.log("📄 Datos recibidos:");
    console.log(JSON.stringify(data, null, 2));
    console.log("\n" + "=".repeat(60) + "\n");

    // Validar estructura esperada
    console.log("🔍 Validando estructura de datos...\n");

    if (data.response) {
      console.log('✅ Campo "response" encontrado');

      const fields = [
        "order_id",
        "firstname",
        "lastname",
        "orderItems",
        "sync_status",
        "pay_type",
        "transportadora",
        "store",
      ];

      fields.forEach((field) => {
        if (data.response[field] !== undefined) {
          console.log(`  ✅ ${field}: ${JSON.stringify(data.response[field])}`);
        } else {
          console.log(`  ⚠️  ${field}: NO ENCONTRADO`);
        }
      });

      console.log("\n" + "=".repeat(60) + "\n");
      console.log("✅ Prueba completada exitosamente!");
      console.log("\n📝 Próximos pasos:");
      console.log(
        "1. Verifica que todos los campos necesarios estén en la respuesta"
      );
      console.log("2. Configura el workflow en Bubble según esta estructura");
      console.log('3. Una vez configurado, elimina "/initialize" del endpoint');
    } else {
      console.log('⚠️  No se encontró el campo "response" en la respuesta');
      console.log("📄 Estructura recibida:", Object.keys(data));
    }
  } catch (error) {
    console.error("\n❌ Error durante la prueba:", error.message);
    console.error("\n📋 Stack trace:");
    console.error(error.stack);
  }
}

// Ejecutar prueba
console.log("\n" + "═".repeat(60));
console.log("  TEST: Dunamixfy CO API - Scanner Get Order Info");
console.log("═".repeat(60) + "\n");

testDunamixfyAPI();
