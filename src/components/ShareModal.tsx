import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Share2,
  FileText,
  Receipt,
  Download,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Send,
  CheckCircle2,
  Image as ImageIcon,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { VehicleItem, InventoryMeta, PrintFormat, LetterSettings, ThermalSettings } from '../types';
import { generateVisualPdf, generateVisualImage } from '../utils/exportUtils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  activeFormat: PrintFormat;
  letterSettings?: LetterSettings;
  thermalSettings?: ThermalSettings;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  meta,
  activeFormat,
  letterSettings,
  thermalSettings,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<PrintFormat>(activeFormat);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedFormat(activeFormat);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen, activeFormat]);

  if (!isOpen) return null;

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
            setSuccessMessage('Documento enviado correctamente.');
            return;
          }
        }

        await navigator.share({ title, text });
        shareDone = true;
        setSuccessMessage('Información compartida correctamente.');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Web Share API error:', err);
      }
    }

    if (!shareDone && fallbackBlob && fallbackFileName) {
      downloadBlobSafe(fallbackBlob, fallbackFileName);
      setSuccessMessage(`Archivo descargado (${fallbackFileName}).`);
    }
  };

  const handleSendPdf = async () => {
    setIsProcessing(true);
    setProcessingAction('pdf');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { blob, fileName } = await generateVisualPdf(selectedFormat, meta.title, {
        vehicles,
        meta,
        letterSettings,
        thermalSettings,
      });

      downloadBlobSafe(blob, fileName);

      const isCarta = selectedFormat === 'letter';
      const pdfFile = new File([blob], fileName, { type: 'application/pdf' });
      await triggerSafeShare(
        `Inventario ${isCarta ? 'Carta' : 'Térmico 58mm'} (${vehicles.length} VINs)`,
        `Planilla de ${vehicles.length} vehículos. Fecha: ${meta.date || ''}.`,
        [pdfFile],
        blob,
        fileName
      );

      setSuccessMessage(`PDF generado y descargado (${fileName}).`);
    } catch (err) {
      console.error(err);
      setErrorMessage('No se pudo generar el documento PDF. Reintenta.');
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  const handleSendImage = async () => {
    setIsProcessing(true);
    setProcessingAction('image');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { blob, fileName } = await generateVisualImage(selectedFormat, {
        vehicles,
        meta,
        letterSettings,
        thermalSettings,
      });

      downloadBlobSafe(blob, fileName);

      const isCarta = selectedFormat === 'letter';
      const imgFile = new File([blob], fileName, { type: 'image/png' });
      await triggerSafeShare(
        `Imagen Inventario ${isCarta ? 'Carta' : 'Térmico 58mm'} (${vehicles.length} VINs)`,
        `Planilla de ${vehicles.length} vehículos.`,
        [imgFile],
        blob,
        fileName
      );

      setSuccessMessage(`Imagen PNG descargada (${fileName}).`);
    } catch (err) {
      console.error(err);
      setErrorMessage('No se pudo generar la imagen PNG.');
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  const handleExportExcel = () => {
    setIsProcessing(true);
    setProcessingAction('excel');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const rows = vehicles.map((v, idx) => ({
        '#': idx + 1,
        VIN: v.vin,
        Marca: v.make || '',
        Modelo: v.model || '',
        Año: v.year || '',
        Color: v.color || '',
        Lote: v.lot || '',
        Estado: v.status || 'En patio',
        Verificado: v.checked ? 'Sí' : 'No',
        Notas: v.notes || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 5 },
        { wch: 21 },
        { wch: 14 },
        { wch: 18 },
        { wch: 8 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 11 },
        { wch: 24 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario VIN');

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Inventario-VIN-${dateStr}.xlsx`;
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      downloadBlobSafe(blob, fileName);
      setSuccessMessage(`Planilla Excel descargada (${fileName}).`);
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al exportar el archivo Excel.');
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  const handleCopyVins = async () => {
    try {
      const text = vehicles
        .map((v, i) =>
          `${i + 1}. ${v.vin} ${v.make || ''} ${v.model || ''} ${v.lot ? `(Lote: ${v.lot})` : ''}`.trim()
        )
        .join('\n');
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
      setSuccessMessage('Lista de VINs copiada al portapapeles.');
    } catch {
      setErrorMessage('No se pudo copiar automáticamente.');
    }
  };

  const isCarta = selectedFormat === 'letter';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-xl border border-slate-300 max-w-lg w-full overflow-hidden text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#185ABD] text-white flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                Enviar y Exportar Inventario
              </h3>
              <p className="text-xs text-slate-500 tabular-nums">
                {vehicles.length} {vehicles.length === 1 ? 'unidad registrada' : 'unidades registradas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-md hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Format Selector */}
          <div className="pb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Formato para PDF e Imagen:
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedFormat('letter')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  selectedFormat === 'letter'
                    ? 'bg-white text-[#185ABD] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Planilla Carta</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('thermal58')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  selectedFormat === 'thermal58'
                    ? 'bg-white text-[#185ABD] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Ticket 58mm</span>
              </button>
            </div>
          </div>

          {successMessage && (
            <div className="mb-3 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#107C41] shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-3 px-3 py-2 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Export Actions */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={isProcessing || vehicles.length === 0}
              onClick={handleSendPdf}
              className="w-full p-3.5 rounded-md bg-[#185ABD] hover:bg-[#104A9B] text-white transition-colors flex items-center justify-between text-left cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-white/15 flex items-center justify-center shrink-0">
                  {isProcessing && processingAction === 'pdf' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCarta ? (
                    <FileText className="w-4 h-4" />
                  ) : (
                    <Receipt className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <span className="font-semibold text-sm block">
                    Enviar / Descargar PDF ({isCarta ? 'Carta' : '58mm'})
                  </span>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {isCarta
                      ? 'Planilla oficial lista para correo o archivo'
                      : 'Ticket térmico listo para compartir o imprimir'}
                  </p>
                </div>
              </div>
              <Send className="w-4 h-4 text-white/80 shrink-0" />
            </button>

            <button
              type="button"
              disabled={isProcessing || vehicles.length === 0}
              onClick={handleExportExcel}
              className="w-full p-3.5 rounded-md bg-white hover:bg-emerald-50/40 border border-slate-300 hover:border-[#107C41] text-slate-900 transition-colors flex items-center justify-between text-left cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-emerald-50 text-[#107C41] flex items-center justify-center shrink-0 border border-emerald-200">
                  {isProcessing && processingAction === 'excel' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <span className="font-semibold text-sm block">
                    Exportar Libro de Excel (.xlsx)
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hoja estructurada compatible con Microsoft Excel y LibreOffice
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              disabled={isProcessing || vehicles.length === 0}
              onClick={handleSendImage}
              className="w-full p-3.5 rounded-md bg-white hover:bg-[#EFF6FC]/50 border border-slate-300 hover:border-[#185ABD] text-slate-900 transition-colors flex items-center justify-between text-left cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-[#EFF6FC] text-[#185ABD] flex items-center justify-center shrink-0 border border-[#BFDBFE]">
                  {isProcessing && processingAction === 'image' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <span className="font-semibold text-sm block">
                    Enviar como Imagen HD ({isCarta ? 'Carta PNG' : '58mm PNG'})
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ideal para enviar directamente por WhatsApp o mensajería
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Footer Utilities */}
          <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-slate-200 text-xs">
            <button
              type="button"
              disabled={vehicles.length === 0}
              onClick={handleCopyVins}
              className="text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded border border-slate-200 disabled:opacity-50"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#107C41]" />
                  <span className="text-[#107C41] font-semibold">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar {vehicles.length} VINs</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
