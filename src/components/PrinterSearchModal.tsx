import React, { useState } from 'react';
import {
  Printer,
  Bluetooth,
  Wifi,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  FileText,
  FileDown,
  Info,
  RotateCw,
} from 'lucide-react';
import { VehicleItem, InventoryMeta, ThermalSettings, PrintFormat } from '../types';
import {
  buildEscPosCommands,
  printViaWebBluetooth,
} from '../utils/escpos';

interface PrinterSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  settings: ThermalSettings;
  activeFormat: PrintFormat;
  onExecuteSystemPrint: (formatToPrint?: PrintFormat) => void;
}

export const PrinterSearchModal: React.FC<PrinterSearchModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  meta,
  settings,
  activeFormat,
  onExecuteSystemPrint,
}) => {
  const [isBtSearching, setIsBtSearching] = useState(false);
  const [btStatus, setBtStatus] = useState<string | null>(null);
  const [btError, setBtError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<PrintFormat>(activeFormat);

  if (!isOpen) return null;

  // Search & Connect Web Bluetooth directly
  const handleDirectBluetoothSearch = async () => {
    setBtError(null);
    setBtStatus('Iniciando búsqueda de dispositivos Bluetooth...');
    setIsBtSearching(true);

    try {
      const escposData = buildEscPosCommands(vehicles, meta, settings);
      const res = await printViaWebBluetooth(escposData, (msg) => {
        setBtStatus(msg);
      });

      if (!res.success) {
        setBtError(res.error || 'No se pudo conectar a la impresora Bluetooth.');
      } else {
        setBtStatus('¡Impresión enviada exitosamente a la impresora Bluetooth!');
      }
    } catch (err: any) {
      setBtError(
        'El navegador no pudo acceder directamente al Bluetooth. Usa el botón "Impresoras del Sistema" para imprimir en tu impresora vinculada.'
      );
    } finally {
      setIsBtSearching(false);
    }
  };

  const handleSystemPrint = (fmt: PrintFormat) => {
    onClose();
    onExecuteSystemPrint(fmt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Buscar Impresoras
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Conectar a impresora Térmica BT o WiFi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 text-xl font-bold transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Format selector buttons */}
        <div className="my-3 flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setSelectedFormat('thermal58')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              selectedFormat === 'thermal58'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Térmica 58mm (BT)</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedFormat('letter')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              selectedFormat === 'letter'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Formato Carta</span>
          </button>
        </div>

        {/* Feedback states */}
        {btStatus && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{btStatus}</span>
          </div>
        )}

        {btError && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Aviso de Conexión:</span>
              <p className="text-[11px] text-amber-800 mt-0.5">{btError}</p>
            </div>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          {/* Main Option 1: Impresoras del Sistema (Works for all WiFi & Paired BT printers without restrictions) */}
          <button
            type="button"
            onClick={() => handleSystemPrint(selectedFormat)}
            className="w-full p-4 rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-between text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
                <Wifi className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-wide">
                    Impresoras del Sistema (WiFi / BT)
                  </span>
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                    UNIVERSAL
                  </span>
                </div>
                <p className="text-xs text-emerald-100 font-medium">
                  Detecta impresoras vinculadas en tu Android, iPhone o PC
                </p>
              </div>
            </div>
            <Printer className="w-5 h-5 text-emerald-200 group-hover:scale-110 transition-transform shrink-0" />
          </button>

          {/* Option 2: Buscar Impresora Bluetooth (Direct Web Bluetooth ESC/POS) */}
          <button
            type="button"
            disabled={isBtSearching || vehicles.length === 0}
            onClick={handleDirectBluetoothSearch}
            className="w-full p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 hover:border-slate-300 transition-all flex items-center justify-between text-left shadow-xs group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                {isBtSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bluetooth className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Escanear Dispositivo Bluetooth (BT)
                </span>
                <p className="text-[11px] text-slate-500 font-medium">
                  Búsqueda directa de impresora portátil 58mm por Bluetooth
                </p>
              </div>
            </div>
            <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
          </button>
        </div>

        {/* Tip */}
        <div className="mt-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
          <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.2" />
          <span>
            <strong>Consejo:</strong> Si tu impresora ya está emparejada por Bluetooth en la configuración de tu teléfono o computadora, el botón <strong>Impresoras del Sistema</strong> la encontrará de inmediato.
          </span>
        </div>

        {/* Footer */}
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
          >
            Cerrar ventana
          </button>
        </div>
      </div>
    </div>
  );
};
