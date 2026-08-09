const CLAVE_DATOS = "tinkus:borrador-registro:v1";
const CLAVE_TOKEN = "tinkus:token-registro-validado:v1";
const BD = "tinkus-registro";
const ALMACEN = "archivos";

const abrirBd = () => new Promise<IDBDatabase>((resolve, reject) => {
  const solicitud = indexedDB.open(BD, 1);
  solicitud.onupgradeneeded = () => {
    if (!solicitud.result.objectStoreNames.contains(ALMACEN)) solicitud.result.createObjectStore(ALMACEN);
  };
  solicitud.onsuccess = () => resolve(solicitud.result);
  solicitud.onerror = () => reject(solicitud.error);
});

export const guardarDatosBorrador = (datos: unknown) => localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
export const leerDatosBorrador = <T,>(): Partial<T> => { try { return JSON.parse(localStorage.getItem(CLAVE_DATOS) || "{}"); } catch { return {}; } };
export const guardarTokenBorrador = (token: unknown) => localStorage.setItem(CLAVE_TOKEN, JSON.stringify(token));
export const leerTokenBorrador = <T,>(): T | null => { try { return JSON.parse(localStorage.getItem(CLAVE_TOKEN) || "null"); } catch { return null; } };
export const limpiarTokenBorrador = () => localStorage.removeItem(CLAVE_TOKEN);
export const guardarArchivoBorrador = async (campo: string, archivo: File | null) => { const bd = await abrirBd(); await new Promise<void>((resolve, reject) => { const tx = bd.transaction(ALMACEN, "readwrite"); const store = tx.objectStore(ALMACEN); archivo ? store.put(archivo, campo) : store.delete(campo); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); bd.close(); };
export const leerArchivosBorrador = async () => { const bd = await abrirBd(); const campos = ["fotoPerfil", "carnetIdentidadPdf", "carnetIdentidadReverso", "registroUniversitarioPdf"]; const resultado: Record<string, File | null> = {}; await Promise.all(campos.map(campo => new Promise<void>((resolve) => { const tx = bd.transaction(ALMACEN, "readonly"); const req = tx.objectStore(ALMACEN).get(campo); req.onsuccess = () => { resultado[campo] = req.result instanceof File ? req.result : null; resolve(); }; req.onerror = () => resolve(); }))); bd.close(); return resultado; };
export const limpiarBorradorRegistro = async () => { localStorage.removeItem(CLAVE_DATOS); localStorage.removeItem(CLAVE_TOKEN); const bd = await abrirBd(); await new Promise<void>((resolve) => { const tx = bd.transaction(ALMACEN, "readwrite"); tx.objectStore(ALMACEN).clear(); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); }); bd.close(); };
