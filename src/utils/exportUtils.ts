import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { PrintFormat, VehicleItem, InventoryMeta, LetterSettings, ThermalSettings } from '../types';

/**
 * Escapes characters for clean HTML injection in off-screen elements
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates base64 QR code data URLs for vehicles
 */
async function generateQrDataUrls(vehicles: VehicleItem[], size = 240): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const veh of vehicles) {
    if (veh.vin && !map[veh.vin]) {
      try {
        map[veh.vin] = await QRCode.toDataURL(veh.vin, {
          width: size,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
      } catch (e) {
        console.warn('Error generating QR in export:', e);
      }
    }
  }
  return map;
}

/**
 * Builds an off-screen, beautifully styled Carta element that matches the LetterPreview layout exactly,
 * unaffected by zoom transforms or display:none states, ensuring reliable, crash-free PDF and image rendering.
 */
function createOffscreenLetterElement(
  vehicles: VehicleItem[],
  meta: InventoryMeta,
  settings: LetterSettings,
  qrMap: Record<string, string> = {}
): HTMLElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '816px';
  container.style.minHeight = '1056px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  container.style.padding = '40px';
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-9999';

  const uniqueMakes = Array.from(new Set(vehicles.map((v) => v.make).filter(Boolean)));

  const headerHtml = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f172a; padding-bottom:16px;">
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="background-color:#0f172a; color:#ffffff; padding:4px 8px; border-radius:4px; font-weight:900; font-size:14px; font-family:monospace;">VIN</div>
          <h1 style="font-size:20px; font-weight:900; text-transform:uppercase; margin:0; color:#020617; letter-spacing:-0.5px;">
            ${escapeHtml(settings.companyName || 'CONTROL DE INVENTARIO VEHICULAR')}
          </h1>
        </div>
        <p style="font-size:12px; font-weight:600; color:#475569; margin:4px 0 0 0; text-transform:uppercase;">
          ${escapeHtml(settings.documentTitle || 'Planilla Oficial de Inspección y Despacho de Patio')}
        </p>
        ${
          meta.location
            ? `<p style="font-size:12px; color:#64748b; margin:2px 0 0 0;">Ubicación / Patio: <strong style="color:#1e293b;">${escapeHtml(
                meta.location
              )}</strong></p>`
            : ''
        }
      </div>

      <div style="text-align:right; font-size:12px;">
        <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; line-height:1.4;">
          <div><span style="color:#64748b;">Fecha Emisión:</span> <strong style="color:#0f172a;">${escapeHtml(
            meta.date || new Date().toLocaleDateString('es-ES')
          )}</strong></div>
          <div><span style="color:#64748b;">Hora:</span> <strong style="color:#0f172a;">${escapeHtml(
            meta.time || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          )}</strong></div>
          ${
            meta.operator
              ? `<div><span style="color:#64748b;">Auditor:</span> <strong style="color:#0f172a;">${escapeHtml(
                  meta.operator
                )}</strong></div>`
              : ''
          }
        </div>
      </div>
    </div>
  `;

  const statsHtml = settings.showStats
    ? `
    <div style="display:flex; justify-content:space-between; align-items:center; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 14px; margin-top:14px; font-size:12px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="color:#64748b;">Total de unidades:</span>
        <strong style="font-size:14px; color:#0f172a;">${vehicles.length} vehículos</strong>
      </div>
      ${
        uniqueMakes.length > 0
          ? `<div><span style="color:#64748b;">Marcas presentes:</span> <strong style="color:#334155;">${escapeHtml(
              uniqueMakes.join(', ')
            )}</strong></div>`
          : ''
      }
    </div>
  `
    : '';

  const colCount = settings.showQrCode ? (settings.showCheckboxes ? 8 : 7) : (settings.showCheckboxes ? 7 : 6);

  const tableRows =
    vehicles.length === 0
      ? `
      <tr>
        <td colspan="${colCount}" style="padding:24px; text-align:center; color:#94a3b8; font-style:italic;">
          No hay vehículos registrados en este inventario.
        </td>
      </tr>
    `
      : vehicles
          .map(
            (veh, idx) => `
      <tr style="border-bottom:1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color:#f8fafc;' : ''}">
        <td style="padding:8px 6px; font-weight:bold; color:#64748b; font-size:11px; text-align:center;">
          ${String(idx + 1).padStart(2, '0')}
        </td>
        <td style="padding:8px 10px; font-family:monospace; font-weight:800; font-size:12px; color:#0f172a; letter-spacing:0.5px;">
          ${escapeHtml(veh.vin)}
        </td>
        ${
          settings.showQrCode
            ? `
          <td style="padding:4px 6px; text-align:center;">
            ${qrMap[veh.vin] ? `<img src="${qrMap[veh.vin]}" width="40" height="40" style="display:block; margin:0 auto;" />` : ''}
          </td>
        `
            : ''
        }
        <td style="padding:8px 8px; font-size:12px; font-weight:600; color:#1e293b;">
          ${escapeHtml(veh.make || '-')} ${escapeHtml(veh.model || '')}
        </td>
        <td style="padding:8px 6px; font-size:11px; color:#475569; text-align:center;">
          ${escapeHtml(veh.year || '-')}
        </td>
        <td style="padding:8px 6px; font-size:11px; color:#475569; text-align:center;">
          ${escapeHtml(veh.lot || '-')}
        </td>
        <td style="padding:8px 8px; font-size:11px; color:#64748b; font-style:italic;">
          ${escapeHtml(veh.notes || '-')}
        </td>
        ${
          settings.showCheckboxes
            ? `
          <td style="padding:8px 6px; text-align:center;">
            <div style="width:18px; height:18px; border:2px solid #475569; border-radius:3px; margin:0 auto; font-size:11px; font-weight:bold; line-height:18px; text-align:center;">
              ${veh.checked ? '✓' : ''}
            </div>
          </td>
        `
            : ''
        }
      </tr>
    `
          )
          .join('');

  const tableHtml = `
    <div style="margin-top:14px; border:1px solid #cbd5e1; border-radius:6px; overflow:hidden;">
      <table style="width:100%; border-collapse:collapse; text-align:left; font-size:11px;">
        <thead>
          <tr style="background-color:#0f172a; color:#ffffff; font-weight:bold; text-transform:uppercase; font-size:10px; letter-spacing:0.5px;">
            <th style="padding:8px 6px; width:36px; text-align:center;">#</th>
            <th style="padding:8px 10px;">Número VIN (17 Caracteres)</th>
            ${settings.showQrCode ? '<th style="padding:8px 6px; width:52px; text-align:center;">QR</th>' : ''}
            <th style="padding:8px 8px;">Marca / Modelo</th>
            <th style="padding:8px 6px; text-align:center;">Año</th>
            <th style="padding:8px 6px; text-align:center;">Lote / Patio</th>
            <th style="padding:8px 8px;">Notas / Observaciones</th>
            ${settings.showCheckboxes ? '<th style="padding:8px 6px; width:44px; text-align:center;">Físico</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;

  const footerHtml = `
    <div style="margin-top:28px; border-top:2px solid #0f172a; padding-top:20px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:40px; font-size:11px;">
        <div>
          <div style="border-bottom:1px solid #0f172a; padding-bottom:30px; text-align:center; color:#94a3b8;">Firma autorizada</div>
          <div style="padding-top:6px; text-align:center;">
            <p style="font-weight:bold; color:#0f172a; text-transform:uppercase; margin:0;">
              ${escapeHtml(settings.supervisorName || meta.operator || 'Auditor de Patio')}
            </p>
            <p style="font-size:10px; color:#64748b; margin:2px 0 0 0;">Responsable de Inventario / Despacho</p>
          </div>
        </div>

        <div>
          <div style="border-bottom:1px solid #0f172a; padding-bottom:30px; text-align:center; color:#94a3b8;">Firma recepcionista</div>
          <div style="padding-top:6px; text-align:center;">
            <p style="font-weight:bold; color:#0f172a; text-transform:uppercase; margin:0;">Seguridad / Transporte</p>
            <p style="font-size:10px; color:#64748b; margin:2px 0 0 0;">C.I. / Identificación y Fecha</p>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#94a3b8; margin-top:24px;">
        <span>AutoPrint VIN · Sistema Profesional de Inventario Automotriz</span>
        <span>Formato Carta (8.5 × 11")</span>
        <span>Generado: ${new Date().toLocaleString('es-ES')}</span>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; justify-content:space-between; min-height:976px;">
      <div>
        ${headerHtml}
        ${statsHtml}
        ${tableHtml}
      </div>
      ${footerHtml}
    </div>
  `;

  return container;
}

/**
 * Builds an off-screen, high-resolution 58mm Thermal Receipt element.
 * Standard 58mm thermal printable width is 384px (48mm printable area at 203 DPI = 384 dots).
 * Uses pure black #000000 on pure white #ffffff to avoid low-resolution thermal dithering.
 */
function createOffscreenThermalElement(
  vehicles: VehicleItem[],
  meta: InventoryMeta,
  settings?: ThermalSettings,
  qrMap: Record<string, string> = {}
): HTMLElement {
  const isUltra = settings?.density === 'ultra';
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '384px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = "'JetBrains Mono', 'Courier New', monospace";
  container.style.padding = '16px 14px 24px 14px';
  container.style.boxSizing = 'border-box';
  container.style.fontSize = isUltra ? '12px' : '13px';
  container.style.lineHeight = '1.3';
  container.style.zIndex = '-9999';

  const rowsHtml =
    vehicles.length === 0
      ? `<div style="text-align:center; padding:18px 0; font-size:12px; font-weight:bold; color:#000000;">[SIN VEHÍCULOS REGISTRADOS]</div>`
      : vehicles
          .map((v, i) => {
            const num = String(i + 1).padStart(2, '0');
            return `
      <div style="border-bottom:${settings?.showDividers !== false ? '1px dashed #000000' : 'none'}; padding:${isUltra ? '5px 0' : '8px 0'};">
        <div style="display:flex; justify-content:space-between; align-items:baseline; font-weight:900; font-size:${isUltra ? '14px' : '15px'}; color:#000000; letter-spacing:0.5px;">
          <span>${num}. ${escapeHtml(v.vin)}</span>
          ${settings?.showCheckboxes !== false ? '<span style="font-size:13px; font-weight:bold;">[ ]</span>' : ''}
        </div>
        ${
          (v.make || v.model || v.year) && settings?.showDetails !== false
            ? `
          <div style="font-size:12px; font-weight:bold; color:#000000; display:flex; justify-content:space-between; margin-top:2px;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:260px;">
              ${escapeHtml([v.make, v.model, v.year].filter(Boolean).join(' ') || 'Vehículo')}
            </span>
            ${v.lot && settings?.showLot !== false ? `<span style="font-weight:900;">L:${escapeHtml(v.lot)}</span>` : ''}
          </div>
        `
            : ''
        }
        ${
          !isUltra && (v.color || v.status)
            ? `
          <div style="font-size:11px; color:#000000; display:flex; justify-content:space-between; margin-top:1px;">
            <span>${escapeHtml(v.color || '')}</span>
            <span>${escapeHtml(v.status || '')}</span>
          </div>
        `
            : ''
        }
        ${
          settings?.barcodeType === 'qr' && qrMap[v.vin]
            ? `
          <div style="text-align:center; padding:6px 0; background-color:#ffffff;">
            <img src="${qrMap[v.vin]}" width="140" height="140" style="display:inline-block; margin:0 auto; image-rendering:pixelated;" />
          </div>
        `
            : ''
        }
      </div>
    `;
          })
          .join('');

  container.innerHTML = `
    <div style="text-align:center; border-bottom:2px solid #000000; padding-bottom:10px; margin-bottom:10px; background-color:#ffffff;">
      <div style="font-size:11px; letter-spacing:1px; font-weight:bold; text-transform:uppercase; color:#000000;">CONTROL DE PATIO</div>
      <div style="font-size:17px; font-weight:900; text-transform:uppercase; color:#000000; margin-top:2px; letter-spacing:-0.5px;">
        ${escapeHtml(settings?.customHeader || 'INVENTARIO DE VIN')}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:13px; font-weight:900; border:1.5px solid #000000; padding:4px 8px; background-color:#ffffff; color:#000000;">
        <span>TOTAL UNIDADES:</span>
        <span>${vehicles.length} VEHICULOS</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:bold; margin-top:6px; color:#000000;">
        <span>FECHA: ${escapeHtml(meta.date || new Date().toLocaleDateString('es-ES'))}</span>
        <span>HORA: ${escapeHtml(meta.time || '')}</span>
      </div>
      ${meta.location ? `<div style="text-align:left; font-size:11px; font-weight:bold; color:#000000; margin-top:3px;">PATIO: ${escapeHtml(meta.location)}</div>` : ''}
    </div>
    <div style="margin-bottom:12px; background-color:#ffffff;">
      ${rowsHtml}
    </div>
    <div style="text-align:center; border-top:2px solid #000000; padding-top:10px; font-size:11px; color:#000000; background-color:#ffffff;">
      <div style="font-weight:900; font-size:12px; text-transform:uppercase;">${escapeHtml(settings?.customFooter || 'CONTROL DE PATIO Y DESPACHO')}</div>
      <div style="margin-top:22px; border-top:1.5px solid #000000; width:200px; margin-left:auto; margin-right:auto; padding-top:4px; font-weight:bold; font-size:11px; text-transform:uppercase;">
        FIRMA RESPONSABLE
      </div>
      <div style="margin-top:10px; font-size:9px; letter-spacing:1px; font-weight:bold;">*** FIN DE REPORTE ***</div>
    </div>
  `;

  return container;
}

/**
 * Generates an authentic Carta or Thermal PDF, rendered offscreen to avoid clipping, zoom, or hidden container errors.
 */
export async function generateVisualPdf(
  format: PrintFormat,
  titleText: string = 'Inventario',
  contextData?: {
    vehicles: VehicleItem[];
    meta: InventoryMeta;
    letterSettings?: LetterSettings;
    thermalSettings?: ThermalSettings;
  }
): Promise<{ blob: Blob; fileName: string; dataUrl: string }> {
  const dateStr = new Date().toISOString().slice(0, 10);

  // 1. Off-screen Carta PDF generation
  if (format === 'letter') {
    const vehicles = contextData?.vehicles || [];
    const meta = contextData?.meta || {
      title: 'Inventario',
      date: new Date().toLocaleDateString('es-ES'),
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      location: '',
      operator: '',
      notes: '',
    };
    const defaultSettings: LetterSettings = {
      companyName: 'LOGÍSTICA & DESPACHO AUTOMOTRIZ S.A.',
      yardName: 'Patio Principal de Vehículos',
      documentTitle: 'Planilla de Auditoría Física y Verificación de VINs',
      supervisorName: 'Auditor de Patio',
      showCheckboxes: true,
      showStats: true,
      notes: '',
      columnsPerPage: 1,
      showQrCode: true,
      ...contextData?.letterSettings,
    };

    const qrMap = defaultSettings.showQrCode ? await generateQrDataUrls(vehicles) : {};
    const offscreenEl = createOffscreenLetterElement(vehicles, meta, defaultSettings, qrMap);
    document.body.appendChild(offscreenEl);

    try {
      const canvas = await html2canvas(offscreenEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 816,
        windowWidth: 816,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter',
      });

      const pageWidth = 8.5;
      const pageHeight = 11;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight, undefined, 'FAST');
      } else {
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = position - pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }
      }

      const fileName = `Planilla-Carta-VIN-${dateStr}.pdf`;
      const blob = pdf.output('blob');
      const dataUrl = pdf.output('datauristring');
      return { blob, fileName, dataUrl };
    } finally {
      if (offscreenEl.parentNode) {
        offscreenEl.parentNode.removeChild(offscreenEl);
      }
    }
  }

  // 2. Off-screen Thermal 58mm PDF generation
  if (format === 'thermal58') {
    const vehicles = contextData?.vehicles || [];
    const meta = contextData?.meta || {
      title: 'Inventario',
      date: new Date().toLocaleDateString('es-ES'),
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      location: '',
      operator: '',
      notes: '',
    };

    const isQr = contextData?.thermalSettings?.barcodeType === 'qr';
    const qrMap = isQr ? await generateQrDataUrls(vehicles) : {};
    const offscreenEl = createOffscreenThermalElement(vehicles, meta, contextData?.thermalSettings, qrMap);
    document.body.appendChild(offscreenEl);

    try {
      const canvas = await html2canvas(offscreenEl, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 384,
        windowWidth: 384,
      });

      const imgData = canvas.toDataURL('image/png');
      const widthMm = 58;
      const heightMm = Math.max(40, Math.round((canvas.height * widthMm) / canvas.width));
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [widthMm, heightMm],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
      const fileName = `Ticket-Termico-58mm-${dateStr}.pdf`;
      const blob = pdf.output('blob');
      const dataUrl = pdf.output('datauristring');
      return { blob, fileName, dataUrl };
    } finally {
      if (offscreenEl.parentNode) {
        offscreenEl.parentNode.removeChild(offscreenEl);
      }
    }
  }

  throw new Error(`Formato no reconocido: ${format}`);
}

