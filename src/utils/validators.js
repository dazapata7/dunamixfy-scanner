/**
 * ============================================================================
 * UTILIDADES DE VALIDACIÓN Y PROCESAMIENTO DE CÓDIGOS - V2
 * ============================================================================
 * Versión 2: Validación dinámica basada en configuración desde la base de datos
 *
 * Cambios principales respecto a V1:
 * - V1: Reglas hardcoded (if/else para coordinadora e interrapidisimo)
 * - V2: Reglas dinámicas desde carrier.validation_rules (JSON en BD)
 *
 * Ventajas V2:
 * - Agregar nuevas transportadoras sin modificar código
 * - Cambiar reglas de validación vía SQL UPDATE
 * - Configuración de extracción personalizada por transportadora
 * - Escalabilidad ilimitada
 */

/**
 * ============================================================================
 * FUNCIÓN: validateCode
 * ============================================================================
 * Valida un código según las reglas JSON de una transportadora
 *
 * Parámetros:
 * @param {string} code - Código a validar
 * @param {object} carrier - Objeto transportadora con validation_rules
 *
 * Reglas soportadas en validation_rules:
 * - pattern: "ends_with_001" | "starts_with_24" | otros patrones
 * - min_length: Longitud mínima del código
 * - max_length: Longitud máxima del código
 * - length: Longitud exacta o array de longitudes válidas [12, 13]
 * - digits_only: true si solo debe contener dígitos
 *
 * Ejemplo de validation_rules en BD:
 * {
 *   "pattern": "ends_with_001",
 *   "min_length": 20
 * }
 *
 * @returns {boolean} true si el código cumple todas las reglas
 */
export function validateCode(code, carrier) {
  if (!carrier || !carrier.validation_rules) {
    console.log(`❌ validateCode: carrier o validation_rules no definido`, { carrier });
    return false;
  }

  const rules = carrier.validation_rules;

  // DEBUG: Mostrar qué se está validando
  console.log(`🔍 Validando código contra ${carrier.display_name}:`, {
    codigo: code,
    longitud: code.length,
    reglas: rules
  });

  // V2: Validación por patrón (dinámico)
  if (rules.pattern === 'ends_with_001') {
    if (!code.endsWith('001')) {
      console.log(`❌ ${carrier.display_name}: No termina con 001`);
      return false;
    }
  }

  if (rules.pattern === 'starts_with_24') {
    if (!code.startsWith('24')) {
      console.log(`❌ ${carrier.display_name}: No empieza con 24 (código: ${code.substring(0, 5)}...)`);
      return false;
    }
  }

  // V2.1: Patrón más flexible - empieza con "2" (cualquier dígito después)
  if (rules.pattern === 'starts_with_2') {
    if (!code.startsWith('2')) {
      console.log(`❌ ${carrier.display_name}: No empieza con 2`);
      return false;
    }
  }

  // V2: Validación de longitud mínima (dinámico)
  if (rules.min_length && code.length < rules.min_length) {
    console.log(`❌ ${carrier.display_name}: Muy corto (${code.length} < ${rules.min_length})`);
    return false;
  }

  // V2: Validación de longitud máxima (dinámico)
  if (rules.max_length && code.length > rules.max_length) {
    console.log(`❌ ${carrier.display_name}: Muy largo (${code.length} > ${rules.max_length})`);
    return false;
  }

  // V2: Validación de longitud exacta o array de longitudes (dinámico)
  if (rules.length) {
    const validLengths = Array.isArray(rules.length) ? rules.length : [rules.length];
    if (!validLengths.includes(code.length)) {
      console.log(`❌ ${carrier.display_name}: Longitud inválida (${code.length} no está en ${JSON.stringify(validLengths)})`);
      return false;
    }
  }

  // V2: Validación de solo dígitos (dinámico)
  if (rules.digits_only && !/^\d+$/.test(code)) {
    console.log(`❌ ${carrier.display_name}: No es solo dígitos`);
    return false;
  }

  console.log(`✅ ${carrier.display_name}: Código válido`);
  return true;
}

