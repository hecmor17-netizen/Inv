// ESC/POS Commands Generator & Thermal Printer Helper
import { VehicleItem, InventoryMeta, ThermalSettings } from '../types';

/**
 * Builds clean plain text representation for thermal printers
 */
export function buildThermalPlainText(
  vehicles: VehicleItem[],
  meta: InventoryMeta,
  settings: ThermalSettings
): string {
  const isUltra = settings.density === 'ultra';
  const lines: string[] = [];

  lines.push('================================');
  lines.push(settings.customHeader || 'LOGÍSTICA & PATIO AUTOMOTRIZ');
  lines.push(meta.title || 'CONTROL DE INVENTARIO VIN');
  lines.push('--------------------------------');
  lines.push(`FECHA: ${meta.date || ''}  ${meta.time || ''}`);
  if (meta.location) lines.push(`PATIO: ${meta.location}`);
  if (meta.operator) lines.push(`AUDITOR: ${meta.operator}`);
  lines.push('================================');

  vehicles.forEach((veh, index) => {
    const num = String(index + 1).padStart(2, '0');
    if (isUltra) {
      const desc = [veh.make, veh.model].filter(Boolean).join(' ');
      lines.push(`${num}. ${veh.vin}`);
      const extras = [desc, veh.lot ? `L:${veh.lot}` : '', veh.checked ? '[X]' : '[ ]'].filter(
        Boolean
      );
      if (extras.length > 0) lines.push(`   ${extras.join(' | ')}`);
    } else {
      lines.push(`[${num}] ${veh.vin}`);
      const desc = [veh.make, veh.model, veh.year].filter(Boolean).join(' ');
      if (desc) lines.push(`    ${desc}`);
      if (veh.color || veh.lot) {
        lines.push(`    ${[veh.color, veh.lot ? `Lote:${veh.lot}` : ''].filter(Boolean).join(' | ')}`);
      }
      lines.push('    [ ] Verificado');
      if (settings.showDividers) lines.push('- - - - - - - - - - - - - - - -');
    }
  });

  lines.push('================================');
  lines.push(`TOTAL: ${vehicles.length} VEHICULOS`);
  if (settings.customFooter) lines.push(settings.customFooter);
  lines.push('FIRMA: _________________________');
  lines.push('\n\n');

  return lines.join('\n');
}

/**
 * Generates raw ESC/POS binary buffer
 */
