import React, { useState } from 'react';
import {
  Scan,
  Printer,
  Send,
  Plus,
  Trash2,
  QrCode,
  FileSpreadsheet,
  SlidersHorizontal,
} from 'lucide-react';
import { ScanOptionsModal } from './components/ScanOptionsModal';
import { PrintOptionsModal } from './components/PrintOptionsModal';
import { ShareModal } from './components/ShareModal';
import { InventoryEditor } from './components/InventoryEditor';
import { Thermal58Preview } from './components/Thermal58Preview';
import { LetterPreview } from './components/LetterPreview';
import { BarcodeRenderer } from './components/BarcodeRenderer';
import {
  VehicleItem,
  PrintFormat,
  ThermalSettings,
  LetterSettings,
  InventoryMeta,
} from './types';
import { generateVisualPdf } from './utils/exportUtils';
import { buildThermalPlainText } from './utils/escpos';

type WorkspaceTab = 'sheet' | 'thermal' | 'letter';

export default function App() {
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('sheet');
  const [showDocProperties, setShowDocProperties] = useState(false);

  // Modals
  const [activeModal, setActiveModal] = useState<'scan' | 'print' | 'share' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [showQRCodes, setShowQRCodes] = useState(false);

  // Print format
  const [activeFormat, setActiveFormat] = useState<PrintFormat>('thermal58');

  // Document metadata
  const now = new Date();
  const [meta, setMeta] = useState<InventoryMeta>({
    title: 'Inventario de Unidades VIN',
    date: now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    location: 'Patio Central de Distribución',
    operator: 'Inspector de Patio',
    notes: 'Control y cotejo de vehículos.',
  });

  // Thermal 58mm settings
  const [thermalSettings, setThermalSettings] = useState<ThermalSettings>({
    fontSize: 'normal',
    density: 'ultra',
    barcodeType: 'none',
    showDetails: true,
    showLot: true,
    showCheckboxes: true,
    showDividers: false,
    paperWidthMm: 58,
    customHeader: 'LOGÍSTICA & PATIO AUTOMOTRIZ',
    customFooter: 'VÁLIDO PARA CONTROL DE SALIDA',
    showTimestamp: true,
  });

  // Letter settings
  const [letterSettings, setLetterSettings] = useState<LetterSettings>({
    companyName: 'LOGÍSTICA & DESPACHO AUTOMOTRIZ S.A.',
    yardName: 'Patio Principal de Vehículos',
    documentTitle: 'Planilla Oficial de Inspección y Despacho de Patio',
    supervisorName: 'Auditor de Patio',
    showCheckboxes: true,
    showStats: true,
    notes: '',
    columnsPerPage: 1,
    showQrCode: true,
  });

  // Printing state
  const [isSharingToPrinter, setIsSharingToPrinter] = useState(false);
  const [printerFeedback, setPrinterFeedback] = useState<string | null>(null);
  const [printTargetFormat, setPrintTargetFormat] = useState<PrintFormat>('thermal58');

  const handleShareToPrinter = async (overrideFormat?: PrintFormat) => {
    const targetFormat = overrideFormat || activeFormat;
    if (vehicles.length === 0) {
      setPrinterFeedback('Lista vacía: escanea o agrega vehículos antes de imprimir.');
      setTimeout(() => setPrinterFeedback(null), 3500);
      return;
    }

    setIsSharingToPrinter(true);
    setPrinterFeedback('Preparando documento para impresión...');

    try {
      const context = { vehicles, meta, letterSettings, thermalSettings };
      const { blob, fileName } = await generateVisualPdf(
        targetFormat,
        meta.title || 'Inventario',
        context
      );

      setPrintTargetFormat(targetFormat);
      const printClass = targetFormat === 'thermal58' ? 'print-mode-thermal' : 'print-mode-letter';
      document.body.classList.remove('print-mode-thermal', 'print-mode-letter');
      document.body.classList.add(printClass);

      const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

      if (
        typeof navigator !== 'undefined' &&
        typeof (navigator as any).canShare === 'function' &&
        (navigator as any).canShare({ files: [pdfFile] })
      ) {
        setPrinterFeedback('Abriendo selector de impresoras...');
        await navigator.share({
          files: [pdfFile],
          title: 'Imprimir Inventario',
          text: `Documento para imprimir (${targetFormat === 'thermal58' ? '58mm Térmica' : 'Carta'})`,
        });
        setPrinterFeedback('Documento enviado a la impresora.');
        setTimeout(() => setPrinterFeedback(null), 3500);
        return;
      }

      if (
        targetFormat === 'thermal58' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function'
      ) {
        const thermalText = buildThermalPlainText(vehicles, meta, thermalSettings);
        setPrinterFeedback('Enviando a impresora térmica...');
        await navigator.share({
          title: 'Imprimir Ticket 58mm',
          text: thermalText,
        });
        setPrinterFeedback('Enviado a la impresora.');
        setTimeout(() => setPrinterFeedback(null), 3500);
        return;
      }

      setPrinterFeedback('Abriendo diálogo de impresión...');
      setTimeout(() => {
        window.print();
        setPrinterFeedback('Impresora lista.');
        setTimeout(() => setPrinterFeedback(null), 3500);
      }, 150);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setPrinterFeedback(null);
        return;
      }
      console.warn('Share to printer:', err);
      try {
        setPrintTargetFormat(targetFormat);
        window.print();
      } catch (e) {
        console.error('Error al imprimir:', e);
      }
    } finally {
      setIsSharingToPrinter(false);
    }
  };

  const handleAddVehicle = (newVeh: VehicleItem) => {
    setVehicles((prev) => [newVeh, ...prev]);
  };

  const handleOpenClearConfirm = () => {
    if (vehicles.length === 0) return;
    setIsClearConfirmOpen(true);
  };

  const handleConfirmClear = () => {
    setVehicles([]);
    const rightNow = new Date();
    setMeta((prev) => ({
      ...prev,
      date: rightNow.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: rightNow.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    }));
    setIsClearConfirmOpen(false);
  };

  const handleVehiclesExtracted = (
    extracted: VehicleItem[],
    title?: string,
    _summary?: string,
    append: boolean = false
  ) => {
    if (append) {
      setVehicles((prev) => {
        const existingVins = new Set(prev.map((v) => v.vin.toUpperCase()));
        const newItems = extracted.filter((v) => !existingVins.has(v.vin.toUpperCase()));
        return [...prev, ...newItems];
      });
    } else {
      setVehicles(extracted);
    }
    if (title) {
      setMeta((prev) => ({ ...prev, title }));
    }
  };

  return (
    <>
      {/* Interactive Screen UI */}
      <div
        id="app-screen-root"
        className="print:hidden min-h-screen bg-[#F3F2F1] text-slate-900 flex flex-col font-sans selection:bg-[#185ABD] selection:text-white"
      >
        {/* Top Bar (Strict 3-zone Office Header) */}
        <header className="bg-[#185ABD] text-white border-b border-[#104A9B]">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-13 flex items-center justify-between gap-8">
            {/* Zone 1: Single-line Brand Title */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('sheet');
              }}
              className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-5 h-5 shrink-0" />
              <span>AutoPrint VIN</span>
            </a>

            {/* Zone 2: Concise single-line navigation links */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-blue-100">
              <button
                type="button"
                onClick={() => setActiveTab('sheet')}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  activeTab === 'sheet'
                    ? 'text-white border-white font-semibold'
                    : 'border-transparent hover:text-white'
                }`}
              >
                Planilla VIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFormat('thermal58');
                  setActiveTab('thermal');
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  activeTab === 'thermal'
                    ? 'text-white border-white font-semibold'
                    : 'border-transparent hover:text-white'
                }`}
              >
                Ticket 58mm
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFormat('letter');
                  setActiveTab('letter');
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  activeTab === 'letter'
                    ? 'text-white border-white font-semibold'
                    : 'border-transparent hover:text-white'
                }`}
              >
                Hoja Carta
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('sheet');
                  setShowDocProperties((prev) => !prev);
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  showDocProperties && activeTab === 'sheet'
                    ? 'text-white border-white font-semibold'
                    : 'border-transparent hover:text-white'
                }`}
              >
                Datos del Patio
              </button>
            </nav>

            {/* Zone 3: 1 primary CTA */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal('scan')}
                className="px-3.5 py-1.5 rounded bg-white text-[#185ABD] hover:bg-blue-50 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                Escanear VINs
              </button>
            </div>
          </div>
        </header>

        {/* Office Command Ribbon / Toolbar */}
        <div className="bg-white border-b border-slate-300">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Primary Office Action Group: Escanear, Imprimir, Enviar */}
              <button
                type="button"
                onClick={() => setActiveModal('scan')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#185ABD] hover:bg-[#104A9B] text-white text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <Scan className="w-4 h-4 shrink-0" />
                <span>Escanear</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('print')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4 text-slate-700 shrink-0" />
                <span>Imprimir</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('share')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-4 h-4 text-[#107C41] shrink-0" />
                <span>Enviar</span>
              </button>

              <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1" aria-hidden="true" />

              {/* Secondary Sheet Tools */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('sheet');
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Agregar Manual</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('sheet');
                  setShowQRCodes((q) => !q);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded border text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  showQRCodes
                    ? 'bg-[#EFF6FC] border-[#185ABD] text-[#185ABD] font-semibold'
                    : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                <span>Códigos QR</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDocProperties((prev) => !prev)}
                className={`md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded border text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  showDocProperties
                    ? 'bg-[#EFF6FC] border-[#185ABD] text-[#185ABD]'
                    : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>Patio</span>
              </button>

              <button
                type="button"
                onClick={handleOpenClearConfirm}
                disabled={vehicles.length === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  vehicles.length > 0
                    ? 'bg-white hover:bg-rose-50 border-rose-300 text-rose-700 cursor-pointer'
                    : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title="Vaciar lista completa de vehículos"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Vaciar Lista</span>
              </button>
            </div>

            {/* Clean Unboxed Document Status Metadata */}
            <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
              <span className="font-semibold text-slate-900">
                {vehicles.length} {vehicles.length === 1 ? 'vehículo' : 'vehículos'}
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="truncate max-w-[180px]">{meta.location}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>{meta.date}</span>
            </div>
          </div>

          {/* Mobile View Switcher Tabs */}
          <div className="md:hidden px-4 pb-2 flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('sheet')}
              className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap shrink-0 ${
                activeTab === 'sheet' ? 'bg-[#EFF6FC] text-[#185ABD]' : 'text-slate-600'
              }`}
            >
              Planilla VIN
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFormat('thermal58');
                setActiveTab('thermal');
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap shrink-0 ${
                activeTab === 'thermal' ? 'bg-[#EFF6FC] text-[#185ABD]' : 'text-slate-600'
              }`}
            >
              Ticket 58mm
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFormat('letter');
                setActiveTab('letter');
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap shrink-0 ${
                activeTab === 'letter' ? 'bg-[#EFF6FC] text-[#185ABD]' : 'text-slate-600'
              }`}
            >
              Hoja Carta
            </button>
          </div>
        </div>

        {/* Main Workspace Canvas */}
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 w-full flex-1 flex flex-col gap-4">
          {/* Document Header / Properties Bar (Editable Office Fields) */}
          {showDocProperties && activeTab === 'sheet' && (
            <section className="bg-white rounded-md border border-slate-300 p-4">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <h2 className="text-xs font-semibold text-slate-900">
                  Propiedades del Documento y Encabezado de Impresión
                </h2>
                <button
                  type="button"
                  onClick={() => setShowDocProperties(false)}
                  className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Ocultar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Título del Inventario
                  </label>
                  <input
                    type="text"
                    value={meta.title}
                    onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Patio / Ubicación
                  </label>
                  <input
                    type="text"
                    value={meta.location}
                    onChange={(e) => setMeta({ ...meta, location: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Inspector / Auditor
                  </label>
                  <input
                    type="text"
                    value={meta.operator}
                    onChange={(e) => setMeta({ ...meta, operator: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Fecha
                    </label>
                    <input
                      type="text"
                      value={meta.date}
                      onChange={(e) => setMeta({ ...meta, date: e.target.value })}
                      className="w-full text-xs tabular-nums px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Hora
                    </label>
                    <input
                      type="text"
                      value={meta.time}
                      onChange={(e) => setMeta({ ...meta, time: e.target.value })}
                      className="w-full text-xs tabular-nums px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Active Workspace View */}
          {activeTab === 'sheet' && (
            <section className="flex-1 flex flex-col">
              <InventoryEditor
                vehicles={vehicles}
                setVehicles={setVehicles}
                onAddVehicle={handleAddVehicle}
                onNewCapture={() => setActiveModal('scan')}
                showQRCodes={showQRCodes}
                showAddModal={showAddModal}
                setShowAddModal={setShowAddModal}
              />
            </section>
          )}

          {activeTab === 'thermal' && (
            <section className="bg-white rounded-md border border-slate-300 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Vista Previa: Ticket Térmico 58mm
                  </h2>
                  <p className="text-xs text-slate-500">
                    Configura densidad de papel y códigos antes de imprimir o compartir
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleShareToPrinter('thermal58')}
                  disabled={vehicles.length === 0 || isSharingToPrinter}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#185ABD] hover:bg-[#104A9B] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isSharingToPrinter ? 'Enviando...' : 'Imprimir Ticket 58mm'}</span>
                </button>
              </div>
              <div className="max-w-lg mx-auto">
                <Thermal58Preview
                  vehicles={vehicles}
                  meta={meta}
                  settings={thermalSettings}
                  onUpdateSettings={(newStg) =>
                    setThermalSettings((prev) => ({ ...prev, ...newStg }))
                  }
                />
              </div>
            </section>
          )}

          {activeTab === 'letter' && (
            <section className="bg-white rounded-md border border-slate-300 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Vista Previa: Planilla Oficial Hoja Carta (8.5×11&quot;)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Planilla de auditoría física con códigos QR y bloques de firma
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleShareToPrinter('letter')}
                  disabled={vehicles.length === 0 || isSharingToPrinter}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#185ABD] hover:bg-[#104A9B] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isSharingToPrinter ? 'Enviando...' : 'Imprimir Hoja Carta'}</span>
                </button>
              </div>
              <LetterPreview
                vehicles={vehicles}
                meta={meta}
                settings={letterSettings}
                onUpdateSettings={(newStg) =>
                  setLetterSettings((prev) => ({ ...prev, ...newStg }))
                }
                onPrintCarta={() => handleShareToPrinter('letter')}
              />
            </section>
          )}
        </main>

        {/* Modals */}
        <ScanOptionsModal
          isOpen={activeModal === 'scan'}
          onClose={() => setActiveModal(null)}
          onVehiclesExtracted={handleVehiclesExtracted}
          existingCount={vehicles.length}
        />

        <PrintOptionsModal
          isOpen={activeModal === 'print'}
          onClose={() => setActiveModal(null)}
          vehicles={vehicles}
          meta={meta}
          activeFormat={activeFormat}
          setActiveFormat={setActiveFormat}
          thermalSettings={thermalSettings}
          setThermalSettings={setThermalSettings}
          letterSettings={letterSettings}
          setLetterSettings={setLetterSettings}
          onPrint={() => handleShareToPrinter()}
          isPrinting={isSharingToPrinter}
          printerFeedback={printerFeedback}
        />

        <ShareModal
          isOpen={activeModal === 'share'}
          onClose={() => setActiveModal(null)}
          vehicles={vehicles}
          meta={meta}
          activeFormat={activeFormat}
          letterSettings={letterSettings}
          thermalSettings={thermalSettings}
        />

        {/* Clear List Confirmation Dialog */}
        {isClearConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-fadeIn">
            <div className="bg-white rounded-lg shadow-xl border border-slate-300 max-w-sm w-full p-6 text-center">
              <div className="w-11 h-11 rounded-md bg-rose-50 text-rose-700 flex items-center justify-center mx-auto mb-3 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-slate-900 text-base">
                ¿Vaciar lista de inventario?
              </h4>
              <p className="text-xs text-slate-600 mt-1.5 mb-5 leading-relaxed tabular-nums">
                Se eliminarán los <strong>{vehicles.length}</strong>{' '}
                {vehicles.length === 1 ? 'vehículo registrado' : 'vehículos registrados'} para
                comenzar una nueva planilla limpia.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsClearConfirmOpen(false)}
                  className="w-full py-2 px-3 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  className="w-full py-2 px-3 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Vaciar Lista
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DEDICATED PRINT MOUNT POINT - Rendered ONLY during @media print */}
      <div id="app-print-root" className="hidden print:block print:w-full print:bg-white print:text-black">
        {printTargetFormat === 'thermal58' ? (
          <div
            id="print-thermal-container"
            className="w-[54mm] max-w-[54mm] mx-auto bg-white text-black font-mono text-[10px] leading-tight select-text py-2 px-1 text-left"
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              backgroundColor: '#ffffff',
              color: '#000000',
            }}
          >
            <div className="text-center border-b border-black pb-1.5 mb-1.5 bg-white text-black">
              <div className="text-[8.5px] uppercase font-bold tracking-widest text-black">
                CONTROL DE PATIO
              </div>
              <div className="text-[13px] font-black uppercase text-black">
                {thermalSettings.customHeader || 'INVENTARIO VIN'}
              </div>
              <div className="flex justify-between items-center text-[10px] font-black border border-black px-1 py-0.5 mt-1 bg-white text-black">
                <span>TOTAL:</span>
                <span>{vehicles.length} VEHICULOS</span>
              </div>
              <div className="flex justify-between text-[8px] font-bold text-black mt-1">
                <span>{meta.date || new Date().toLocaleDateString('es-ES')}</span>
                <span>{meta.time || ''}</span>
              </div>
              {meta.location && (
                <div className="text-[8px] font-bold text-left text-black mt-0.5">
                  PATIO: {meta.location}
                </div>
              )}
            </div>

            <div className="space-y-0.5 bg-white text-black">
              {vehicles.length === 0 ? (
                <div className="text-center py-4 text-[9px] font-bold text-black">
                  [LISTA EN BLANCO]
                </div>
              ) : (
                vehicles.map((v, idx) => (
                  <div
                    key={v.id || idx}
                    className={`py-0.5 bg-white text-black ${
                      thermalSettings.showDividers ? 'border-b border-dashed border-black' : ''
                    }`}
                  >
                    <div className="flex justify-between items-baseline font-black text-[10.5px] text-black">
                      <span>
                        {String(idx + 1).padStart(2, '0')}. {v.vin}
                      </span>
                      {thermalSettings.showCheckboxes && (
                        <span className="font-bold text-[9px]">[ ]</span>
                      )}
                    </div>
                    {thermalSettings.showDetails && (v.make || v.model || v.year) && (
                      <div className="flex justify-between text-[8.5px] font-bold text-black">
                        <span className="truncate max-w-[140px]">
                          {[v.make, v.model, v.year].filter(Boolean).join(' ') || '-'}
                        </span>
                        {v.lot && thermalSettings.showLot && <span>L:{v.lot}</span>}
                      </div>
                    )}
                    {thermalSettings.barcodeType !== 'none' && (
                      <div className="py-0.5 bg-white text-center">
                        <BarcodeRenderer
                          value={v.vin}
                          type={thermalSettings.barcodeType}
                          height={20}
                          isThermal={true}
                          displayValue={false}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="text-center border-t border-black pt-1.5 mt-2 text-[8.5px] bg-white text-black">
              <div className="font-bold uppercase text-black">
                {thermalSettings.customFooter || 'CONTROL DE PATIO Y AUDITORIA'}
              </div>
              <div className="mt-3 border-t border-black pt-1 text-[8px] font-bold uppercase text-black">
                FIRMA RESPONSABLE DE PATIO
              </div>
              <div className="mt-1.5 text-[7px] tracking-widest text-black">
                *** FIN DE REPORTE ***
              </div>
            </div>
          </div>
        ) : (
          <div
            id="print-letter-container"
            className="w-full bg-white text-slate-950 font-sans p-6"
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
          >
            <div className="flex justify-between items-start border-b-2 border-slate-950 pb-4 mb-4 bg-white text-slate-950">
              <div>
                <h1 className="text-xl font-black uppercase text-slate-950">
                  {letterSettings.companyName || 'CONTROL DE INVENTARIO VEHICULAR'}
                </h1>
                <p className="text-xs font-semibold text-slate-700 uppercase">
                  {letterSettings.documentTitle ||
                    'Planilla Oficial de Inspección y Despacho de Patio'}
                </p>
                {meta.location && (
                  <p className="text-xs text-slate-700 mt-0.5">
                    Ubicación / Patio: <strong>{meta.location}</strong>
                  </p>
                )}
              </div>
              <div className="text-right text-xs border border-slate-300 p-2 rounded bg-white text-slate-950">
                <div>
                  Fecha: <strong>{meta.date || new Date().toLocaleDateString('es-ES')}</strong>
                </div>
                <div>
                  Hora: <strong>{meta.time || ''}</strong>
                </div>
                {meta.operator && (
                  <div>
                    Auditor: <strong>{meta.operator}</strong>
                  </div>
                )}
                <div>
                  Total: <strong>{vehicles.length} vehículos</strong>
                </div>
              </div>
            </div>

            <table className="w-full border-collapse text-left text-xs bg-white text-slate-950">
              <thead>
                <tr className="bg-slate-900 text-white font-bold text-[10px] uppercase">
                  <th className="p-2 border border-slate-400 text-center w-8">#</th>
                  <th className="p-2 border border-slate-400">Identificador / VIN</th>
                  {letterSettings.showQrCode && (
                    <th className="p-2 border border-slate-400 text-center w-14">QR</th>
                  )}
                  <th className="p-2 border border-slate-400">Marca / Modelo</th>
                  <th className="p-2 border border-slate-400 text-center">Año</th>
                  <th className="p-2 border border-slate-400 text-center">Lote</th>
                  <th className="p-2 border border-slate-400">Notas</th>
                  {letterSettings.showCheckboxes && (
                    <th className="p-2 border border-slate-400 text-center w-10">[ ]</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v, i) => (
                  <tr key={v.id || i} className="border-b border-slate-300 bg-white">
                    <td className="p-2 text-center font-bold">{i + 1}</td>
                    <td className="p-2 font-mono font-bold">{v.vin}</td>
                    {letterSettings.showQrCode && (
                      <td className="p-1 text-center bg-white">
                        <BarcodeRenderer value={v.vin} type="qr" size={44} isThermal={false} />
                      </td>
                    )}
                    <td className="p-2 font-semibold">
                      {[v.make, v.model].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="p-2 text-center">{v.year || '-'}</td>
                    <td className="p-2 text-center">{v.lot || '-'}</td>
                    <td className="p-2 italic text-slate-600">{v.notes || '-'}</td>
                    {letterSettings.showCheckboxes && (
                      <td className="p-2 text-center font-bold text-sm">[ ]</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-12 mt-8 pt-6 border-t-2 border-slate-950 text-xs bg-white text-slate-950">
              <div className="text-center">
                <div className="border-b border-slate-900 pb-12" />
                <div className="font-bold pt-2 uppercase">
                  {letterSettings.supervisorName || meta.operator || 'Auditor de Patio'}
                </div>
                <div className="text-slate-600 text-[10px]">Responsable de Inventario</div>
              </div>
              <div className="text-center">
                <div className="border-b border-slate-900 pb-12" />
                <div className="font-bold pt-2 uppercase">Firma Recepcionista / Seguridad</div>
                <div className="text-slate-600 text-[10px]">C.I. / Identificación</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