/**
 * ============================================================================
 * FUNCIÓN: extractCode
 * ============================================================================
 * Extrae el código normalizado según la configuración JSON de extracción
 *
 * Parámetros:
 * @param {string} rawCode - Código completo escaneado
 * @param {object} carrier - Objeto transportadora con extraction_config
 *
 * Métodos soportados en extraction_config:
 *
 * 1. "slice" - Usa String.slice(start, end)
 *    Ejemplo Coordinadora:
 *    {
 *      "method": "slice",
 *      "start": -14,
 *      "end": -3
 *    }
 *    Extrae: "70020222800020000356813890077001" → "56813890077"
 *
 * 2. "substring" - Usa String.substring(start, length)
 *    Ejemplo Interrápidisimo:
 *    {
 *      "method": "substring",
 *      "start": 0,
 *      "length": 12
 *    }
 *    Extrae: "2400415859180" (13 dígitos) → "240041585918" (12 dígitos)
 *
 * 3. "regex" - Usa expresión regular para extraer
 *    Ejemplo futuro:
 *    {
 *      "method": "regex",
 *      "pattern": "GUIA:\\s*(\\d+)"
 *    }
 *
 * @returns {string} Código normalizado
 */
export function extractCode(rawCode, carrier) {
  if (!carrier || !carrier.extraction_config) {
    return rawCode;
  }

  const config = carrier.extraction_config;

  switch (config.method) {
    case 'slice':
      // V2: Coordinadora usa slice(-14, -3)
      return rawCode.slice(config.start, config.end);

    case 'substring':
      // V2: Interrápidisimo usa substring para primeros 12 dígitos si tiene 13
      if (config.length && rawCode.length > config.length) {
        return rawCode.substring(0, config.length);
      }
      return rawCode;

    case 'regex':
      // V2: Para futuras transportadoras con extracción por regex
      if (config.pattern) {
        const match = rawCode.match(new RegExp(config.pattern));
        return match ? match[1] || match[0] : rawCode;
      }
      return rawCode;

    default:
      return rawCode;
  }
}

/**
 * ============================================================================
 * FUNCIÓN: procesarCodigoConCarriers
 * ============================================================================
 * Procesa un código QR/Barcode y lo valida contra todas las transportadoras
 *
 * Flujo V2:
 * 1. Limpia el código escaneado
 * 2. Si es un QR largo (>50 chars), extrae el número de guía
 * 3. Itera sobre todas las transportadoras activas
 * 4. Para cada una, valida usando validateCode()
 * 5. Si valida, extrae código normalizado usando extractCode()
 * 6. Retorna información completa incluyendo carrier_id
 *
 * Diferencia con V1:
 * - V1: Solo validaba contra 2 transportadoras hardcoded
 * - V2: Valida contra N transportadoras cargadas desde BD
 *
 * @param {string} rawCode - Código raw del scanner
 * @param {array} carriers - Array de transportadoras desde BD
 *
 * @returns {object} Resultado con estructura:
 * {
 *   valido: true/false,
 *   codigo: "56813890077", // normalizado
 *   codigoOriginal: "70020222800020000356813890077001",
 *   carrier: {...}, // objeto completo
 *   carrierId: "uuid",
 *   carrierCode: "coordinadora",
 *   carrierName: "Coordinadora"
 * }
 */
