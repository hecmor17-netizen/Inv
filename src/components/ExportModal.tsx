import React, { useState } from 'react';
import {
  Printer,
  FileText,
  Receipt,
  Download,
  Share2,
  Check,
  Loader2,
  ExternalLink,
  Info,
} from 'lucide-react';
import { VehicleItem, InventoryMeta, PrintFormat } from '../types';
import { generateVisualPdf, generateVisualImage } from '../utils/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  activeFormat: PrintFormat;
  onPrintDirect: (format?: PrintFormat) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  meta,
  activeFormat,
  onPrintDirect,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Option 1: Send exact Letter format PDF (as explicitly requested: "Al enviar que se envíe el formato carta")
  const handleSendLetterFormat = async () => {
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const { blob, fileName } = await generateVisualPdf('letter', meta.title);

      // Trigger automatic download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Try native share if on mobile
      if (
        typeof navigator !== 'undefined' &&
        (navigator as any).canShare &&
        (navigator as any).canShare({
          files: [new File([blob], fileName, { type: 'application/pdf' })],
        })
      ) {
        await (navigator as any).share({
          title: `Planilla de Despacho Carta (${vehicles.length} VINs)`,
          text: `Planilla oficial en formato Carta generada para ${vehicles.length} vehículos.`,
          files: [new File([blob], fileName, { type: 'application/pdf' })],
        });
      }

      setStatusMessage(`¡Planilla Formato Carta generada y descargada exitosamente! (${fileName})`);
    } catch (err: any) {
      console.error(err);
      setStatusMessage('Error al generar la planilla en formato carta: ' + (err?.message || 'Reintentar'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Option 2: Share current active format (Letter or Thermal 58mm) allowing user to choose destination / WiFi / Apps
  const handleShareCurrentFormat = async () => {
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const { blob, fileName } = await generateVisualPdf(activeFormat, meta.title);

      const file = new File([blob], fileName, { type: 'application/pdf' });

      // Check if navigator.share can share files
      if (
        typeof navigator !== 'undefined' &&
        (navigator as any).canShare &&
        (navigator as any).canShare({ files: [file] })
      ) {
        await (navigator as any).share({
          title: `Reporte de Inventario (${activeFormat === 'letter' ? 'Carta' : 'Térmica 58mm'})`,
          text: `Inventario oficial de patio: ${vehicles.length} vehículos registrados.`,
          files: [file],
        });
        setStatusMessage('¡Documento compartido con éxito!');
        return;
      }

      // If Web Share is not available or cancelled, trigger download and offer system print
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatusMessage(`Documento descargado (${fileName}). Puedes abrirlo con tu app de impresión WiFi o visor favorito.`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Option 3: Download exact visual image (PNG)
  const handleDownloadImage = async () => {
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const { blob, fileName } = await generateVisualImage(activeFormat);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatusMessage(`¡Imagen guardada! (${fileName})`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Enviar o Compartir
              </h3>
              <p className="text-xs text-slate-500">
                Elige cómo enviar tu reporte de inventario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 text-xl font-bold transition-colors"
          >
            ×
          </button>
        </div>

        {/* Info */}
        <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">
            Formato actual: <strong className="text-slate-900">{activeFormat === 'letter' ? 'Carta (8.5×11")' : 'Térmica 58mm (BT)'}</strong>
          </span>
          <span className="font-bold font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
            {vehicles.length} {vehicles.length === 1 ? 'auto' : 'autos'}
          </span>
        </div>

        {/* Options */}
        <div className="py-4 space-y-2.5">
          {/* 1. Enviar Formato Carta */}
          <button
            type="button"
            disabled={isGenerating || vehicles.length === 0}
            onClick={handleSendLetterFormat}
            className="w-full p-3.5 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-between text-left shadow-sm disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-white">
                  Enviar en Formato Carta (PDF)
                </p>
                <p className="text-[11px] text-blue-100">
                  Genera la planilla oficial 8.5" × 11" con tabla técnica y firmas
                </p>
              </div>
            </div>
            <Download className="w-4 h-4 text-blue-200 shrink-0" />
          </button>

          {/* 2. Compartir (Elige app / Impresora WiFi) */}
          <button
            type="button"
            disabled={isGenerating || vehicles.length === 0}
            onClick={handleShareCurrentFormat}
            className="w-full p-3.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 transition-all flex items-center justify-between text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-slate-900">
                  Compartir (Elegir destino / Impresora WiFi)
                </p>
                <p className="text-[11px] text-slate-500">
                  Abre el menú de compartir de tu dispositivo para elegir app o impresora
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {/* 3. Descargar Imagen PNG */}
          <button
            type="button"
            disabled={isGenerating || vehicles.length === 0}
            onClick={handleDownloadImage}
            className="w-full p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all flex items-center justify-between text-xs disabled:opacity-50"
          >
            <span className="font-medium">Guardar como imagen PNG</span>
            <Download className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Status */}
        {statusMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs mb-3">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{statusMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onPrintDirect();
            }}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir con el sistema</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
