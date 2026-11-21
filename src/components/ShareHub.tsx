import React, { useState } from 'react';
import {
  Share2,
  FileText,
  Receipt,
  Download,
  Copy,
  Check,
  Printer,
  Smartphone,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { VehicleItem, InventoryMeta, PrintFormat, LetterSettings, ThermalSettings } from '../types';
import { generateVisualPdf, generateVisualImage } from '../utils/exportUtils';

interface ShareHubProps {
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  activeFormat: PrintFormat;
  letterSettings: LetterSettings;
  thermalSettings: ThermalSettings;
  onNavigateToTab: (tab: 'scan' | 'inventory' | 'preview') => void;
}

export const ShareHub: React.FC<ShareHubProps> = ({
  vehicles,
  meta,
  activeFormat,
  letterSettings,
  thermalSettings,
  onNavigateToTab,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<PrintFormat>(activeFormat);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Safe file downloader without navigating away
  const downloadBlobSafe = (blob: Blob, fileName: string) => {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_self';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 500);
    } catch (e) {
      console.error('Error al descargar archivo:', e);
    }
  };

  // Safe Web Share API handler
  const triggerSafeShare = async (
    title: string,
    text: string,
    files?: File[],
    fallbackBlob?: Blob,
    fallbackFileName?: string
  ) => {
    let shareDone = false;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        if (files && files.length > 0 && typeof (navigator as any).canShare === 'function') {
          if ((navigator as any).canShare({ files })) {
            await navigator.share({ title, text, files });
            shareDone = true;
            setSuccessMessage('¡Documento enviado/compartido con éxito!');
            return;
          }
        }

        // Try text-only share
        await navigator.share({ title, text });
        shareDone = true;
        setSuccessMessage('¡Información compartida con éxito!');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Web Share API error:', err);
      }
    }

    if (!shareDone && fallbackBlob && fallbackFileName) {
      downloadBlobSafe(fallbackBlob, fallbackFileName);
      setSuccessMessage(`Documento descargado en tu dispositivo (${fallbackFileName}). Listo para enviar.`);
    }
  };

  // Download PDF
  const handleDownloadPdf = async (format: PrintFormat) => {
    if (vehicles.length === 0) {
      setErrorMessage('No hay vehículos en la lista para exportar. Escanea o agrega VINs primero.');
      return;
    }

    setIsProcessing(true);
    setProcessingAction(`pdf-${format}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { blob, fileName } = await generateVisualPdf(format, meta.title, {
        vehicles,
        meta,
        letterSettings,
        thermalSettings,
      });

      downloadBlobSafe(blob, fileName);
      setSuccessMessage(`Planilla PDF generada y descargada: "${fileName}".`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Ocurrió un error al generar el archivo PDF. Intenta nuevamente.');
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  // Download PNG Image
  const handleDownloadImage = async (format: PrintFormat) => {
    if (vehicles.length === 0) {
      setErrorMessage('No hay vehículos en la lista para exportar. Escanea o agrega VINs primero.');
      return;
    }

    setIsProcessing(true);
    setProcessingAction(`image-${format}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { blob, fileName } = await generateVisualImage(format, {
        vehicles,
        meta,
        letterSettings,
        thermalSettings,
      });

      downloadBlobSafe(blob, fileName);
      setSuccessMessage(`Imagen PNG de alta resolución descargada: "${fileName}".`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Ocurrió un error al generar la imagen. Intenta nuevamente.');
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  // Export Excel / CSV
  const handleExportSpreadsheet = () => {
    if (vehicles.length === 0) {
      setErrorMessage('No hay vehículos para exportar a planilla.');
      return;
    }

    try {
      const data = vehicles.map((v, i) => ({
        '#': i + 1,
        'VIN / Chasis': v.vin,
        'Marca': v.make || '',
        'Modelo': v.model || '',
        'Año': v.year || '',
        'Lote': v.lot || '',
        'Estado': v.status || 'En patio',
        'Notas': v.notes || '',
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

      const dateStr = (meta.date || new Date().toISOString().slice(0, 10)).replace(/\//g, '-');
      const fileName = `Inventario_VIN_${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
      setSuccessMessage(`Planilla Excel descargada con éxito: "${fileName}".`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Error al crear archivo Excel.');
    }
  };

  // Copy all VINs to clipboard
  const handleCopyVins = () => {
    if (vehicles.length === 0) {
      setErrorMessage('No hay VINs en la lista para copiar.');
      return;
    }

    const text = vehicles.map((v, i) => `${i + 1}. ${v.vin}${v.make || v.model ? ` - ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(true);
      setSuccessMessage(`¡${vehicles.length} números VIN copiados al portapapeles!`);
      setTimeout(() => setCopiedText(false), 3000);
    });
  };

  // WhatsApp formatted share
  const handleShareWhatsApp = () => {
    if (vehicles.length === 0) {
      setErrorMessage('No hay vehículos en la lista para enviar por WhatsApp.');
      return;
    }

    const title = `*REPORTE DE INVENTARIO VEHICULAR - ${meta.title || 'PATIO'}*`;
    const headerInfo = `📅 Fecha: ${meta.date || ''} | ⏰ Hora: ${meta.time || ''}\n📍 Patio: ${meta.location || 'Central'}\n👤 Auditor: ${meta.operator || 'Inspector'}\n📊 Total unidades: ${vehicles.length}\n`;
    const vinList = vehicles
      .slice(0, 50)
      .map((v, i) => `${i + 1}. *${v.vin}* ${[v.make, v.model, v.year].filter(Boolean).join(' ')}${v.lot ? ` (Lote: ${v.lot})` : ''}`)
      .join('\n');

    const extraNote = vehicles.length > 50 ? `\n...y ${vehicles.length - 50} vehículos adicionales.` : '';
    const message = encodeURIComponent(`${title}\n\n${headerInfo}\n${vinList}${extraNote}\n\n_Generado automáticamente con AutoPrint VIN_`);

    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#185abd] flex items-center justify-center font-bold shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-semibold text-base sm:text-lg text-slate-900">
                4. Exportar y Compartir Inventario
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#185abd] border border-blue-200">
                {vehicles.length} {vehicles.length === 1 ? 'vehículo listo' : 'vehículos listos'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Descarga en PDF oficial, genera imágenes de alta calidad, exporta a Excel o comparte por WhatsApp
            </p>
          </div>
        </div>
      </div>

      {/* Primary Action Buttons Bar */}
      <div className="space-y-3 mb-6">
        {/* ROW 1: Main Exports (PDF & Image) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleDownloadPdf('letter')}
            disabled={isProcessing}
            className="btn-3d flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg bg-[#185abd] hover:bg-[#106ebe] active:bg-[#004578] text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer disabled:opacity-50 text-center"
          >
            {isProcessing && processingAction === 'pdf-letter' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Download className="w-4 h-4 text-white" />
            )}
            <span>Descargar Planilla PDF Carta (8.5×11")</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadImage('thermal58')}
            disabled={isProcessing}
            className="btn-3d flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium border border-slate-300 shadow-2xs cursor-pointer disabled:opacity-50 text-center"
          >
            {isProcessing && processingAction === 'image-thermal58' ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#185abd]" />
            ) : (
              <ImageIcon className="w-4 h-4 text-[#185abd]" />
            )}
            <span>Descargar Imagen PNG 58mm (Ultra HD)</span>
          </button>
        </div>

        {/* ROW 2: Direct Shares (WhatsApp, Excel, Copy) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-medium transition-colors cursor-pointer text-center"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Compartir por WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleExportSpreadsheet}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer text-center"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Exportar Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleCopyVins}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer text-center"
          >
            {copiedText ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-emerald-700 font-semibold">¡VINs Copiados!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Copiar Lista de VINs</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Grid of Clean Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* 1. WhatsApp Instant Share */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900">WhatsApp</h4>
                <p className="text-[11px] text-slate-500">Enviar resumen a chofer o supervisor</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 my-2 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80 font-mono text-[11px]">
              Envía el lote de {vehicles.length} unidades formateado con fecha, patio y números VIN directamente.
            </p>
          </div>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full mt-2.5 py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>Compartir por WhatsApp</span>
          </button>
        </div>

        {/* 2. Descargar PDF Carta */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#185abd] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900">Planilla PDF Carta</h4>
                <p className="text-[11px] text-slate-500">Documento formal Letter con Códigos QR</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 my-2 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80 text-[11px]">
              Ideal para auditorías, impresión en oficina, firmas de recepción y despacho formal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownloadPdf('letter')}
            disabled={isProcessing}
            className="w-full mt-2.5 py-2 px-3 rounded-lg bg-[#185abd] hover:bg-[#106ebe] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors disabled:opacity-50"
          >
            {isProcessing && processingAction === 'pdf-letter' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Descargar PDF Carta</span>
          </button>
        </div>

        {/* 3. Descargar Ticket Térmico 58mm */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900">Ticket Térmico 58mm</h4>
                <p className="text-[11px] text-slate-500">Formato continuo para impresoras Bluetooth</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 my-2 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80 text-[11px]">
              Tira térmica optimizada para terminales portátiles de patio y control en caseta.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => handleDownloadPdf('thermal58')}
              disabled={isProcessing}
              className="py-2 px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-300 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 text-center"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>PDF 58mm</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadImage('thermal58')}
              disabled={isProcessing}
              className="py-2 px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-300 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 text-center"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#185abd]" />
              <span>PNG HD</span>
            </button>
          </div>
        </div>

        {/* 4. Exportar Planilla Excel / CSV */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900">Planilla Excel / CSV</h4>
                <p className="text-[11px] text-slate-500">Libro estructurado con todos los campos</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 my-2 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80 text-[11px]">
              Descarga un archivo .xlsx listo para abrir en Microsoft Excel, Google Sheets o importar a tu ERP.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportSpreadsheet}
            className="w-full mt-2.5 py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Descargar Archivo Excel (.xlsx)</span>
          </button>
        </div>

        {/* 5. Copiar VINs al Portapapeles */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#185abd] flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900">Copiar Lista de VINs</h4>
                <p className="text-[11px] text-slate-500">Texto limpio listo para pegar donde quieras</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 my-2 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80 text-[11px]">
              Copia todos los números de chasis enumerados para enviarlos por correo, Teams o chat de patio.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyVins}
            className="w-full mt-2.5 py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            {copiedText ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">¡Copiado con Éxito!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copiar {vehicles.length} VINs</span>
              </>
            )}
          </button>
        </div>

        {/* 6. Vista Previa de Documento */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#185abd] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900">Diseño y Vista Previa</h4>
                <p className="text-[11px] text-slate-500">Inspecciona el formato antes de emitir</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 my-2 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80 text-[11px]">
              Verifica el aspecto final de la planilla o ticket térmico. Para imprimir, pulsa el botón superior único <strong>"Imprimir"</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('preview')}
            className="w-full mt-2.5 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>Ver Vista Previa del Documento</span>
          </button>
        </div>
      </div>

      {/* Bottom Shortcuts */}
      <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">
          ¿Deseas verificar la vista previa antes de emitir o imprimir?
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateToTab('preview')}
            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#185abd] font-medium border border-blue-200 cursor-pointer transition-colors"
          >
            Ir a Vista Previa
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab('inventory')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 cursor-pointer transition-colors"
          >
            Ir a Inventario
          </button>
        </div>
      </div>
    </div>
  );
};