export function procesarCodigoConCarriers(rawCode, carriers) {
  let codigo = rawCode.trim();

  // V2.1: Limpiar comillas que pueden venir en QR de Interrápidisimo
  codigo = codigo.replace(/^["']+|["']+$/g, ''); // Remover comillas al inicio y final

  console.log('🔍 Código RAW detectado:', rawCode);
  console.log('🧹 Código limpio:', codigo);
  console.log('📏 Longitud:', codigo.length, 'caracteres');

  // Paso 1: Si el código es muy largo (QR con datos completos), extraer número de guía
  if (codigo.length > 50) {
    console.log('📦 Código largo detectado, intentando extraer guía...');
    // Intentar patrones comunes para extraer guía
    const patterns = [
      /GUIA:\s*(\d{12,13})/i,  // Patrón: "GUIA: 240041585918"
      /\b(24\d{10,11})\b/,      // Patrón: Número de 12-13 dígitos que empiece con "24"
      /\d{12,13}/g              // Patrón: Cualquier grupo de 12-13 dígitos
    ];

    for (const pattern of patterns) {
      const match = codigo.match(pattern);
      if (match) {
        const potentialCode = Array.isArray(match) ? match.find(m => m.startsWith('24')) || match[1] || match[0] : match[1] || match[0];
        if (potentialCode) {
          console.log('✂️ Código extraído:', potentialCode);
          codigo = potentialCode;
          break;
        }
      }
    }
  }

  console.log('🧪 Validando código:', codigo);
  console.log('🚚 Carriers disponibles:', carriers.length);

  // Paso 2: V2 - Validar contra cada transportadora activa
  for (const carrier of carriers) {
    if (!carrier.is_active) {
      console.log(`⏭️ ${carrier.display_name}: Inactiva, skip`);
      continue; // Skip transportadoras inactivas
    }

    console.log(`🔎 Probando con ${carrier.display_name}...`);

    // Paso 3: Validar usando reglas dinámicas desde BD
    const isValid = validateCode(codigo, carrier);

    if (isValid) {
      // Paso 4: Extraer código normalizado usando config dinámica desde BD
      const codigoNormalizado = extractCode(codigo, carrier);

      console.log('🎉 CÓDIGO VÁLIDO ENCONTRADO:', {
        transportadora: carrier.display_name,
        codigoOriginal: codigo,
        codigoNormalizado: codigoNormalizado
      });

      // Paso 5: Retornar resultado exitoso con información completa
      return {
        valido: true,
        codigo: codigoNormalizado,
        codigoOriginal: codigo,
        carrier: carrier, // V2: Retorna objeto completo de la transportadora
        carrierId: carrier.id, // V2: ID para foreign key en tabla codes
        carrierCode: carrier.code, // V2: Código para display
        carrierName: carrier.display_name // V2: Nombre para UI
      };
    }
  }

  // No se encontró ninguna transportadora válida
  console.error('❌ CÓDIGO NO VÁLIDO para ninguna transportadora');
  return {
    valido: false,
    error: 'Código no válido o transportadora no reconocida',
    codigoOriginal: codigo
  };
}

/**
 * ============================================================================
 * FUNCIÓN: limpiarCodigo
 * ============================================================================
 * Limpia un código que viene de la base de datos o input manual
 * Remueve comillas simples, dobles, espacios extras, etc.
 *
 * @param {string} codigo - Código a limpiar
 * @returns {string} Código limpio
 */
export function limpiarCodigo(codigo) {
  let codigoLimpio = String(codigo);
  // Remover comillas simples al inicio o final
  codigoLimpio = codigoLimpio.replace(/^'+|'+$/g, '');
  return codigoLimpio;
}

/**
 * ============================================================================
 * FUNCIÓN: detectScanType
 * ============================================================================
 * Detecta si el código escaneado es QR o Barcode
 * Útil para estadísticas y analytics
 *
 * Heurística:
 * - QR: Más de 50 caracteres (incluye metadata)
 * - Barcode: Solo dígitos, longitud <= 30
 * - Default: QR
 *
 * @param {string} rawCode - Código raw del scanner
 * @returns {string} "qr" | "barcode" | "manual"
 */
export function detectScanType(rawCode) {
  // Si tiene más de 50 caracteres, probablemente es un QR con datos completos
  if (rawCode.length > 50) {
    return 'qr';
  }

  // Si es solo dígitos y longitud corta/media, probablemente es barcode
  if (/^\d+$/.test(rawCode) && rawCode.length <= 30) {
    return 'barcode';
  }

  // Por defecto, QR
  return 'qr';
}
