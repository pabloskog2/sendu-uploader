/** Normaliza un RUT chileno para comparar/guardar (sin puntos ni guion, en mayúscula). */
export function normalizeRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}
