import { useState, useEffect } from 'react';

/**
 * Detecta si el dispositivo es teléfono móvil (< 768px)
 * o tablet/desktop (>= 768px).
 *
 * Regla: ancho < 768px → móvil (experiencia WMS simplificada)
 *        ancho >= 768px → desktop/tablet (app completa con sidebar)
 */
export function useDeviceType() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return { isMobile };
}
