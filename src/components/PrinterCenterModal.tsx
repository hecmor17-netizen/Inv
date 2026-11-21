import React, { useState } from 'react';
import {
  Printer,
  Wifi,
  Bluetooth,
  FileText,
  Receipt,
  Download,
  Share2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Search,
  Send,
  Sliders,
} from 'lucide-react';
import { VehicleItem, InventoryMeta, PrintFormat, ThermalSettings, LetterSettings } from '../types';
import {
  buildEscPosCommands,
  buildThermalPlainText,
  printViaWebBluetooth,
} from '../utils/escpos';

interface PrinterCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: VehicleItem[];
  meta: InventoryMeta;
  activeFormat: PrintFormat;
  setActiveFormat: (format: PrintFormat) => void;
  thermalSettings: ThermalSettings;
  letterSettings: LetterSettings;
  onExecuteSystemPrint: (formatToPrint?: PrintFormat) => void;
}

export const PrinterCenterModal: React.FC<PrinterCenterModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  meta,
  activeFormat,
  setActiveFormat,
  thermalSettings,
  letterSettings,
  onExecuteSystemPrint,
}) => {
  const [activeTab, setActiveTab] = useState<'wifi' | 'bluetooth' | 'export'>('wifi');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanningBt, setIsScanningBt] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [networkIp, setNetworkIp] = useState('');

  if (!isOpen) return null;

  const hasWebBluetooth =
    typeof navigator !== 'undefined' && Boolean((navigator as any).bluetooth);

  // Trigger System / WiFi printer search dialog
  const handlePrintViaSystemWifi = () => {
    setStatusMessage('Abriendo administrador de impresoras del sistema (WiFi / Red local)...');
    setTimeout(() => {
      onClose();
      onExecuteSystemPrint(activeFormat);
    }, 250);
  };

  // Connect and print via Bluetooth
  const handlePrintViaBluetooth = async () => {
    setErrorMessage(null);
    setStatusMessage('Buscando impresoras Bluetooth cercanas...');
    setIsScanningBt(true);

    try {
      const escposData = buildEscPosCommands(vehicles, meta, thermalSettings);
      const res = await printViaWebBluetooth(escposData, (msg) => {
        setStatusMessage(msg);
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Error al conectar con la impresora Bluetooth.');
      } else {
        setStatusMessage('¡Transmisión Bluetooth completada con éxito!');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error durante la conexión Bluetooth.');
    } finally {
      setIsScanningBt(false);
    }
  };

  const handleCopyRawThermal = () => {
    const raw = buildThermalPlainText(vehicles, meta, thermalSettings);
    navigator.clipboard.writeText(raw);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2500);
  };

  // WhatsApp formatted share
  const handleShareWhatsApp = () => {
    const lines = [
      `🚗 *INVENTARIO DE VEHÍCULOS (FORMATO ${activeFormat === 'letter' ? 'CARTA' : '58MM'})*`,
      `📅 Fecha: ${meta.date || new Date().toLocaleDateString()} | ⏰ Hora: ${meta.time || ''}`,
      `📍 Patio/Ubicación: ${meta.location || 'General'}`,
      `👤 Auditor: ${meta.operator || 'Auditor'}`,
      `📊 *Total Unidades: ${vehicles.length} vehículos*`,
      `---------------------------------`,
      ...vehicles.map((v, i) => {
        const details = [v.make, v.model, v.year].filter(Boolean).join(' ');
        const lotInfo = v.lot ? ` (Lote: ${v.lot})` : '';
        return `${String(i + 1).padStart(2, '0')}. \`${v.vin}\` ${details}${lotInfo}`;
      }),
      `---------------------------------`,
      `_Reporte generado por AutoPrint VIN_`,
    ];
    const encoded = encodeURIComponent(lines.join('\n'));
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Download CSV
  const handleDownloadCSV = () => {
    const headers = ['No', 'VIN', 'Marca', 'Modelo', 'Año', 'Color', 'Lote', 'Estado', 'Notas'];
    const rows = vehicles.map((v, i) => [
      i + 1,
      `"${v.vin}"`,
      `"${v.make || ''}"`,
      `"${v.model || ''}"`,
      `"${v.year || ''}"`,
      `"${v.color || ''}"`,
      `"${v.lot || ''}"`,
      `"${v.status || ''}"`,
      `"${v.notes || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario-vins-${meta.date || 'hoy'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-700 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="btn-3d w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-indigo-300 border-b-[4px] border-b-indigo-950">
              <Printer className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-white text-base sm:text-lg">
                Centro de Impresión y Conexión
              </h3>
              <p className="text-xs text-slate-300 font-semibold">
                Búsqueda de impresoras WiFi de red y Bluetooth portátiles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white text-2xl font-black transition-colors cursor-pointer border border-slate-700"
          >
            ×
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="px-5 py-3 bg-slate-950 border-b-2 border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <span className="font-black text-slate-300 text-xs uppercase tracking-wide">
            Formato de Impresión Activo:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFormat('letter')}
              className={`btn-3d flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeFormat === 'letter'
                  ? 'bg-blue-600 text-white border border-blue-300 border-b-2 border-b-blue-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-cyan-300" />
              <span>Carta</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFormat('thermal58')}
              className={`btn-3d flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeFormat === 'thermal58'
                  ? 'bg-indigo-600 text-white border border-indigo-300 border-b-2 border-b-indigo-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-amber-300" />
              <span>58mm Térmica</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (WiFi vs Bluetooth vs Exportar) */}
        <div className="grid grid-cols-3 border-b-2 border-slate-800 text-xs font-black bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('wifi')}
            className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-3 transition-all cursor-pointer ${
              activeTab === 'wifi'
                ? 'border-blue-400 text-white bg-blue-950/60 font-black'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <Wifi className="w-4 h-4 text-blue-400" />
            <span>WiFi / Sistema</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bluetooth')}
            className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-3 transition-all cursor-pointer ${
              activeTab === 'bluetooth'
                ? 'border-indigo-400 text-white bg-indigo-950/60 font-black'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <Bluetooth className="w-4 h-4 text-indigo-400" />
            <span>Bluetooth 58mm</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-3 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-400 text-white bg-emerald-950/60 font-black'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Exportar Carta</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-200">
          {/* TAB 1: WIFI / SISTEMA / RED LOCAL */}
          {activeTab === 'wifi' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-950/60 border-2 border-blue-600/80 space-y-2">
                <div className="flex items-center gap-2 text-white font-black text-sm">
                  <Wifi className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>Impresoras Conectadas por WiFi o Red Local</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                  Al pulsar el botón, el sistema escaneará y mostrará las impresoras configuradas en tu red WiFi local (HP, Epson, Canon, Brother, Kyocera, Ricoh, AirPrint o impresoras térmicas de red) en el formato seleccionado (
                  <strong className="text-white">
                    {activeFormat === 'letter' ? 'Formato Carta 8.5" × 11"' : 'Térmica 58mm'}
                  </strong>
                  ).
                </p>
              </div>

              {/* Summary box */}
              <div className="p-3.5 rounded-2xl border-2 border-slate-700 bg-slate-950 space-y-2">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold">Vehículos en el documento:</span>
                  <span className="font-black text-white font-mono text-sm">{vehicles.length} unidades</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold">Modo de papel configurado:</span>
                  <span className="font-black text-indigo-300">
                    {activeFormat === 'letter' ? 'Carta (8.5 × 11 pulg.)' : 'Rollo 58mm continuo'}
                  </span>
                </div>
              </div>

              {/* Main Action Button */}
              <button
                type="button"
                onClick={handlePrintViaSystemWifi}
                className="btn-3d w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base border-2 border-blue-300 border-b-[5px] border-b-blue-950 shadow-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer text-center"
              >
                <Search className="w-5 h-5 text-cyan-300" />
                <span>
                  Buscar Impresoras WiFi e Imprimir ({activeFormat === 'letter' ? 'Carta' : '58mm'})
                </span>
              </button>
            </div>
          )}

          {/* TAB 2: BLUETOOTH ESC/POS */}
          {activeTab === 'bluetooth' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-950/60 border-2 border-indigo-600/80 space-y-2">
                <div className="flex items-center gap-2 text-white font-black text-sm">
                  <Bluetooth className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Impresoras Térmicas Portátiles Bluetooth (58mm)</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                  Conexión directa inalámbrica ESC/POS para mini impresoras de bolsillo (POS-5802, GOOJPRT PT-210, MPT-II, Rongta, etc.).
                </p>
              </div>

              {!hasWebBluetooth ? (
                <div className="p-3.5 rounded-2xl bg-amber-950/70 border-2 border-amber-600 text-amber-200 text-xs space-y-2">
                  <div className="font-black flex items-center gap-2 text-sm text-amber-300">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Navegador sin Web Bluetooth directo</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Para emparejar directamente por Bluetooth usa <strong>Google Chrome o Edge</strong> en PC o Android.
                  </p>
                  <p className="text-xs pt-1 border-t border-amber-800">
                    Alternativa recomendada: Usa la pestaña <strong>WiFi / Sistema</strong> o copia el texto plano abajo para la app <strong>RawBT</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={isScanningBt || vehicles.length === 0}
                    onClick={handlePrintViaBluetooth}
                    className="btn-3d w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm sm:text-base border-2 border-indigo-300 border-b-[5px] border-b-indigo-950 shadow-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 text-center"
                  >
                    {isScanningBt ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Buscando y transmitiendo a impresora...</span>
                      </>
                    ) : (
                      <>
                        <Bluetooth className="w-5 h-5 text-amber-300" />
                        <span>Escanear y Enviar a Impresora Bluetooth (58mm)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Status and feedback */}
              {statusMessage && (
                <div className="p-3 rounded-xl bg-blue-950/80 border-2 border-blue-600 text-blue-200 flex items-start gap-2.5 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span className="flex-1">{statusMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/80 border-2 border-rose-600 text-rose-200 flex items-start gap-2.5 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
              )}

              {/* Copy plain raw text for RawBT app */}
              <div className="pt-3 border-t-2 border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">¿Usas app móvil RawBT / ESC POS?</span>
                <button
                  type="button"
                  onClick={handleCopyRawThermal}
                  className="btn-3d flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-300 hover:text-white font-black border border-slate-650 cursor-pointer"
                >
                  {copiedRaw ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Texto ESC/POS</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EXPORTAR CARTA (PDF / WHATSAPP / CSV) */}
          {activeTab === 'export' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300 font-semibold">
                Opciones para enviar y compartir el archivo de inventario en formato oficial Carta (con VIN claro y códigos QR):
              </p>

              {/* Option: Imprimir / Guardar en PDF Carta */}
              <button
                type="button"
                onClick={() => {
                  setActiveFormat('letter');
                  handlePrintViaSystemWifi();
                }}
                className="btn-3d w-full p-4 rounded-2xl border-2 border-slate-650 border-b-[4px] border-b-slate-950 bg-slate-950 hover:bg-slate-800 text-white transition-all flex items-center justify-between text-left shadow-lg cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-500 text-blue-300 flex items-center justify-center shrink-0">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-sm text-white">
                      Imprimir / Guardar en PDF (Formato Carta)
                    </p>
                    <p className="text-xs text-slate-300 font-semibold">
                      Envía directo al visor del sistema en tamaño carta oficial
                    </p>
                  </div>
                </div>
              </button>

              {/* Option: WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="btn-3d w-full p-4 rounded-2xl border-2 border-emerald-600/80 border-b-[4px] border-b-slate-950 bg-slate-950 hover:bg-slate-800 text-white transition-all flex items-center justify-between text-left shadow-lg cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-sm text-white">
                      Enviar Listado por WhatsApp
                    </p>
                    <p className="text-xs text-slate-300 font-semibold">
                      Mensaje estructurado con los VINs para chofer o encargado
                    </p>
                  </div>
                </div>
              </button>

              {/* Option: CSV */}
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="btn-3d w-full p-4 rounded-2xl border-2 border-teal-600/80 border-b-[4px] border-b-slate-950 bg-slate-950 hover:bg-slate-800 text-white transition-all flex items-center justify-between text-left shadow-lg cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-500 text-teal-300 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-sm text-white">
                      Descargar Hoja Excel / CSV
                    </p>
                    <p className="text-xs text-slate-300 font-semibold">
                      Archivo de datos con VIN, marca, modelo y estado
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t-2 border-slate-800 flex items-center justify-between bg-slate-950">
          <span className="text-xs text-slate-300 font-mono font-bold">
            {vehicles.length} vehículos cargados
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-3d px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
