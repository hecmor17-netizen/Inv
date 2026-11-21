import { VehicleItem } from '../types';

/**
 * Validates whether a string conforms to a standard 17-character VIN.
 * Rules:
 * - 17 alphanumeric characters
 * - Letters I, O, Q are disallowed in ISO 3779 to prevent confusion with 1 and 0.
 */
export function validateVin(vinRaw: string): { isValid: boolean; error?: string } {
  const vin = (vinRaw || '').trim().toUpperCase();
  if (!vin) {
    return { isValid: false, error: 'El VIN está vacío' };
  }
  if (vin.length !== 17) {
    return { isValid: false, error: `Longitud incorrecta (${vin.length}/17 caracteres)` };
  }
  if (/[IOQ]/i.test(vin)) {
    return { isValid: false, error: 'Contiene caracteres no permitidos (I, O o Q)' };
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
    return { isValid: false, error: 'Contiene caracteres alfanuméricos inválidos' };
  }
  return { isValid: true };
}

/**
 * Modern VIN 10th character model year mapping (1980 - 2039)
 */
const YEAR_CODES: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014,
  F: 2015, G: 2016, H: 2017, J: 2018, K: 2019,
  L: 2020, M: 2021, N: 2022, P: 2023, R: 2024,
  S: 2025, T: 2026, V: 2027, W: 2028, X: 2029,
  Y: 2030, '1': 2001, '2': 2002, '3': 2003, '4': 2004,
  '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009,
};

export function estimateYearFromVin(vin: string): string {
  if (vin.length < 10) return '';
  const char = vin.charAt(9).toUpperCase();
  const year = YEAR_CODES[char];
  return year ? String(year) : '';
}

/**
 * Known WMI prefixes for quick auto-detection
 */
const WMI_MAP: Record<string, string> = {
  '1FT': 'Ford', '1FM': 'Ford', '1FA': 'Ford',
  '1GC': 'Chevrolet', '1G1': 'Chevrolet', '1GN': 'Chevrolet',
  '1HG': 'Honda', '2HG': 'Honda', '3HG': 'Honda',
  '1TY': 'Toyota', '2T1': 'Toyota', '4T1': 'Toyota', 'JTD': 'Toyota', 'JTE': 'Toyota', 'MR0': 'Toyota',
  'JN1': 'Nissan', '1N4': 'Nissan', '3N1': 'Nissan',
  '3VW': 'Volkswagen', 'WVW': 'Volkswagen', 'WBA': 'BMW',
  'WDB': 'Mercedes-Benz', 'WAU': 'Audi', 'KMH': 'Hyundai',
  'KNA': 'Kia', 'VF1': 'Renault', 'VF3': 'Peugeot',
};

export function estimateMakeFromVin(vin: string): string {
  if (vin.length < 3) return '';
  const prefix = vin.slice(0, 3).toUpperCase();
  return WMI_MAP[prefix] || '';
}

/**
 * Cleans and normalizes an OCR or user-typed string into a valid 17-character VIN.
 * Returns the 17-char string if valid, or null if it cannot form a valid VIN.
 */