/**
 * Captures image for Letter or Thermal format in ultra-high resolution (300 DPI equivalent)
 * ensuring crystal clear printing and razor-sharp barcodes/QR codes without blur.
 */
export async function generateVisualImage(
  format: PrintFormat,
  contextData?: {
    vehicles: VehicleItem[];
    meta: InventoryMeta;
    letterSettings?: LetterSettings;
    thermalSettings?: ThermalSettings;
  }
): Promise<{ blob: Blob; fileName: string; dataUrl: string }> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const vehicles = contextData?.vehicles || [];
  const meta = contextData?.meta || {
    title: 'Inventario',
    date: new Date().toLocaleDateString('es-ES'),
    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    location: '',
    operator: '',
    notes: '',
  };

  if (format === 'letter') {
    const defaultSettings: LetterSettings = {
      companyName: 'LOGÍSTICA & DESPACHO AUTOMOTRIZ S.A.',
      yardName: 'Patio Principal de Vehículos',
      documentTitle: 'Planilla de Auditoría Física y Verificación de VINs',
      supervisorName: 'Auditor de Patio',
      showCheckboxes: true,
      showStats: true,
      notes: '',
      columnsPerPage: 1,
      showQrCode: true,
      ...contextData?.letterSettings,
    };

    const qrMap = defaultSettings.showQrCode ? await generateQrDataUrls(vehicles, 240) : {};
    const offscreenEl = createOffscreenLetterElement(vehicles, meta, defaultSettings, qrMap);
    document.body.appendChild(offscreenEl);

    try {
      // Scale 3 produces 2448 x 3168 px (true 300 DPI print quality)
      const canvas = await html2canvas(offscreenEl, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 816,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `Planilla-Carta-HD-${dateStr}.png`;

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve({
            blob: blob || new Blob(),
            fileName,
            dataUrl,
          });
        }, 'image/png');
      });
    } finally {
      if (offscreenEl.parentNode) {
        offscreenEl.parentNode.removeChild(offscreenEl);
      }
    }
  } else {
    // Thermal 58mm image: Render at 384px with scale 3 for 1152px ultra-sharp output
    const isQr = contextData?.thermalSettings?.barcodeType === 'qr';
    const qrMap = isQr ? await generateQrDataUrls(vehicles, 240) : {};
    const offscreenEl = createOffscreenThermalElement(vehicles, meta, contextData?.thermalSettings, qrMap);
    document.body.appendChild(offscreenEl);

    try {
      const canvas = await html2canvas(offscreenEl, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 384,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `Ticket-Termico-58mm-HD-${dateStr}.png`;

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve({
            blob: blob || new Blob(),
            fileName,
            dataUrl,
          });
        }, 'image/png');
      });
    } finally {
      if (offscreenEl.parentNode) {
        offscreenEl.parentNode.removeChild(offscreenEl);
      }
    }
  }
}
