import React, { useState } from 'react';
import {
  Bluetooth,
  Printer,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { VehicleItem, InventoryMeta, ThermalSettings } from '../types';
import {
  buildEscPosCommands,
  buildThermalPlainText,
  printViaWebBluetooth,
} from '../utils/escpos';

interface BluetoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  settings: ThermalSettings;
}

export const BluetoothModal: React.FC<BluetoothModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  meta,
  settings,
}) => {
  const [status, setStatus] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const hasWebBluetooth =
    typeof navigator !== 'undefined' && Boolean((navigator as any).bluetooth);

  const handleConnectAndPrint = async () => {
    setError(null);
    setStatus('Iniciando búsqueda de dispositivo Bluetooth...');
    setIsPrinting(true);

    try {
      const escposData = buildEscPosCommands(vehicles, meta, settings);
      const res = await printViaWebBluetooth(escposData, (msg) => {
        setStatus(msg);
      });

      if (!res.success) {
        setError(res.error || 'Error al imprimir vía Bluetooth');
      } else {
        setStatus('¡Impresión finalizada exitosamente en tu impresora 58mm!');
      }
    } catch (err: any) {
      setError(err?.message || 'Error durante la comunicación Bluetooth.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopyRawText = () => {
    const raw = buildThermalPlainText(vehicles, meta, settings);
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Impresora Térmica Bluetooth (58mm)
              </h3>
              <p className="text-[11px] text-slate-500">Conexión directa ESC/POS inalámbrica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-3.5 text-xs text-slate-600">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span>Unidades a transmitir:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900">
                {vehicles.length} vehículos
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Ancho de bobina:</span>
              <span>58mm (384 puntos)</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Protocolo:</span>
              <span>ESC/POS Estándar</span>
            </div>
          </div>

          {/* Web Bluetooth Availability Check */}
          {!hasWebBluetooth ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Web Bluetooth no disponible en este navegador</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Para imprimir directo vía Bluetooth, abre esta página en <strong>Google Chrome</strong> en Android o Windows.
              </p>
              <p className="text-[11px] pt-1">
                Alternativa fácil: Presiona <strong>Imprimir Formato (58mm)</strong> para usar el diálogo del sistema o copia el texto para la app <strong>RawBT</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">
                Asegúrate de que tu impresora portátil esté encendida y con Bluetooth activado antes de vincular.
              </p>

              <button
                type="button"
                disabled={isPrinting || vehicles.length === 0}
                onClick={handleConnectAndPrint}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Conectando e Imprimiendo...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Conectar y Enviar a Impresora 58mm</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Status logs */}
          {status && (
            <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-900 flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{status}</span>
            </div>
          )}

          {/* Errors */}
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Secondary Action: Copy formatted text */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">¿Usas la app RawBT / Bluetooth Print?</span>
            <button
              type="button"
              onClick={handleCopyRawText}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar Texto Térmico</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
