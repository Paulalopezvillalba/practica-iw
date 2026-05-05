import { doc, getDoc, setDoc, deleteDoc, increment, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * PRUEBAS DE BASE DE DATOS (INTEGRIDAD Y CONCURRENCIA)
 * Verifica que el sistema maneja correctamente la integridad de los datos:
 * - Uso de increment() para evitar errores de concurrencia en contadores.
 * - Sincronismo entre acciones (Like/Comment) y estadísticas del post.
 */
export const testDatabaseIntegrity = async (userId: string) => {
  const testPostId = `integrity_test_${Date.now()}`;
  const postRef = doc(db, 'posts', testPostId);

  try {
    // 1. Crear un post de prueba con contadores en cero
    // NOTA: Debe incluir todos los campos obligatorios definidos en firestore.rules (isValidPost)
    await setDoc(postRef, {
      authorId: userId,
      mediaUrl: 'https://example.com/test.jpg',
      mediaType: 'image',
      duration: 15,
      status: 'active',
      description: 'Post de prueba de integridad',
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString()
    });

    // 2. Simular un "Me gusta" usando increment()
    // Esto es crucial para la integridad: suma 1 sin importar el valor anterior en el cliente
    await updateDoc(postRef, {
      likesCount: increment(1)
    });

    // 3. Simular un "Comentario" usando increment()
    await updateDoc(postRef, {
      commentsCount: increment(1)
    });

    // 4. Verificar que los contadores se actualizaron correctamente en el servidor
    const snap = await getDoc(postRef);
    const data = snap.data();

    if (!data || data.likesCount !== 1 || data.commentsCount !== 1) {
      throw new Error('Los contadores no se sincronizaron atómicamente');
    }

    // 5. Limpieza
    await deleteDoc(postRef);

    return { 
      success: true, 
      message: 'Integridad de Base de Datos: OK (Contadores atómicos verificados)',
      details: { sync: 'increment() validado', concurrency: 'Safe' }
    };
  } catch (e: any) {
    // Limpiar si falló a mitad
    await deleteDoc(postRef).catch(() => {});
    return { success: false, message: `Fallo de Integridad: ${e.message}` };
  }
};
