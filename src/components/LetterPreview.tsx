import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Building2,
  FileCheck,
  CheckSquare,
  FileText,
  Printer,
  QrCode,
} from 'lucide-react';
import { VehicleItem, InventoryMeta, LetterSettings } from '../types';
import { BarcodeRenderer } from './BarcodeRenderer';

interface LetterPreviewProps {
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  settings: LetterSettings;
  onUpdateSettings: (newSettings: Partial<LetterSettings>) => void;
  onPrintCarta?: () => void;
}

export const LetterPreview: React.FC<LetterPreviewProps> = ({
  vehicles,
  meta,
  settings,
  onUpdateSettings,
  onPrintCarta,
}) => {
  const [zoom, setZoom] = useState(90);

  // Calculate stats
  const uniqueMakes = Array.from(new Set(vehicles.map((v) => v.make).filter(Boolean)));

  return (
    <div className="flex flex-col h-full">
      {/* Settings bar for Letter format */}
      <div className="no-print bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
        {/* Checkboxes, Stats & QR toggles */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Option: Ver Códigos QR */}
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#185abd] bg-blue-50/80 hover:bg-blue-100/80 px-2.5 py-1 rounded-md border border-blue-200 cursor-pointer transition-colors shadow-2xs">
            <input
              type="checkbox"
              checked={!!settings.showQrCode}
              onChange={(e) => onUpdateSettings({ showQrCode: e.target.checked })}
              className="rounded text-[#185abd] focus:ring-blue-500"
            />
            <QrCode className="w-3.5 h-3.5 text-[#185abd]" />
            <span>Ver códigos QR</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showCheckboxes}
              onChange={(e) => onUpdateSettings({ showCheckboxes: e.target.checked })}
              className="rounded text-[#185abd]"
            />
            <span>Casillas [ ]</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showStats}
              onChange={(e) => onUpdateSettings({ showStats: e.target.checked })}
              className="rounded text-[#185abd]"
            />
            <span>Resumen marcas</span>
          </label>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="p-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 cursor-pointer shadow-2xs"
            title="Reducir vista"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-slate-700 w-10 text-center font-medium">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(130, z + 10))}
            className="p-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 cursor-pointer shadow-2xs"
            title="Aumentar vista"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(90)}
            className="p-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 cursor-pointer shadow-2xs"
            title="Reiniciar zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Realistic Letter Sheet Area */}
      <div className="flex-1 bg-slate-950/70 rounded-xl p-3 sm:p-5 overflow-auto flex justify-center items-start min-h-[500px]">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          className="transition-transform duration-150"
        >
          {/* Standard Letter Sheet Dimensions: 816px x 1056px at 96 DPI */}
          <div
            id="print-letter-container"
            className="w-[816px] min-h-[1056px] bg-white text-slate-900 shadow-2xl border border-slate-300 p-10 flex flex-col justify-between font-sans relative"
          >
            <div>
              {/* Document Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-slate-900 text-white rounded flex items-center justify-center font-black text-sm">
                      VIN
                    </div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
                      {settings.companyName || 'CONTROL DE INVENTARIO VEHICULAR'}
                    </h1>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5 uppercase tracking-wide">
                    {settings.documentTitle || 'Planilla Oficial de Inspección y Despacho de Patio'}
                  </p>
                  {meta.location && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ubicación / Patio: <strong className="text-slate-800">{meta.location}</strong>
                    </p>
                  )}
                </div>

                {/* Right metadata box */}
                <div className="text-right text-xs">
                  <div className="bg-slate-100 rounded-md p-2.5 border border-slate-200 space-y-1">
                    <div>
                      <span className="text-slate-500">Fecha Emisión: </span>
                      <strong className="text-slate-900">{meta.date || new Date().toLocaleDateString()}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Hora: </span>
                      <strong className="text-slate-900">
                        {meta.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                    {meta.operator && (
                      <div>
                        <span className="text-slate-500">Auditor: </span>
                        <strong className="text-slate-900">{meta.operator}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Units & Summary KPI Banner (if showStats enabled) */}
              {settings.showStats && (
                <div className="my-4 grid grid-cols-3 gap-3">
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50/70">
                    <span className="block text-[11px] font-bold text-slate-500 uppercase">
                      Total Unidades (VINs)
                    </span>
                    <span className="text-2xl font-black text-slate-950">
                      {vehicles.length} <span className="text-xs font-normal text-slate-600">vehículos</span>
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50/70">
                    <span className="block text-[11px] font-bold text-slate-500 uppercase">
                      Marcas Presentes
                    </span>
                    <span className="text-sm font-bold text-slate-800 mt-1 line-clamp-1">
                      {uniqueMakes.length > 0 ? uniqueMakes.join(', ') : 'No especificadas'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50/70">
                    <span className="block text-[11px] font-bold text-slate-500 uppercase">
                      Estado de Inventario
                    </span>
                    <span className="text-sm font-bold text-emerald-700 mt-1 flex items-center gap-1">
                      <FileCheck className="w-4 h-4 text-emerald-600 inline" />
                      Listo para validación física
                    </span>
                  </div>
                </div>
              )}

              {/* Main Inventory Table: VIN without barcode */}
              <div className="border border-slate-300 rounded-md overflow-hidden mt-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-2.5 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">VIN / Número de Chasis</th>
                      {settings.showQrCode && (
                        <th className="py-2.5 px-2 text-center w-20">Código QR</th>
                      )}
                      <th className="py-2.5 px-3">Vehículo & Color</th>
                      <th className="py-2.5 px-2.5 w-24">Lote / Ubic.</th>
                      <th className="py-2.5 px-2.5 w-28">Estado</th>
                      <th className="py-2.5 px-3">Observaciones</th>
                      {settings.showCheckboxes && (
                        <th className="py-2.5 px-2 text-center w-14">Check</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {vehicles.length === 0 ? (
                      <tr>
                        <td
                          colSpan={settings.showQrCode ? (settings.showCheckboxes ? 8 : 7) : (settings.showCheckboxes ? 7 : 6)}
                          className="py-12 text-center text-slate-400"
                        >
                          <div className="font-semibold text-slate-600 text-sm">
                            Lista en blanco lista para nueva lectura
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Sube o pega tus capturas de pantalla para extraer los VINs automáticamente.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      vehicles.map((veh, index) => {
                        return (
                          <tr
                            key={veh.id}
                            className={`hover:bg-slate-50/80 ${
                              index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                            }`}
                          >
                            <td className="py-2.5 px-2.5 text-center font-bold text-slate-500 font-mono text-[11px]">
                              {String(index + 1).padStart(2, '0')}
                            </td>
                            {/* VIN display */}
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-950 text-xs sm:text-[13px]">
                              <span className="tracking-wider select-all">{veh.vin}</span>
                            </td>
                            {/* Optional QR Code */}
                            {settings.showQrCode && (
                              <td className="py-1 px-2 text-center">
                                <div className="flex justify-center items-center">
                                  <BarcodeRenderer value={veh.vin} type="qr" size={48} />
                                </div>
                              </td>
                            )}
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 text-xs">
                                {[veh.make, veh.model, veh.year].filter(Boolean).join(' ') ||
                                  'S/D'}
                              </div>
                              {veh.color && (
                                <div className="text-[11px] text-slate-500">{veh.color}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-2.5 text-slate-700 font-medium">
                              {veh.lot || '-'}
                            </td>
                            <td className="py-2.5 px-2.5">
                              <span className="text-[11px] font-semibold text-slate-800">
                                {veh.status || 'En patio'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-600 italic">
                              {veh.notes || '-'}
                            </td>
                            {settings.showCheckboxes && (
                              <td className="py-2.5 px-2 text-center">
                                <div className="w-5 h-5 mx-auto border-2 border-slate-600 rounded flex items-center justify-center font-bold text-slate-800">
                                  {veh.checked ? '✓' : ''}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Signatures & Certification Area */}
            <div className="pt-6 border-t-2 border-slate-900 mt-6">
              <div className="grid grid-cols-2 gap-12 text-xs">
                <div>
                  <div className="w-full border-b border-slate-900 pb-8 text-center text-slate-400">
                    Firma autorizada
                  </div>
                  <div className="pt-1.5 text-center">
                    <p className="font-bold text-slate-900 uppercase">
                      {settings.supervisorName || meta.operator || 'Auditor de Patio'}
                    </p>
                    <p className="text-[11px] text-slate-500">Responsable de Inventario / Despacho</p>
                  </div>
                </div>

                <div>
                  <div className="w-full border-b border-slate-900 pb-8 text-center text-slate-400">
                    Firma recepcionista
                  </div>
                  <div className="pt-1.5 text-center">
                    <p className="font-bold text-slate-900 uppercase">Seguridad / Transporte</p>
                    <p className="text-[11px] text-slate-500">C.I. / Identificación y Fecha</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-6">
                <span>AutoPrint VIN · Sistema Profesional de Inventario Automotriz</span>
                <span>Página 1 de 1</span>
                <span>Generado: {new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
