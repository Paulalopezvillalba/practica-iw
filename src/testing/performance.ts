import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * PRUEBAS DE RENDIMIENTO
 * Mide la eficiencia de la infraestructura y red:
 * - Tiempo de subida de archivo (100KB)
 * - Latencia de lectura (Download)
 * - Velocidad de transferencia calculada en Mbps
 */
export const testPerformance = async (userId: string) => {
    const testFileName = `perf_test_${Date.now()}.bin`;
    const fileRef = ref(storage, `temp_tests/${userId}/${testFileName}`);
    const fileSizeKB = 100;
    const fileSizeBytes = fileSizeKB * 1024;
    
    try {
      // 1. Generar archivo temporal de 100KB
      const blob = new Blob([new ArrayBuffer(fileSizeBytes)], { type: 'application/octet-stream' });
      
      // 2. Medir tiempo exacto de subida
      const uploadStart = performance.now();
      await uploadBytes(fileRef, blob);
      const uploadEnd = performance.now();
      const uploadMs = uploadEnd - uploadStart;
      
      // 3. Medir latencia de lectura y descarga
      const downloadStart = performance.now();
      const url = await getDownloadURL(fileRef);
      let downloadMs = 0;
      let speedMbps = '0.00';
      
      try {
        const response = await fetch(url);
        if (response.ok) {
          await response.arrayBuffer();
          const downloadEnd = performance.now();
          downloadMs = downloadEnd - downloadStart;
          const totalTimeSec = (uploadMs + downloadMs) / 1000;
          const totalBits = fileSizeBytes * 8 * 2;
          speedMbps = (totalBits / totalTimeSec / 1000000).toFixed(2);
        }
      } catch (err) {
        console.warn('Performance download test failed due to CORS or network');
      }

      // 4. Limpieza automática
      await deleteObject(fileRef).catch(() => {});

      return { 
        success: true, 
        message: `Rendimiento: OK (${uploadMs.toFixed(0)}ms subida | ${speedMbps} Mbps)`,
        details: { 
          uploadMs: uploadMs.toFixed(2), 
          latencyMs: downloadMs.toFixed(2),
          speedMbps: speedMbps,
          fileSize: '100KB'
        }
      };
    } catch (e: any) {
      // Intentar limpieza si algo falló
      await deleteObject(fileRef).catch(() => {});
      return { success: false, message: `Error de rendimiento: ${e.message}` };
    }
};
