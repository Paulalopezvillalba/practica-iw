/**
 * PRUEBAS DE COMPATIBILIDAD
 * Verifica la disponibilidad de recursos para PWA y visualización:
 * - Manifest
 * - Iconos
 * - Service Workers (si aplica)
 */
export const testPWACompatibility = async () => {
    try {
      const manifestRes = await fetch('/manifest.json');
      if (!manifestRes.ok) return { success: false, message: 'No se encontró manifest.json' };
      
      const manifest = await manifestRes.json();
      const hasIcons = manifest.icons && manifest.icons.length > 0;
      
      const iconRes = await fetch('/icon.png');
      const hasIconFile = iconRes.ok;

      if (!hasIcons || !hasIconFile) {
        return { success: false, message: 'Compatibilidad PWA: Faltan iconos reglamentarios' };
      }

      return { 
        success: true, 
        message: 'Compatibilidad Multiplataforma (PWA e Iconos): OK',
        details: { theme: manifest.theme_color }
      };
    } catch (e) {
      return { success: false, message: 'Error al verificar recursos de compatibilidad' };
    }
};
