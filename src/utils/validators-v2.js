/**
 * Utilidades para validación y procesamiento de códigos
 * Versión 2: Trabaja con configuración dinámica desde la base de datos
 */

/**
 * Valida un código según las reglas de una transportadora
 */
export function validateCode(code, carrier) {
  if (!carrier || !carrier.validation_rules) {
    return false;
  }

  const rules = carrier.validation_rules;

  // Validación por patrón
  if (rules.pattern === 'ends_with_001') {
    if (!code.endsWith('001')) return false;
  }

  if (rules.pattern === 'starts_with_24') {
    if (!code.startsWith('24')) return false;
  }

  // Validación de longitud
  if (rules.min_length && code.length < rules.min_length) {
    return false;
  }

  if (rules.max_length && code.length > rules.max_length) {
    return false;
  }

  if (rules.length) {
    const validLengths = Array.isArray(rules.length) ? rules.length : [rules.length];
    if (!validLengths.includes(code.length)) {
      return false;
    }
  }

  // Validación de solo dígitos
  if (rules.digits_only && !/^\d+$/.test(code)) {
    return false;
  }

  return true;
}

/**
 * Extrae el código normalizado según la configuración de extracción
 */
export function extractCode(rawCode, carrier) {
  if (!carrier || !carrier.extraction_config) {
    return rawCode;
  }

  const config = carrier.extraction_config;

  switch (config.method) {
    case 'slice':
      // Coordinadora: slice(-14, -3)
      return rawCode.slice(config.start, config.end);

    case 'substring':
      // Interrápidisimo: primeros 12 si tiene 13
      if (config.length && rawCode.length > config.length) {
        return rawCode.substring(0, config.length);
      }
      return rawCode;

    case 'regex':
      // Para futuras transportadoras con extracción por regex
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
 * Procesa un código QR/Barcode completo y lo valida contra todas las transportadoras
 */
export async function procesarCodigoConCarriers(rawCode, carriers) {
  let codigo = rawCode.trim();

  // Si el código es muy largo (QR con datos completos), intentar extraer número de guía
  if (codigo.length > 50) {
    // Intentar patrones comunes
    const patterns = [
      /GUIA:\s*(\d{12,13})/i,
      /\b(24\d{10,11})\b/,
      /\d{12,13}/g
    ];

    for (const pattern of patterns) {
      const match = codigo.match(pattern);
      if (match) {
        const potentialCode = Array.isArray(match) ? match.find(m => m.startsWith('24')) || match[1] || match[0] : match[1] || match[0];
        if (potentialCode) {
          codigo = potentialCode;
          break;
        }
      }
    }
  }

  // Intentar validar contra cada transportadora
  for (const carrier of carriers) {
    if (!carrier.is_active) continue;

    const isValid = validateCode(codigo, carrier);

    if (isValid) {
      const codigoNormalizado = extractCode(codigo, carrier);

      return {
        valido: true,
        codigo: codigoNormalizado,
        codigoOriginal: codigo,
        carrier: carrier,
        carrierId: carrier.id,
        carrierCode: carrier.code,
        carrierName: carrier.display_name
      };
    }
  }

  // No se encontró ninguna transportadora válida
  return {
    valido: false,
    error: 'Código no válido o transportadora no reconocida',
    codigoOriginal: codigo
  };
}

/**
 * Limpia un código que viene de la base de datos
 */
export function limpiarCodigo(codigo) {
  let codigoLimpio = String(codigo);
  codigoLimpio = codigoLimpio.replace(/^'+|'+$/g, '');
  return codigoLimpio;
}

/**
 * Detecta el tipo de escaneo (QR vs Barcode)
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
