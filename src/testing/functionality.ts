/**
 * PRUEBAS DE FUNCIONALIDAD
 * Verifica los requisitos funcionales básicos del sistema:
 * - Validación de mayoría de edad en registros
 */
export const testAgeValidation = async (birthDateStr: string) => {
  try {
    if (!birthDateStr) {
      return { success: false, message: 'Funcionalidad: Fecha no proporcionada' };
    }

    const birthDate = new Date(birthDateStr);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age >= 18) {
      return { 
        success: true, 
        message: `Funcionalidad: Mayor de edad verificado (${age} años)`,
        details: { age, birthDate: birthDateStr }
      };
    } else {
      return { 
        success: false, 
        message: `Funcionalidad: El usuario es menor de edad (${age} años)`,
        details: { age, birthDate: birthDateStr }
      };
    }
  } catch (e: any) {
    return { success: false, message: `Error en validación funcional: ${e.message}` };
  }
};
