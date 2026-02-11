import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lncbjwulrepgjbukawxu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuY2Jqd3VscmVwZ2pidWthd3h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczMjk2NTAsImV4cCI6MjA1MjkwNTY1MH0.zrXA6z6_EH7h1r66cdfFvtBCaV-SypVdXNhRjF7d2-M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGuideFlow() {
  const rawCode = '70020220500010501656814005796001';

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 PRUEBA REAL DE FLUJO WMS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📦 Código escaneado:', rawCode);
  console.log('📏 Longitud:', rawCode.length, 'caracteres\n');

  // PASO 1: Obtener carriers
  console.log('─────────────────────────────────────────────────────────');
  console.log('PASO 1: Obtener carriers activos de BD');
  console.log('─────────────────────────────────────────────────────────');

  const { data: carriers, error: carriersError } = await supabase
    .from('carriers')
    .select('*')
    .eq('is_active', true);

  if (carriersError) {
    console.error('❌ Error al obtener carriers:', carriersError);
    return;
  }

  console.log(`✅ Carriers activos encontrados: ${carriers.length}\n`);
  carriers.forEach(c => {
    console.log(`📋 ${c.display_name} (${c.code})`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Reglas validación:`, JSON.stringify(c.validation_rules));
    console.log(`   Config extracción:`, JSON.stringify(c.extraction_config));
    console.log('');
  });

  // PASO 2: Detectar transportadora
  console.log('─────────────────────────────────────────────────────────');
  console.log('PASO 2: Detectar transportadora');
  console.log('─────────────────────────────────────────────────────────');

  let detectedCarrier = null;
  let extractedCode = null;

  // Validar contra Coordinadora
  const coordinadora = carriers.find(c => c.code === 'coordinadora');
  if (coordinadora) {
    console.log('\n🔎 Probando con COORDINADORA...');
    console.log(`   Regla: termina con "001"`);
    console.log(`   ¿Cumple? ${rawCode.endsWith('001') ? '✅ SÍ' : '❌ NO'}`);

    if (rawCode.endsWith('001')) {
      detectedCarrier = coordinadora;
      // Extraer código usando config
      extractedCode = rawCode.slice(-14, -3);
      console.log(`   ✅ COORDINADORA DETECTADA`);
      console.log(`   Código original: ${rawCode}`);
      console.log(`   Código extraído: ${extractedCode}`);
    }
  }

  if (!detectedCarrier) {
    console.log('❌ No se pudo detectar transportadora');
    return;
  }

  // PASO 3: Verificar en BD local
  console.log('\n─────────────────────────────────────────────────────────');
  console.log('PASO 3: Verificar si existe en BD local');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Buscando dispatch con guide_code = "${extractedCode}"`);

  const { data: existingDispatches, error: searchError } = await supabase
    .from('dispatches')
    .select('id, guide_code, status, dispatch_number, created_at, confirmed_at')
    .eq('guide_code', extractedCode);

  if (searchError) {
    console.error('❌ Error en búsqueda:', searchError);
  } else {
    console.log(`\n📊 Resultado: ${existingDispatches.length} dispatch(es) encontrado(s)`);

    if (existingDispatches && existingDispatches.length > 0) {
      existingDispatches.forEach(d => {
        console.log('\n⚠️ DISPATCH EXISTENTE:');
        console.log(`   ID: ${d.id}`);
        console.log(`   Número: ${d.dispatch_number}`);
        console.log(`   Estado: ${d.status}`);
        console.log(`   Creado: ${d.created_at}`);
        console.log(`   Confirmado: ${d.confirmed_at || 'N/A'}`);

        if (d.status === 'confirmed') {
          const confirmedDate = new Date(d.confirmed_at || d.created_at);
          const today = new Date();
          const isToday = confirmedDate.toDateString() === today.toDateString();

          console.log(`   📅 Clasificación: ${isToday ? 'REPEATED_TODAY ⚠️' : 'REPEATED_OTHER_DAY 📅'}`);
        } else {
          console.log(`   📝 Clasificación: DRAFT_DUPLICATE`);
        }
      });

      console.log('\n🛑 NO CONTINÚA a Dunamixfy (dispatch ya existe)');
    } else {
      console.log('✅ NO existe dispatch previo');
      console.log('➡️  CONTINÚA a PASO 4 (Dunamixfy API)');
    }
  }

  // PASO 4: Consultar Dunamixfy API (solo si NO existe)
  if (!existingDispatches || existingDispatches.length === 0) {
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('PASO 4: Consultar Dunamixfy API (REAL)');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Consultando orden: ${extractedCode}`);

    try {
      const response = await fetch('https://dunamixfy.bubbleapps.io/api/1.1/wf/dfx_scanner_get_orderinfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer d82b1fe06d0267b8efb596dd8190c983'
        },
        body: JSON.stringify({
          code: extractedCode
        })
      });

      const data = await response.json();

      console.log('\n📡 Respuesta Dunamixfy:');
      console.log(JSON.stringify(data, null, 2));

      // Analizar respuesta
      if (data && data.response && data.response.error_response) {
        const errorMsg = data.response.error_response.toLowerCase();
        console.log('\n⚠️ Dunamixfy retornó ERROR:');
        console.log(`   Mensaje: "${data.response.error_response}"`);

        if (errorMsg.includes('no esta listo') || errorMsg.includes('no puede') || errorMsg.includes('despachar')) {
          console.log(`   🚫 Clasificación: ERROR_NOT_READY`);
        } else if (errorMsg.includes('no existe') || errorMsg.includes('not found')) {
          console.log(`   ❌ Clasificación: ERROR_NOT_FOUND`);
        } else if (errorMsg.includes('ya') && (errorMsg.includes('escaneada') || errorMsg.includes('escaneado'))) {
          console.log(`   🔄 Clasificación: ALREADY_SCANNED_EXTERNAL`);
        } else {
          console.log(`   ⚠️ Clasificación: ERROR_OTHER`);
        }
      } else if (data && data.response && data.response.order_id) {
        console.log('\n✅ Orden encontrada y despachable');
        console.log(`   Order ID: ${data.response.order_id}`);
        console.log(`   Cliente: ${data.response.firstname} ${data.response.lastname}`);
        console.log(`   Tienda: ${data.response.store || 'N/A'}`);
        console.log(`   Items: ${data.response.orderItems ? 'presente' : 'N/A'}`);
        console.log(`   ✅ Clasificación: SUCCESS`);
      } else {
        console.log('\n⚠️ Respuesta inesperada de Dunamixfy');
        console.log(`   Clasificación: ERROR_OTHER`);
      }

    } catch (error) {
      console.error('\n❌ Error al consultar Dunamixfy:', error.message);
      console.log(`   Clasificación: ERROR_OTHER`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('FIN DE PRUEBA');
  console.log('═══════════════════════════════════════════════════════════');
}

testGuideFlow().then(() => process.exit(0)).catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
