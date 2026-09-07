/**
 * Parser mínimo para el formato de export del SII: un array de strings,
 * el primero es el encabezado, separados por ";". No hay comillas ni
 * escapes en los ejemplos reales vistos, así que un split simple basta.
 */
export function parseSemicolonCsv(rows: string[]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const header = rows[0].split(";");
  return rows.slice(1).map((row) => {
    const cells = row.split(";");
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key] = cells[i] ?? "";
    });
    return record;
  });
}

/** Convierte "DD/MM/YYYY" (formato de fecha del SII) a Date. */
export function parseSiiDate(value: string): Date {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}
