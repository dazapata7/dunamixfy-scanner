/**
 * ============================================================================
 * TEST: Endpoint dfx_scanner_mark_scanned
 * ============================================================================
 * Script para probar el nuevo endpoint que marca ordenes como escaneadas
 * Este endpoint se llamará SOLO cuando se CONFIRME el batch exitosamente
 * ============================================================================
 */

const DUNAMIXFY_BASE_URL = 'https://dunamixfy.bubbleapps.io/api/1.1';

async function testMarkScannedEndpoint() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 PRUEBA: dfx_scanner_mark_scanned');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Datos ficticios para la prueba
  const testData = {
    guide_number: '56814005796', // Número de guía de prueba
    scanned_at: new Date().toISOString(),
    warehouse_id: 'warehouse-test-001',
    operator_id: 'operator-test-001',
    dispatch_number: 'DISP-2024-00001'
  };

  console.log('📦 Datos de prueba:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');

  console.log('─────────────────────────────────────────────────────────');
  console.log('PASO 1: Llamar endpoint /initialize para verificar configuración');
  console.log('─────────────────────────────────────────────────────────');
  console.log('URL: https://dunamixfy.bubbleapps.io/api/1.1/wf/dfx_scanner_mark_scanned/initialize');

  try {
    const initResponse = await fetch(
      'https://dunamixfy.bubbleapps.io/api/1.1/wf/dfx_scanner_mark_scanned/initialize',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      }
    );

    console.log(`\n📡 Status Code: ${initResponse.status} ${initResponse.statusText}`);

    const initData = await initResponse.json();
    console.log('\n✅ Respuesta del endpoint /initialize:');
    console.log(JSON.stringify(initData, null, 2));

  } catch (error) {
    console.error('\n❌ Error al llamar /initialize:', error.message);
  }

  console.log('\n─────────────────────────────────────────────────────────');
  console.log('PASO 2: Llamar endpoint principal con datos de prueba');
  console.log('─────────────────────────────────────────────────────────');

  try {
    const response = await fetch(
      `${DUNAMIXFY_BASE_URL}/wf/dfx_scanner_mark_scanned`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      }
    );

    console.log(`\n📡 Status Code: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log('\n✅ Respuesta del endpoint:');
    console.log(JSON.stringify(data, null, 2));

    // Analizar respuesta
    if (data.status === 'SUCCESS' || response.ok) {
      console.log('\n✅ ÉXITO: Endpoint configurado correctamente');
    } else {
      console.log('\n⚠️ ADVERTENCIA: Endpoint respondió pero con estado diferente a SUCCESS');
    }

  } catch (error) {
    console.error('\n❌ Error al llamar endpoint:', error.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('FIN DE PRUEBA');
  console.log('═══════════════════════════════════════════════════════════');

  console.log('\n📝 NOTAS PARA BUBBLE:');
  console.log('1. El endpoint debe recibir estos campos en el body:');
  console.log('   - guide_number (string): Número de guía');
  console.log('   - scanned_at (string ISO): Timestamp del escaneo');
  console.log('   - warehouse_id (string, opcional): ID del warehouse');
  console.log('   - operator_id (string, opcional): ID del operador');
  console.log('   - dispatch_number (string, opcional): Número del dispatch');
  console.log('');
  console.log('2. El workflow debe:');
  console.log('   - Buscar la orden por guide_number');
  console.log('   - Marcar scanned = true');
  console.log('   - Guardar scanned_at timestamp');
  console.log('   - Retornar { status: "SUCCESS", message: "..." }');
  console.log('');
  console.log('3. ⚠️ IMPORTANTE: El endpoint dfx_scanner_get_orderinfo NO debe');
  console.log('   modificar el campo scanned. Solo debe LEER y retornar datos.');
}

testMarkScannedEndpoint().then(() => process.exit(0)).catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
