import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Zap,
  Minimize2,
  List,
  Scissors,
  CheckSquare,
  QrCode,
} from 'lucide-react';
import {
  VehicleItem,
  InventoryMeta,
  ThermalSettings,
  ThermalFontSize,
  ThermalDensity,
  BarcodeType,
} from '../types';
import { BarcodeRenderer } from './BarcodeRenderer';

interface Thermal58PreviewProps {
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  settings: ThermalSettings;
  onUpdateSettings: (newSettings: Partial<ThermalSettings>) => void;
}

export const Thermal58Preview: React.FC<Thermal58PreviewProps> = ({
  vehicles,
  meta,
  settings,
  onUpdateSettings,
}) => {
  const [zoom, setZoom] = useState(100);

  const isUltra = settings.density === 'ultra';
  const isCompact = settings.density === 'compact';

  // Determine font and spacing classes based on user setting
  const getStyleConfigs = () => {
    switch (settings.density) {
      case 'ultra':
        return {
          title: 'text-[11px] font-black',
          vin: 'text-[10px] font-bold tracking-tight',
          subtext: 'text-[8px] text-slate-800 leading-tight',
          itemPadding: 'py-0.5',
          headerPadding: 'pb-1 pt-0.5',
          footerPadding: 'pt-1.5',
        };
      case 'compact':
        return {
          title: 'text-[12px] font-black',
          vin: 'text-[10.5px] font-bold tracking-normal',
          subtext: 'text-[8.5px] text-slate-800 leading-tight',
          itemPadding: 'py-1',
          headerPadding: 'pb-1.5 pt-1',
          footerPadding: 'pt-2',
        };
      case 'normal':
      default:
        return {
          title: 'text-[13px] font-black',
          vin: 'text-[11.5px] font-bold tracking-wider',
          subtext: 'text-[9.5px] text-slate-800 leading-normal',
          itemPadding: 'py-1.5',
          headerPadding: 'pb-2 pt-1',
          footerPadding: 'pt-3',
        };
    }
  };

  const styleConfig = getStyleConfigs();

  // Approximate paper length estimate based on vehicles and settings
  const estimatePaperLengthCm = () => {
    if (vehicles.length === 0) return 4;
    let baseCm = isUltra ? 2.5 : isCompact ? 3.5 : 5.5;
    const perVehicleCm =
      (isUltra ? 0.6 : isCompact ? 1.0 : 1.6) +
      (settings.barcodeType === 'code128' ? 0.9 : settings.barcodeType === 'qr' ? 1.2 : 0);
    return Math.round(baseCm + vehicles.length * perVehicleCm);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Controls Toolbar: Density, Font & Spacing */}
      <div className="no-print bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-3 space-y-2 text-xs text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Spacing / Density Mode: Solves the long receipt issue */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-700 text-xs flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5 text-[#185abd]" />
              Espaciado (Largo de papel):
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  density: 'ultra',
                  showDividers: false,
                  barcodeType: 'none',
                })
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                isUltra
                  ? 'bg-[#185abd] text-white font-semibold shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
              title="Formato más corto: 1-2 líneas por auto, sin códigos enormes"
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Ahorro Máximo (Ultra)</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ density: 'compact' })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                isCompact
                  ? 'bg-[#185abd] text-white font-semibold shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              <Minimize2 className="w-3 h-3" />
              <span>Compacto</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ density: 'normal' })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                settings.density === 'normal'
                  ? 'bg-[#185abd] text-white font-semibold shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              <List className="w-3 h-3" />
              <span>Detallado</span>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(70, z - 15))}
              className="p-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 cursor-pointer shadow-2xs"
              title="Reducir vista"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-600 w-9 text-center font-medium">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(160, z + 15))}
              className="p-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 cursor-pointer shadow-2xs"
              title="Aumentar vista"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="p-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 cursor-pointer shadow-2xs"
              title="Reiniciar zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Secondary options row: Barcodes & Dividers */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-slate-500 text-xs">Códigos:</span>
            <button
              type="button"
              onClick={() => onUpdateSettings({ barcodeType: 'none' })}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                settings.barcodeType === 'none'
                  ? 'bg-[#185abd] text-white font-semibold shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              Sin código
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ barcodeType: 'qr' })}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                settings.barcodeType === 'qr'
                  ? 'bg-[#185abd] text-white font-semibold shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              <QrCode className="w-3 h-3 text-current" />
              <span>Ver Códigos QR</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ barcodeType: 'code128' })}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                settings.barcodeType === 'code128'
                  ? 'bg-[#185abd] text-white font-semibold shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              Barras 1D
            </button>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 ml-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={settings.showDividers}
                onChange={(e) => onUpdateSettings({ showDividers: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Líneas separadoras</span>
            </label>
          </div>

          {/* Paper Length Badge */}
          <div className="text-xs font-mono text-[#185abd] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md font-medium">
            Largo estimado: ~{estimatePaperLengthCm()} cm
          </div>
        </div>
      </div>

      {/* Realistic Receipt Canvas Area */}
      <div className="flex-1 bg-slate-200/70 rounded-xl p-3 sm:p-5 overflow-auto flex justify-center items-start min-h-[480px]">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          className="transition-transform duration-150"
        >
          {/* 58mm Thermal Tape Mockup */}
          <div
            id="print-thermal-container"
            className="w-[230px] bg-white text-black shadow-xl border border-slate-300 font-mono text-left select-text relative pb-6 pt-3 px-3 rounded-t-sm"
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              color: '#000000',
              lineHeight: isUltra ? 1.15 : 1.25,
            }}
          >
            {/* Top Paper Tear Line */}
            <div className="no-print absolute top-0 left-0 right-0 h-1 bg-slate-300/40" />

            {/* HEADER */}
            {isUltra ? (
              // ULTRA COMPACT HEADER
              <div className={`${styleConfig.headerPadding} border-b border-black text-center`}>
                <div className="flex justify-between items-center text-[10px] font-black uppercase">
                  <span>INVENTARIO VIN</span>
                  <span className="border border-black px-1.5 py-0.2 rounded text-[9px] font-black">
                    {vehicles.length} AUTOS
                  </span>
                </div>
                <div className="flex justify-between text-[8px] text-slate-700 mt-0.5">
                  <span>{meta.date || new Date().toLocaleDateString()}</span>
                  <span>{meta.time || ''}</span>
                  {meta.location && (
                    <span className="truncate max-w-[80px] font-bold">{meta.location}</span>
                  )}
                </div>
              </div>
            ) : (
              // COMPACT / NORMAL HEADER
              <div className={`${styleConfig.headerPadding} text-center border-b-2 border-dashed border-black`}>
                <div className="text-[9px] tracking-widest uppercase font-bold text-slate-700">
                  CONTROL DE PATIO
                </div>
                <h2 className={`${styleConfig.title} uppercase tracking-tight`}>
                  INVENTARIO VIN
                </h2>
                {settings.customHeader && (
                  <div className="text-[8.5px] font-bold uppercase mt-0.5">
                    {settings.customHeader}
                  </div>
                )}
                <div className="pt-1 mt-1 border-t border-black text-[8.5px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>FECHA/HORA:</span>
                    <span className="font-bold">
                      {meta.date || ''} {meta.time || ''}
                    </span>
                  </div>
                  {meta.location && (
                    <div className="flex justify-between">
                      <span>PATIO:</span>
                      <span className="font-bold truncate max-w-[130px]">{meta.location}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-[10px] pt-0.5 border-t border-dotted border-black">
                    <span>TOTAL UNIDADES:</span>
                    <span>{vehicles.length} VEHICULOS</span>
                  </div>
                </div>
              </div>
            )}

            {/* VEHICLE LIST */}
            <div className="py-1">
              {vehicles.length === 0 ? (
                <div className="text-center py-4 text-[9px] text-slate-500 italic space-y-0.5">
                  <div>[LISTA EN BLANCO]</div>
                  <div className="text-[7.5px] text-slate-400">ESPERANDO CAPTURA DE PANTALLA</div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {vehicles.map((veh, index) => {
                    const num = String(index + 1).padStart(2, '0');
                    return (
                      <div
                        key={veh.id}
                        className={`${styleConfig.itemPadding} ${
                          settings.showDividers ? 'border-b border-dashed border-black/40' : ''
                        }`}
                      >
                        {/* Primary VIN line */}
                        <div className="flex items-baseline justify-between">
                          <span className="font-black text-[9px] mr-1 text-slate-800">
                            {num}.
                          </span>
                          <span className={`${styleConfig.vin} flex-1 font-black truncate`}>
                            {veh.vin}
                          </span>
                          {settings.showCheckboxes && (
                            <span className="text-[8px] font-bold ml-1">[ ]</span>
                          )}
                        </div>

                        {/* Vehicle details on tight single line */}
                        {settings.showDetails && (
                          <div className={`${styleConfig.subtext} pl-4 flex items-center justify-between`}>
                            <span className="truncate font-semibold max-w-[140px]">
                              {[veh.make, veh.model, veh.year].filter(Boolean).join(' ') ||
                                'Vehículo S/D'}
                            </span>
                            {veh.lot && settings.showLot && (
                              <span className="font-black shrink-0 ml-1">L:{veh.lot}</span>
                            )}
                          </div>
                        )}

                        {/* Additional row only if not ultra and has color/notes */}
                        {!isUltra && (veh.color || veh.status) && (
                          <div className="pl-4 text-[7.5px] text-slate-600 flex justify-between">
                            <span>{veh.color}</span>
                            <span>{veh.status}</span>
                          </div>
                        )}

                        {/* Barcode / QR Code (height is reduced if barcode enabled) */}
                        {settings.barcodeType !== 'none' && (
                          <div className="py-0.5">
                            <BarcodeRenderer
                              value={veh.vin}
                              type={settings.barcodeType}
                              height={isUltra ? 20 : 26}
                              isThermal={true}
                              displayValue={false}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FOOTER */}
            {isUltra ? (
              // ULTRA COMPACT FOOTER
              <div className={`${styleConfig.footerPadding} border-t border-black text-[8.5px] space-y-1`}>
                <div className="flex justify-between font-black text-[9.5px]">
                  <span>TOTAL:</span>
                  <span>{vehicles.length} AUTOS</span>
                </div>
                <div className="pt-2 text-center text-[7.5px]">
                  <div className="w-full border-b border-black mb-0.5" />
                  <span>FIRMA CONTROL: ________________</span>
                </div>
              </div>
            ) : (
              // COMPACT / NORMAL FOOTER
              <div className={`${styleConfig.footerPadding} border-t-2 border-black space-y-1.5 text-[8.5px]`}>
                <div className="flex justify-between font-black text-[10px]">
                  <span>TOTAL CONTADO:</span>
                  <span>{vehicles.length} VEHICULOS</span>
                </div>

                {settings.customFooter && (
                  <div className="text-center font-bold text-[8px] uppercase">
                    {settings.customFooter}
                  </div>
                )}

                <div className="pt-3 text-center">
                  <div className="w-full border-b border-black mb-1" />
                  <div className="text-[7.5px] uppercase font-bold">
                    FIRMA RESPONSABLE DE PATIO
                  </div>
                </div>

                <div className="text-center text-[7px] tracking-widest pt-1 uppercase text-slate-600">
                  *** FIN DE REPORTE ***
                </div>
              </div>
            )}

            {/* Bottom Paper Serration Zig-Zag effect */}
            <div
              className="no-print absolute -bottom-2 left-0 right-0 h-2 bg-slate-200/70"
              style={{
                backgroundImage:
                  'radial-gradient(circle, transparent 50%, #ffffff 50%)',
                backgroundSize: '8px 8px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Spacing advice banner */}
      <div className="no-print mt-2.5 px-3 py-2 rounded border border-slate-200 bg-white flex items-center justify-between text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[#185ABD] shrink-0" />
          <span>
            <strong>Ahorro de papel activo:</strong> Densidad{' '}
            <strong>{isUltra ? 'Ultra' : isCompact ? 'Compacta' : 'Detallada'}</strong> configurada para rollo térmico de 58mm.
          </span>
        </div>
      </div>
    </div>
  );
};
