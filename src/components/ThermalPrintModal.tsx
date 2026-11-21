import React, { useState } from 'react';
import {
  Printer,
  Bluetooth,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { VehicleItem, InventoryMeta, ThermalSettings, PrintFormat } from '../types';
import {
  buildEscPosCommands,
  printViaWebBluetooth,
} from '../utils/escpos';

interface ThermalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  settings: ThermalSettings;
  activeFormat?: PrintFormat;
  onPrintViaSystem: () => void;
}

export const ThermalPrintModal: React.FC<ThermalPrintModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  meta,
  settings,
  activeFormat = 'thermal58',
  onPrintViaSystem,
}) => {
  const [isBtSearching, setIsBtSearching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ isIframeBlocked?: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const isLetter = activeFormat === 'letter';

  // Bluetooth direct search
  const handleBluetoothSearchAndPrint = async () => {
    setErrorInfo(null);
    setStatus('Buscando impresora Bluetooth...');
    setIsBtSearching(true);

    try {
      const escposData = buildEscPosCommands(vehicles, meta, settings);
      const res = await printViaWebBluetooth(escposData, (msg) => {
        setStatus(msg);
      });

      if (!res.success) {
        const isBlocked =
          res.error?.includes('seguridad') ||
          res.error?.includes('iframe') ||
          res.error?.includes('restringió') ||
          res.error?.includes('policy');

        setErrorInfo({
          isIframeBlocked: isBlocked,
          message: res.error || 'No se pudo conectar a la impresora Bluetooth.',
        });
      } else {
        setStatus('¡Impresión Bluetooth completada con éxito!');
      }
    } catch (err: any) {
      setErrorInfo({
        isIframeBlocked: true,
        message: 'Para imprimir en tu impresora Bluetooth vinculada, usa la opción Impresora del Sistema (WiFi / BT).',
      });
    } finally {
      setIsBtSearching(false);
    }
  };

  const handleOpenFullscreen = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Imprimir Documento
              </h3>
              <p className="text-xs text-slate-500">
                Selecciona tu impresora WiFi o Bluetooth
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

        {/* Format Indicator */}
        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {isLetter ? (
              <FileText className="w-4 h-4 text-blue-600" />
            ) : (
              <Receipt className="w-4 h-4 text-indigo-600" />
            )}
            <span className="font-bold text-slate-800">
              Formato Seleccionado: {isLetter ? 'Carta (8.5 × 11")' : 'Térmica 58mm (BT)'}
            </span>
          </div>
          <span className="font-mono font-bold text-slate-700">
            {vehicles.length} {vehicles.length === 1 ? 'auto' : 'autos'}
          </span>
        </div>

        {/* Options */}
        <div className="py-4 space-y-3">
          {/* Button 1: Main search for all connected printers (WiFi & Paired BT) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onPrintViaSystem();
            }}
            className="w-full p-4 rounded-xl border border-slate-900 bg-slate-950 hover:bg-slate-800 text-white transition-all flex items-center justify-between text-left shadow-sm group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-white">
                  Buscar Impresoras (WiFi / Bluetooth)
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Abre el administrador del sistema para imprimir en tu impresora WiFi de red o Bluetooth vinculada
                </p>
              </div>
            </div>
            <Printer className="w-4 h-4 text-slate-400 group-hover:text-white shrink-0 ml-2" />
          </button>

          {/* Button 2: Direct Bluetooth portable receipt printer (ESC/POS) */}
          {!isLetter && (
            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Bluetooth className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-900">
                    Buscar Impresora Portátil BT (ESC/POS)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Conexión directa por Bluetooth a mini impresora térmica
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isBtSearching || vehicles.length === 0}
                onClick={handleBluetoothSearchAndPrint}
                className="w-full py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isBtSearching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Buscando Impresora Bluetooth...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>Buscar y Conectar BT</span>
                  </>
                )}
              </button>

              {status && (
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-2 text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-medium">{status}</span>
                </div>
              )}

              {errorInfo && (
                <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 space-y-2 text-[11px]">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      {errorInfo.isIframeBlocked
                        ? 'Tu impresora Bluetooth vinculada está lista en el administrador del sistema. Usa el botón de abajo para imprimir de inmediato.'
                        : errorInfo.message}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onPrintViaSystem();
                      }}
                      className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-center transition-colors"
                    >
                      Imprimir en Impresora Vinculada
                    </button>

                    {errorInfo.isIframeBlocked && (
                      <button
                        type="button"
                        onClick={handleOpenFullscreen}
                        className="py-1.5 px-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold rounded flex items-center gap-1 transition-colors"
                        title="Abrir en ventana completa para acceso directo a Bluetooth"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Pantalla Completa</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex justify-end">
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
