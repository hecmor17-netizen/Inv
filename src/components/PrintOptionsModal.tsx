import React from 'react';
import { Printer, Receipt, FileText, X } from 'lucide-react';
import {
  VehicleItem,
  InventoryMeta,
  PrintFormat,
  ThermalSettings,
  LetterSettings,
} from '../types';
import { Thermal58Preview } from './Thermal58Preview';
import { LetterPreview } from './LetterPreview';

interface PrintOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  activeFormat: PrintFormat;
  setActiveFormat: (f: PrintFormat) => void;
  thermalSettings: ThermalSettings;
  setThermalSettings: React.Dispatch<React.SetStateAction<ThermalSettings>>;
  letterSettings: LetterSettings;
  setLetterSettings: React.Dispatch<React.SetStateAction<LetterSettings>>;
  onPrint: () => void;
  isPrinting?: boolean;
  printerFeedback?: string | null;
}

export const PrintOptionsModal: React.FC<PrintOptionsModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  meta,
  activeFormat,
  setActiveFormat,
  thermalSettings,
  setThermalSettings,
  letterSettings,
  setLetterSettings,
  onPrint,
  isPrinting = false,
  printerFeedback = null,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-xl border border-slate-300 max-w-4xl w-full overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-900">Imprimir Documento</h3>
              <p className="text-xs text-slate-500 tabular-nums">
                {vehicles.length} {vehicles.length === 1 ? 'unidad lista' : 'unidades listas'} para impresión
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrint}
              disabled={vehicles.length === 0 || isPrinting}
              className="flex items-center gap-2 py-2 px-4 rounded-md bg-[#185ABD] hover:bg-[#104A9B] text-white font-semibold text-xs cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Enviando...' : 'Imprimir Ahora'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="w-8 h-8 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Format Selector Bar */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-600">Formato:</span>
            <div className="inline-flex bg-slate-100 p-1 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveFormat('thermal58')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeFormat === 'thermal58'
                    ? 'bg-white text-[#185ABD] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Ticket Térmico 58mm</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFormat('letter')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeFormat === 'letter'
                    ? 'bg-white text-[#185ABD] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Hoja Carta (8.5×11&quot;)</span>
              </button>
            </div>
          </div>

          {printerFeedback && (
            <div className="text-xs font-medium text-slate-800 bg-[#EFF6FC] px-3 py-1 rounded border border-[#BFDBFE]">
              {printerFeedback}
            </div>
          )}
        </div>

        {/* Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#F3F2F1]">
          {vehicles.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Printer className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-sm text-slate-700">No hay vehículos para imprimir</p>
              <p className="text-xs text-slate-500 mt-1">
                Escanea o agrega números VIN primero para generar la vista de impresión.
              </p>
            </div>
          ) : activeFormat === 'thermal58' ? (
            <div className="max-w-md mx-auto">
              <Thermal58Preview
                vehicles={vehicles}
                meta={meta}
                settings={thermalSettings}
                onUpdateSettings={(newStg) =>
                  setThermalSettings((prev) => ({ ...prev, ...newStg }))
                }
              />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <LetterPreview
                vehicles={vehicles}
                meta={meta}
                settings={letterSettings}
                onUpdateSettings={(newStg) =>
                  setLetterSettings((prev) => ({ ...prev, ...newStg }))
                }
                onPrintCarta={onPrint}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