export function cleanAndNormalizeVin(raw: string): string | null {
  if (!raw) return null;
  // Remove asterisks, dashes, spaces, colons, dots
  let cleaned = raw.replace(/[\*\s\-_:.]/g, '').toUpperCase().trim();
  
  if (cleaned.length === 17) {
    // OCR letter corrections (letters I, O, Q are not allowed in standard ISO 3779 VINs)
    cleaned = cleaned.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
    if (/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

/**
 * Extracts strictly valid 17-character VINs from plain text (clipboard, pasted list, or table).
 * Ignores headers, patentes, random text, and non-VIN lines.
 */
export function parseVinsFromRawText(text: string): VehicleItem[] {
  if (!text) return [];

  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return [];

  const items: VehicleItem[] = [];
  const seenVins = new Set<string>();

  for (let idx = 0; idx < rawLines.length; idx++) {
    const line = rawLines[idx];
    if (!line) continue;

    // Look for any 17-character sequence in the line (allowing for common OCR letter confusions)
    const matches = line.match(/[A-Za-z0-9\-_*]{17,21}/g) || [];
    let detectedVin: string | null = null;

    for (const m of matches) {
      const candidate = cleanAndNormalizeVin(m);
      if (candidate) {
        detectedVin = candidate;
        break;
      }
    }

    // Fallback: check whole line if cleaned is 17 chars
    if (!detectedVin) {
      detectedVin = cleanAndNormalizeVin(line);
    }

    // If this line does not contain a valid 17-character VIN, skip it!
    if (!detectedVin || seenVins.has(detectedVin)) {
      continue;
    }

    seenVins.add(detectedVin);

    // Parse metadata (make, model, year, lot) from the same line if present
    const cols = line.split(/[\t,;|]/).map((c) => c.trim()).filter(Boolean);
    let make = estimateMakeFromVin(detectedVin);
    let model = '';
    let year = estimateYearFromVin(detectedVin);
    let color = '';
    let lot = '';
    let notes = '';

    if (cols.length >= 2) {
      const otherCols = cols.filter((c) => !cleanAndNormalizeVin(c));
      if (otherCols[0]) make = otherCols[0];
      if (otherCols[1]) model = otherCols[1];
      if (otherCols[2] && /^\d{4}$/.test(otherCols[2])) year = otherCols[2];
      if (otherCols[3]) lot = otherCols[3];
    } else {
      // Find year in line
      const yearMatch = line.match(/\b(19\d\d|20\d\d)\b/);
      if (yearMatch) year = yearMatch[1];

      // Auto-detect known make name from text
      const upperLine = line.toUpperCase();
      for (const [, mName] of Object.entries(WMI_MAP)) {
        if (upperLine.includes(mName.toUpperCase())) {
          make = mName;
          break;
        }
      }
    }

    items.push({
      id: `vin-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      vin: detectedVin,
      make: make || estimateMakeFromVin(detectedVin),
      model,
      year: year || estimateYearFromVin(detectedVin),
      color,
      lot,
      status: 'En patio',
      notes,
      checked: false,
    });
  }

  return items;
}

/**
 * High-fidelity sample automotive inventory
 */
export function getSampleInventory(): VehicleItem[] {
  return [
    {
      id: 'samp-1',
      vin: '3N1AB8CV4RY219804',
      make: 'Nissan',
      model: 'Sentra Advance',
      year: '2024',
      color: 'Gris Grafito',
      lot: 'Patio A-04',
      status: 'En patio',
      notes: 'Llave en caja 12 · Sin detalles',
      checked: true,
    },
    {
      id: 'samp-2',
      vin: 'MR0BA3CD2R0108924',
      make: 'Toyota',
      model: 'Hilux D/C 4x4',
      year: '2024',
      color: 'Blanco Perlado',
      lot: 'Patio A-11',
      status: 'Inspeccionado',
      notes: 'Protector de tolva instalado',
      checked: true,
    },
    {
      id: 'samp-3',
      vin: '1FTFW1ED5RFA92381',
      make: 'Ford',
      model: 'F-150 Lariat FX4',
      year: '2024',
      color: 'Negro Ágata',
      lot: 'Patio B-02',
      status: 'Listo para despacho',
      notes: 'Documentación al día',
      checked: true,
    },
    {
      id: 'samp-4',
      vin: '3VW2B7AJ9RM418290',
      make: 'Volkswagen',
      model: 'Taos Highline',
      year: '2024',
      color: 'Azul Boreal',
      lot: 'Patio B-08',
      status: 'En patio',
      notes: 'Batería desconectada preventivo',
      checked: false,
    },
    {
      id: 'samp-5',
      vin: '1G1YB2D45R5102941',
      make: 'Chevrolet',
      model: 'Colorado LTZ',
      year: '2024',
      color: 'Rojo Carmesí',
      lot: 'Patio C-01',
      status: 'En patio',
      notes: 'Revisión técnica OK',
      checked: false,
    },
    {
      id: 'samp-6',
      vin: 'KL1TD66E9NB381029',
      make: 'Chevrolet',
      model: 'Tracker Premier',
      year: '2023',
      color: 'Plata Metálico',
      lot: 'Patio C-05',
      status: 'Pendiente entrega',
      notes: 'Cliente retira mañana',
      checked: false,
    },
  ];
}