export function buildEscPosCommands(
  vehicles: VehicleItem[],
  meta: InventoryMeta,
  settings: ThermalSettings
): Uint8Array {
  const buffer: number[] = [];
  const push = (...bytes: number[]) => buffer.push(...bytes);
  const pushText = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) {
        buffer.push(code);
      } else {
        // Simple ascii fallback
        buffer.push(0x3f);
      }
    }
  };

  // Init printer
  push(0x1B, 0x40);

  // Character code table (PC437)
  push(0x1B, 0x74, 0x00);

  // Center header
  push(0x1B, 0x61, 0x01);
  push(0x1B, 0x45, 0x01); // Bold on
  pushText(`${settings.customHeader || 'LOGÍSTICA & PATIO AUTOMOTRIZ'}\n`);
  push(0x1B, 0x45, 0x00); // Bold off

  push(0x1B, 0x21, 0x00); // Normal text
  pushText(`${meta.title || 'CONTROL DE INVENTARIO'}\n`);
  pushText('================================\n');

  // Left align metadata
  push(0x1B, 0x61, 0x00);
  pushText(`FECHA: ${meta.date || ''}  ${meta.time || ''}\n`);
  if (meta.location) pushText(`PATIO: ${meta.location}\n`);
  if (meta.operator) pushText(`AUDITOR: ${meta.operator}\n`);
  pushText('================================\n');

  const isUltra = settings.density === 'ultra';

  vehicles.forEach((veh, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    if (isUltra) {
      push(0x1B, 0x45, 0x01);
      pushText(`${num}. ${veh.vin}\n`);
      push(0x1B, 0x45, 0x00);

      const parts = [
        [veh.make, veh.model].filter(Boolean).join(' '),
        veh.lot ? `L:${veh.lot}` : '',
        settings.showCheckboxes ? '[ ]' : '',
      ].filter(Boolean);

      if (parts.length > 0 && settings.showDetails) {
        pushText(`   ${parts.join(' · ')}\n`);
      }
      if (settings.showDividers) {
        pushText('- - - - - - - - - - - - - - - -\n');
      }
    } else {
      push(0x1B, 0x45, 0x01);
      pushText(`[${num}] ${veh.vin}\n`);
      push(0x1B, 0x45, 0x00);

      const desc = [veh.make, veh.model, veh.year].filter(Boolean).join(' ');
      if (desc && settings.showDetails) {
        pushText(`    ${desc}\n`);
      }
      if (veh.color || (veh.lot && settings.showLot)) {
        const parts = [veh.color, veh.lot ? `Lote:${veh.lot}` : ''].filter(Boolean);
        pushText(`    ${parts.join(' | ')}\n`);
      }
      if (settings.showCheckboxes) {
        pushText('    [ ] Verificado en patio\n');
      }
      if (settings.showDividers) {
        pushText('--------------------------------\n');
      }
    }
  });

  // Footer
  push(0x1B, 0x61, 0x01); // Center
  pushText('================================\n');
  push(0x1B, 0x45, 0x01);
  pushText(`TOTAL: ${vehicles.length} VEHICULOS\n`);
  push(0x1B, 0x45, 0x00);
  if (settings.customFooter) pushText(`${settings.customFooter}\n`);
  pushText('FIRMA: _________________________\n');
  push(0x1B, 0x64, 0x03); // Feed 3 lines
  push(0x1D, 0x56, 0x42, 0x00); // Cut paper

  return new Uint8Array(buffer);
}

/**
 * Web Bluetooth Printer connection helper
 * Supports broad range of UUIDs and handles iframe security restrictions smoothly
 */
export async function printViaWebBluetooth(
  data: Uint8Array,
  onStatus?: (msg: string) => void
): Promise<{ success: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
    return {
      success: false,
      error:
        'Tu navegador no tiene activado Web Bluetooth. Usa el botón "Impresoras del Sistema" para enviar a cualquier impresora vinculada.',
    };
  }

  try {
    onStatus?.('Buscando dispositivos Bluetooth cercanos...');

    // Complete list of thermal printer BLE Service UUIDs
    const optionalServices = [
      '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
      '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard BLE Serial / CC2540 / HM-10
      '0000fff0-0000-1000-8000-00805f9b34fb', // Alternative Serial
      '0000ff00-0000-1000-8000-00805f9b34fb', // ESC/POS Mobile
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // PosBank
    ];

    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices,
    });

    onStatus?.(`Conectando a ${device.name || 'Impresora Bluetooth'}...`);
    const server = await device.gatt.connect();

    onStatus?.('Localizando canal de impresión ESC/POS...');
    const services = await server.getPrimaryServices();
    let writeChar: any = null;

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      } catch (e) {
        // Continue searching other services
      }
    }

    if (!writeChar) {
      throw new Error('No se encontró canal de escritura ESC/POS en el dispositivo.');
    }

    onStatus?.('Enviando datos a la impresora térmica...');

    const chunkSize = 256;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (writeChar.properties.writeWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 35));
    }

    onStatus?.('¡Impresión completada con éxito!');
    return { success: true };
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return { success: false, error: 'Búsqueda cancelada o no se seleccionó ninguna impresora.' };
    }
    if (
      err.name === 'SecurityError' ||
      err.message?.includes('iframe') ||
      err.message?.includes('policy') ||
      err.message?.includes('Permissions')
    ) {
      return {
        success: false,
        error:
          'El navegador restringió la búsqueda Bluetooth directa por seguridad del visor. Usa la opción "Impresoras del Sistema (WiFi/BT)" para imprimir en tu impresora vinculada.',
      };
    }
    return { success: false, error: err?.message || 'No se pudo conectar a la impresora Bluetooth.' };
  }
}
