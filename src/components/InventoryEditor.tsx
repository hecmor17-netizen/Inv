import React, { useState } from 'react';
import {
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  AlertTriangle,
  Copy,
  QrCode,
  Scan,
  Plus,
  FileSpreadsheet,
} from 'lucide-react';
import { VehicleItem } from '../types';
import { estimateMakeFromVin, estimateYearFromVin, cleanAndNormalizeVin } from '../utils/vinUtils';
import { BarcodeRenderer } from './BarcodeRenderer';

interface InventoryEditorProps {
  vehicles: VehicleItem[];
  setVehicles: React.Dispatch<React.SetStateAction<VehicleItem[]>>;
  onNewCapture?: () => void;
  showQRCodes: boolean;
  showAddModal: boolean;
  setShowAddModal: (open: boolean) => void;
  onAddVehicle: (newVeh: VehicleItem) => void;
}

export const InventoryEditor: React.FC<InventoryEditorProps> = ({
  vehicles,
  setVehicles,
  onNewCapture,
  showQRCodes,
  showAddModal,
  setShowAddModal,
  onAddVehicle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<VehicleItem>>({});
  const [selectedQrVehicle, setSelectedQrVehicle] = useState<VehicleItem | null>(null);
  const [copiedVin, setCopiedVin] = useState(false);

  // New vehicle form state
  const [newVin, setNewVin] = useState('');
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newLot, setNewLot] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [vinError, setVinError] = useState<string | null>(null);

  // Check for duplicate VINs
  const vinCounts = vehicles.reduce((acc, v) => {
    const key = (v.vin || '').toUpperCase().trim();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasDuplicates = Object.values(vinCounts).some((count) => count > 1);

  // Filtered vehicles
  const filteredVehicles = vehicles.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.vin.toLowerCase().includes(q) ||
      (v.make && v.make.toLowerCase().includes(q)) ||
      (v.model && v.model.toLowerCase().includes(q)) ||
      (v.lot && v.lot.toLowerCase().includes(q)) ||
      (v.color && v.color.toLowerCase().includes(q)) ||
      (v.notes && v.notes.toLowerCase().includes(q))
    );
  });

  const handleToggleChecked = (id: string) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, checked: !v.checked } : v))
    );
  };

  const handleStartEdit = (veh: VehicleItem) => {
    setEditingId(veh.id);
    setEditForm({ ...veh });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const raw = (editForm.vin || '').toUpperCase().trim();
    const normalized = cleanAndNormalizeVin(raw) || raw;
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === editingId
          ? ({ ...v, ...editForm, vin: normalized } as VehicleItem)
          : v
      )
    );
    setEditingId(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDeleteItem = (id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = cleanAndNormalizeVin(newVin);
    if (!normalized) {
      setVinError('Ingresa un código VIN válido de 17 caracteres (sin letras I, O ni Q).');
      return;
    }

    const newVehicle: VehicleItem = {
      id: `manual-${Date.now()}`,
      vin: normalized,
      make: newMake.trim() || estimateMakeFromVin(normalized),
      model: newModel.trim(),
      year: newYear.trim() || estimateYearFromVin(normalized),
      color: newColor.trim(),
      lot: newLot.trim(),
      status: 'En patio',
      notes: newNotes.trim(),
      checked: false,
    };

    onAddVehicle(newVehicle);
    setShowAddModal(false);
    setVinError(null);
    setNewVin('');
    setNewMake('');
    setNewModel('');
    setNewYear('');
    setNewColor('');
    setNewLot('');
    setNewNotes('');
  };

  const handleVinInputChange = (val: string) => {
    const upper = val.toUpperCase().replace(/\s+/g, '');
    setNewVin(upper);
    setVinError(null);
    if (upper.length >= 3 && !newMake) {
      const detectedMake = estimateMakeFromVin(upper);
      if (detectedMake) setNewMake(detectedMake);
    }
    if (upper.length >= 10 && !newYear) {
      const detectedYear = estimateYearFromVin(upper);
      if (detectedYear) setNewYear(detectedYear);
    }
  };

  const checkedCount = vehicles.filter((v) => v.checked).length;

  return (
    <div className="bg-white rounded-md border border-slate-300 flex flex-col overflow-hidden text-slate-800">
      {/* Sheet Filter & Status Strip */}
      <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums">
          <span className="font-semibold text-slate-900">Planilla de Registro VIN</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>
            {vehicles.length} {vehicles.length === 1 ? 'unidad' : 'unidades'}
          </span>
          {vehicles.length > 0 && (
            <>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>
                Verificados: {checkedCount}/{vehicles.length}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial sm:w-72">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por VIN, marca, modelo o lote..."
              className="w-full text-xs py-1.5 pl-8 pr-7 rounded border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#185ABD] focus:ring-1 focus:ring-[#185ABD]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar filtro"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate Warning Row */}
      {hasDuplicates && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="font-medium">
            Se detectaron códigos VIN duplicados en la planilla (marcados en amarillo).
          </span>
        </div>
      )}

      {/* Spreadsheet Grid or Empty State */}
      {vehicles.length === 0 ? (
        <div className="py-16 px-6 text-center bg-white">
          <div className="w-12 h-12 rounded-md bg-[#EFF6FC] text-[#185ABD] flex items-center justify-center mx-auto mb-3 border border-[#BFDBFE]">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h4 className="font-semibold text-slate-900 text-base">
            La planilla está vacía
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 mb-5 leading-relaxed">
            Escanea una foto, captura de pantalla, código de barras o importa una hoja de Excel para cargar los números VIN de 17 caracteres.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {onNewCapture && (
              <button
                type="button"
                onClick={onNewCapture}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#185ABD] hover:bg-[#104A9B] text-white font-semibold text-xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <Scan className="w-4 h-4" />
                <span>Escanear VINs</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Ingresar Manual</span>
            </button>
          </div>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500">
          No hay registros que coincidan con "{searchQuery}".
        </div>
      ) : (
        <>
          {/* Desktop Excel-Style Table */}
          <div className="hidden md:block overflow-x-auto max-h-[540px] overflow-y-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#F3F4F6] border-b border-slate-300 text-slate-700">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center font-semibold border-r border-slate-200 tabular-nums">
                    #
                  </th>
                  <th className="py-2.5 px-2.5 w-12 text-center font-semibold border-r border-slate-200">
                    OK
                  </th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200 min-w-[195px]">
                    Número VIN (17 caracteres)
                  </th>
                  {showQRCodes && (
                    <th className="py-2.5 px-2.5 w-16 text-center font-semibold border-r border-slate-200">
                      QR
                    </th>
                  )}
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">
                    Marca
                  </th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">
                    Modelo
                  </th>
                  <th className="py-2.5 px-2.5 w-20 text-center font-semibold border-r border-slate-200">
                    Año
                  </th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">
                    Lote / Patio
                  </th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">
                    Notas
                  </th>
                  <th className="py-2.5 px-3 w-28 text-right font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredVehicles.map((veh, index) => {
                  const isDup = (vinCounts[(veh.vin || '').toUpperCase().trim()] || 0) > 1;
                  const isEditing = editingId === veh.id;

                  return (
                    <tr
                      key={veh.id}
                      className={`h-10 transition-colors ${
                        isDup
                          ? 'bg-amber-50/70 hover:bg-amber-50'
                          : index % 2 === 1
                          ? 'bg-[#FAFAFA] hover:bg-[#EFF6FC]'
                          : 'bg-white hover:bg-[#EFF6FC]'
                      }`}
                    >
                      <td className="px-3 py-1.5 text-center font-mono text-[11px] text-slate-500 border-r border-slate-200 tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </td>

                      <td className="px-2.5 py-1.5 text-center border-r border-slate-200">
                        <input
                          type="checkbox"
                          checked={!!veh.checked}
                          onChange={() => handleToggleChecked(veh.id)}
                          aria-label={`Marcar ${veh.vin} verificado`}
                          className="w-4 h-4 rounded border-slate-300 text-[#185ABD] focus:ring-[#185ABD] cursor-pointer align-middle"
                        />
                      </td>

                      {isEditing ? (
                        <>
                          <td className="px-2 py-1 border-r border-slate-200">
                            <input
                              type="text"
                              maxLength={17}
                              value={editForm.vin || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, vin: e.target.value.toUpperCase() })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              className="w-full font-mono font-semibold text-xs px-2 py-1 rounded border border-[#185ABD] bg-white text-slate-900 focus:outline-hidden"
                            />
                          </td>
                          {showQRCodes && (
                            <td className="px-2 py-1 text-center border-r border-slate-200 text-slate-400">
                              —
                            </td>
                          )}
                          <td className="px-2 py-1 border-r border-slate-200">
                            <input
                              type="text"
                              value={editForm.make || ''}
                              onChange={(e) => setEditForm({ ...editForm, make: e.target.value })}
                              className="w-full text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                            />
                          </td>
                          <td className="px-2 py-1 border-r border-slate-200">
                            <input
                              type="text"
                              value={editForm.model || ''}
                              onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                              className="w-full text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                            />
                          </td>
                          <td className="px-2 py-1 border-r border-slate-200">
                            <input
                              type="text"
                              maxLength={4}
                              value={editForm.year || ''}
                              onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                              className="w-full text-xs text-center tabular-nums px-1.5 py-1 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                            />
                          </td>
                          <td className="px-2 py-1 border-r border-slate-200">
                            <input
                              type="text"
                              value={editForm.lot || ''}
                              onChange={(e) => setEditForm({ ...editForm, lot: e.target.value })}
                              className="w-full text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                            />
                          </td>
                          <td className="px-2 py-1 border-r border-slate-200">
                            <input
                              type="text"
                              value={editForm.notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              className="w-full text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                            />
                          </td>
                          <td className="px-2.5 py-1 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                title="Guardar cambios"
                                className="p-1.5 rounded bg-[#185ABD] hover:bg-[#104A9B] text-white cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                title="Cancelar"
                                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-1.5 border-r border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-slate-900 tracking-wide select-all">
                                {veh.vin}
                              </span>
                              {isDup && (
                                <span className="text-[11px] font-semibold text-amber-800">
                                  · Duplicado
                                </span>
                              )}
                            </div>
                          </td>

                          {showQRCodes && (
                            <td className="px-2 py-1 text-center border-r border-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedQrVehicle(veh);
                                  setCopiedVin(false);
                                }}
                                title="Ampliar código QR"
                                className="inline-flex items-center justify-center p-0.5 bg-white border border-slate-200 rounded hover:border-[#185ABD] cursor-pointer"
                              >
                                <BarcodeRenderer value={veh.vin} type="qr" size={30} />
                              </button>
                            </td>
                          )}

                          <td className="px-3 py-1.5 border-r border-slate-200 font-medium text-slate-800">
                            {veh.make || '—'}
                          </td>

                          <td className="px-3 py-1.5 border-r border-slate-200 text-slate-700">
                            {veh.model || '—'}
                          </td>

                          <td className="px-2.5 py-1.5 text-center border-r border-slate-200 font-mono tabular-nums text-slate-700">
                            {veh.year || '—'}
                          </td>

                          <td className="px-3 py-1.5 border-r border-slate-200 text-slate-700">
                            {veh.lot || '—'}
                          </td>

                          <td className="px-3 py-1.5 border-r border-slate-200 text-slate-500 max-w-[180px] truncate">
                            {veh.notes || '—'}
                          </td>

                          <td className="px-2.5 py-1.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedQrVehicle(veh);
                                  setCopiedVin(false);
                                }}
                                title="Ver código QR"
                                className="p-1.5 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(veh)}
                                title="Editar fila"
                                className="p-1.5 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(veh.id)}
                                title="Eliminar fila"
                                className="p-1.5 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-700 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Compact Rows */}
          <div className="md:hidden divide-y divide-slate-200 max-h-[520px] overflow-y-auto">
            {filteredVehicles.map((veh, index) => {
              const isDup = (vinCounts[(veh.vin || '').toUpperCase().trim()] || 0) > 1;
              const isEditing = editingId === veh.id;

              return (
                <div
                  key={veh.id}
                  className={`p-3 ${isDup ? 'bg-amber-50/70' : 'bg-white'}`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        maxLength={17}
                        value={editForm.vin || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, vin: e.target.value.toUpperCase() })
                        }
                        className="w-full font-mono font-semibold text-xs p-2 rounded border border-[#185ABD] text-slate-900"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Marca"
                          value={editForm.make || ''}
                          onChange={(e) => setEditForm({ ...editForm, make: e.target.value })}
                          className="text-xs p-2 rounded border border-slate-300 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="Modelo"
                          value={editForm.model || ''}
                          onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                          className="text-xs p-2 rounded border border-slate-300 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="Año"
                          value={editForm.year || ''}
                          onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                          className="text-xs p-2 rounded border border-slate-300 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="Lote"
                          value={editForm.lot || ''}
                          onChange={(e) => setEditForm({ ...editForm, lot: e.target.value })}
                          className="text-xs p-2 rounded border border-slate-300 text-slate-900"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="px-3 py-1.5 text-xs font-semibold rounded bg-[#185ABD] text-white"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={!!veh.checked}
                          onChange={() => handleToggleChecked(veh.id)}
                          className="mt-1 w-4 h-4 rounded border-slate-300 text-[#185ABD]"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                              {String(index + 1).padStart(2, '0')}.
                            </span>
                            <span className="font-mono font-semibold text-xs text-slate-900 tracking-wide">
                              {veh.vin}
                            </span>
                            {isDup && (
                              <span className="text-[11px] font-semibold text-amber-800">
                                Duplicado
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5 truncate">
                            {[veh.make, veh.model, veh.year].filter(Boolean).join(' ') || 'Vehículo'}
                            {veh.lot ? ` · Lote ${veh.lot}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQrVehicle(veh);
                            setCopiedVin(false);
                          }}
                          className="p-2 rounded hover:bg-slate-100 text-slate-500"
                          aria-label="Ver QR"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(veh)}
                          className="p-2 rounded hover:bg-slate-100 text-slate-500"
                          aria-label="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(veh.id)}
                          className="p-2 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Manual Add VIN Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 max-w-md w-full overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-[#F8FAFC]">
              <h3 className="font-semibold text-sm text-slate-900">
                Agregar Vehículo Manualmente
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número VIN (17 caracteres) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={17}
                  value={newVin}
                  onChange={(e) => handleVinInputChange(e.target.value)}
                  placeholder="Ej: 1HGCR2F83HA123456"
                  className="w-full text-xs font-mono font-semibold uppercase p-2.5 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD] focus:ring-1 focus:ring-[#185ABD]"
                />
                {vinError && <p className="text-[11px] text-rose-700 mt-1">{vinError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={newMake}
                    onChange={(e) => setNewMake(e.target.value)}
                    placeholder="Ej: Toyota"
                    className="w-full text-xs p-2 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="Ej: Hilux"
                    className="w-full text-xs p-2 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Lote / Patio</label>
                  <input
                    type="text"
                    value={newLot}
                    onChange={(e) => setNewLot(e.target.value)}
                    placeholder="Ej: A-14"
                    className="w-full text-xs p-2 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Año</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    placeholder="Ej: 2024"
                    className="w-full text-xs p-2 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notas</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Observación opcional"
                  className="w-full text-xs p-2 rounded border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-[#185ABD]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newVin.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#185ABD] hover:bg-[#104A9B] rounded cursor-pointer disabled:opacity-50"
                >
                  Agregar a la Planilla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Código QR de Unidad */}
      {selectedQrVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 max-w-sm w-full overflow-hidden text-center text-slate-800">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#185ABD]" />
                <h3 className="font-semibold text-sm text-slate-900">Código QR de Unidad</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQrVehicle(null)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="bg-white p-3 rounded border border-slate-200 inline-flex items-center justify-center">
                <BarcodeRenderer value={selectedQrVehicle.vin} type="qr" size={160} />
              </div>

              <div className="mt-3">
                <div className="font-mono font-bold text-slate-900 text-sm tracking-wider bg-[#F8FAFC] py-2 px-3 rounded border border-slate-200 select-all">
                  {selectedQrVehicle.vin}
                </div>
                <div className="text-xs font-medium text-slate-700 mt-2">
                  {[selectedQrVehicle.make, selectedQrVehicle.model, selectedQrVehicle.year]
                    .filter(Boolean)
                    .join(' ') || 'Vehículo'}
                </div>
                {selectedQrVehicle.lot && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    Lote: {selectedQrVehicle.lot}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedQrVehicle.vin);
                    setCopiedVin(true);
                    setTimeout(() => setCopiedVin(false), 2000);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {copiedVin ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#107C41]" />
                      <span className="text-[#107C41] font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar VIN</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedQrVehicle(null)}
                  className="flex-1 py-2 px-3 text-xs font-semibold rounded bg-[#185ABD] hover:bg-[#104A9B] text-white cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
