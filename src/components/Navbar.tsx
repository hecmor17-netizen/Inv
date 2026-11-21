import React from 'react';
import {
  Share2,
  Receipt,
  FileText,
  RotateCcw,
  Camera,
  ListFilter,
  Eye,
  DownloadCloud,
  CheckCircle2,
} from 'lucide-react';
import { PrintFormat, InventoryMeta } from '../types';

export type AppTab = 'scan' | 'inventory' | 'preview' | 'share';

interface NavbarProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  activeFormat: PrintFormat;
  setActiveFormat: (format: PrintFormat) => void;
  unitsCount: number;
  meta: InventoryMeta;
  onShareClick: () => void;
  onNewCaptureClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  activeFormat,
  setActiveFormat,
  unitsCount,
  meta,
  onShareClick,
  onNewCaptureClick,
}) => {
  return (
    <header className="sticky top-0 z-40 shadow-xs">
      {/* Office / Word Top Title Bar */}
      <div className="bg-[#185abd] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4">
          {/* Brand & Document Name */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight">AutoPrint VIN</span>
                <span className="text-white/40 text-xs hidden sm:inline">|</span>
                <span className="text-xs text-white/90 font-medium truncate max-w-[200px] sm:max-w-[320px]">
                  {meta.title || 'Inventario de Unidades VIN'}
                </span>
              </div>
              <div className="text-[11px] text-white/75 flex items-center gap-2">
                <span>{unitsCount} {unitsCount === 1 ? 'vehículo' : 'vehículos'}</span>
                <span>·</span>
                <span>{meta.date || new Date().toLocaleDateString('es-ES')}</span>
                {meta.location && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[140px]">{meta.location}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Office Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onNewCaptureClick}
              className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Limpiar lista e iniciar nueva lectura"
            >
              <RotateCcw className="w-3.5 h-3.5 text-white/90" />
              <span className="hidden sm:inline">Nueva Lectura</span>
            </button>

            <button
              type="button"
              onClick={onShareClick}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-blue-50 text-[#185abd] text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Abrir opciones de exportación y envío"
            >
              <Share2 className="w-3.5 h-3.5 text-[#185abd]" />
              <span>Exportar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Windows Word / Office Ribbon Tab Bar */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center overflow-x-auto no-scrollbar">
          {/* Tab 1: Escanear */}
          <button
            type="button"
            onClick={() => setCurrentTab('scan')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              currentTab === 'scan'
                ? 'border-[#185abd] text-[#185abd] font-semibold bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Camera className={`w-4 h-4 ${currentTab === 'scan' ? 'text-[#185abd]' : 'text-slate-400'}`} />
            <span>1. Escanear / Subir</span>
            {unitsCount === 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.2 rounded">
                Nuevo
              </span>
            )}
          </button>

          {/* Tab 2: Inventario */}
          <button
            type="button"
            onClick={() => setCurrentTab('inventory')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              currentTab === 'inventory'
                ? 'border-[#185abd] text-[#185abd] font-semibold bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ListFilter className={`w-4 h-4 ${currentTab === 'inventory' ? 'text-[#185abd]' : 'text-slate-400'}`} />
            <span>2. Inventario</span>
            <span
              className={`text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                currentTab === 'inventory'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {unitsCount}
            </span>
          </button>

          {/* Tab 3: Vista Previa */}
          <button
            type="button"
            onClick={() => setCurrentTab('preview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              currentTab === 'preview'
                ? 'border-[#185abd] text-[#185abd] font-semibold bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Eye className={`w-4 h-4 ${currentTab === 'preview' ? 'text-[#185abd]' : 'text-slate-400'}`} />
            <span>3. Vista Previa</span>
            <span
              className={`text-[10px] font-medium uppercase px-1.5 py-0.2 rounded ${
                currentTab === 'preview'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {activeFormat === 'thermal58' ? '58mm' : 'Carta'}
            </span>
          </button>

          {/* Tab 4: Exportar */}
          <button
            type="button"
            onClick={() => setCurrentTab('share')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              currentTab === 'share'
                ? 'border-[#185abd] text-[#185abd] font-semibold bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <DownloadCloud className={`w-4 h-4 ${currentTab === 'share' ? 'text-[#185abd]' : 'text-slate-400'}`} />
            <span>4. Exportar</span>
          </button>
        </div>
      </nav>
    </header>
  );
};
