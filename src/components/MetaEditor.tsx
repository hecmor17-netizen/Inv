import React from 'react';
import { Settings2, Calendar, Clock, MapPin, User, ChevronDown, ChevronUp } from 'lucide-react';
import { InventoryMeta } from '../types';

interface MetaEditorProps {
  meta: InventoryMeta;
  setMeta: React.Dispatch<React.SetStateAction<InventoryMeta>>;
  isOpen: boolean;
  onToggle: () => void;
}

export const MetaEditor: React.FC<MetaEditorProps> = ({
  meta,
  setMeta,
  isOpen,
  onToggle,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mb-5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#185abd] flex items-center justify-center font-bold shrink-0">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-semibold text-slate-900 block">
              Datos del Documento (Patio, Auditor, Fecha y Hora)
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Ubicación: <strong className="text-slate-700">{meta.location || 'Patio Central'}</strong> · Auditor: <strong className="text-slate-700">{meta.operator || 'Inspector'}</strong>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
          <span>{isOpen ? 'Ocultar' : 'Editar Datos'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Fecha del Reporte
            </label>
            <input
              type="text"
              value={meta.date}
              onChange={(e) => setMeta({ ...meta, date: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden transition-all shadow-2xs"
              placeholder="DD/MM/AAAA"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Hora del Reporte
            </label>
            <input
              type="text"
              value={meta.time}
              onChange={(e) => setMeta({ ...meta, time: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden transition-all shadow-2xs"
              placeholder="HH:mm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              Patio / Ubicación
            </label>
            <input
              type="text"
              value={meta.location}
              onChange={(e) => setMeta({ ...meta, location: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden transition-all shadow-2xs"
              placeholder="Patio Central / Muelle"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Auditor / Supervisor
            </label>
            <input
              type="text"
              value={meta.operator}
              onChange={(e) => setMeta({ ...meta, operator: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden transition-all shadow-2xs"
              placeholder="Nombre del auditor"
            />
          </div>
        </div>
      )}
    </div>
  );
};
