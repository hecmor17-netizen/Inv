import React, { useState, useRef, useCallback } from 'react';
import {
  Camera,
  Images,
  Scan,
  ClipboardPaste,
  FileSpreadsheet,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Aperture,
} from 'lucide-react';
import * as ZXing from '@zxing/library';
import { VehicleItem } from '../types';
import {
  compressImageClientSide,
  detectVinBarcodes,
  parseExcelFile,
  parseTextFile,
} from '../utils/fileParser';
import {
  parseVinsFromRawText,
  estimateMakeFromVin,
  estimateYearFromVin,
  cleanAndNormalizeVin,
} from '../utils/vinUtils';

interface ScanOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVehiclesExtracted: (
    vehicles: VehicleItem[],
    title?: string,
    summary?: string,
    append?: boolean
  ) => void;
  existingCount: number;
}

export const ScanOptionsModal: React.FC<ScanOptionsModalProps> = ({
  isOpen,
  onClose,
  onVehiclesExtracted,
  existingCount,
}) => {
  const [activeView, setActiveView] = useState<'menu' | 'live' | 'paste'>('menu');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');

  // Live scanner state
  const [liveScannerError, setLiveScannerError] = useState<string | null>(null);
  const [lastScannedVin, setLastScannedVin] = useState<string | null>(null);
  const [liveSessionCount, setLiveSessionCount] = useState<number>(0);
  const [isCapturingLiveFrame, setIsCapturingLiveFrame] = useState(false);

  // Hidden inputs
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Video & abort refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const liveCodeReaderRef = useRef<ZXing.BrowserMultiFormatReader | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const recentLiveScans = useRef<Map<string, number>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Web Audio Beeper for instant scan feedback
  const playScanBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(920, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {}

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 30, 80]);
      }
    } catch {}
  }, []);

  const stopLiveScanner = useCallback(() => {
    if (liveCodeReaderRef.current) {
      try {
        liveCodeReaderRef.current.reset();
      } catch {}
      liveCodeReaderRef.current = null;
    }
    if (liveStreamRef.current) {
      try {
        liveStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      liveStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturingLiveFrame(false);
  }, []);

  const cancelActiveProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setStatusMessage(null);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      stopLiveScanner();
      cancelActiveProcessing();
      setActiveView('menu');
      setErrorMessage(null);
      setSuccessMessage(null);
      setPastedText('');
    }
  }, [isOpen, stopLiveScanner, cancelActiveProcessing]);

  // Launch live camera barcode scanner
  const startLiveScanner = async () => {
    setActiveView('live');
    setLiveScannerError(null);
    setLastScannedVin(null);
    setLiveSessionCount(0);

    try {
      const codeReader = new ZXing.BrowserMultiFormatReader();
      liveCodeReaderRef.current = codeReader;

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      liveStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        codeReader.decodeFromVideoElementContinuously(videoRef.current, (result) => {
          if (result) {
            const rawText = result.getText() || '';
            const cleanText = rawText.replace(/[\*\s\-_:]/g, '').toUpperCase();
            const ocrClean = cleanText.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
            const match =
              cleanText.match(/[A-HJ-NPR-Z0-9]{17}/) || ocrClean.match(/[A-HJ-NPR-Z0-9]{17}/);

            if (match && match[0].length === 17) {
              const vin = match[0];
              const now = Date.now();
              const lastSeen = recentLiveScans.current.get(vin) || 0;

              if (now - lastSeen > 3000) {
                recentLiveScans.current.set(vin, now);
                playScanBeep();
                setLastScannedVin(vin);
                setLiveSessionCount((c) => c + 1);

                const newVehicle: VehicleItem = {
                  id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  vin,
                  make: estimateMakeFromVin(vin),
                  model: '',
                  year: estimateYearFromVin(vin),
                  color: '',
                  lot: '',
                  status: 'En patio',
                  notes: 'Cámara en vivo',
                  checked: false,
                };

                onVehiclesExtracted([newVehicle], undefined, undefined, true);
              }
            }
          }
        });
      }
    } catch (err: any) {
      console.error('Error al iniciar cámara:', err);
      setLiveScannerError(
        'No se pudo acceder a la cámara en vivo. Permite el acceso a la cámara o usa "Tomar Foto".'
      );
    }
  };

  // Capture frame from live video with fast Vision extraction
  const captureLiveFrameWithAi = async () => {
    if (!videoRef.current || isCapturingLiveFrame) return;
    try {
      setIsCapturingLiveFrame(true);
      setLiveScannerError(null);
      const video = videoRef.current;
      const rawW = video.videoWidth || 1280;
      const rawH = video.videoHeight || 720;
      const scale = Math.min(1, 1600 / Math.max(rawW, rawH));

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(rawW * scale));
      canvas.height = Math.max(1, Math.round(rawH * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.86);

      const response = await fetch('/api/extract-vin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      });
      const data = await response.json().catch(() => null);
      if (data && data.vehicles && data.vehicles.length > 0) {
        playScanBeep();
        const newVehicles: VehicleItem[] = [];
        for (const v of data.vehicles) {
          const cleanVin = cleanAndNormalizeVin(String(v.vin || ''));
          if (cleanVin && !recentLiveScans.current.has(cleanVin)) {
            recentLiveScans.current.set(cleanVin, Date.now());
            newVehicles.push({
              id: `live-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              vin: cleanVin,
              make: v.make || estimateMakeFromVin(cleanVin),
              model: v.model || '',
              year: v.year || estimateYearFromVin(cleanVin),
              color: v.color || '',
              lot: v.lot || '',
              status: v.status || 'En patio',
              notes: v.notes || 'Captura cámara',
              checked: false,
            });
            setLastScannedVin(cleanVin);
            setLiveSessionCount((c) => c + 1);
          }
        }
        if (newVehicles.length > 0) {
          onVehiclesExtracted(newVehicles, undefined, undefined, true);
        } else {
          setLiveScannerError('Estos códigos VIN ya fueron capturados en esta sesión.');
        }
      } else {
        setLiveScannerError(
          data?.error || 'No se detectó un VIN válido de 17 caracteres. Enfoca con mayor claridad e intenta de nuevo.'
        );
      }
    } catch (err: any) {
      setLiveScannerError('Error de conexión al analizar fotograma: ' + (err?.message || 'Red'));
    } finally {
      setIsCapturingLiveFrame(false);
    }
  };

  // Single image processor: compresses first, then runs Vision + Barcode in parallel
  const processSingleImage = async (
    file: File,
    signal: AbortSignal
  ): Promise<{ items: VehicleItem[]; error?: string }> => {
    let base64 = '';
    let mimeType = 'image/jpeg';

    const barcodePromise = detectVinBarcodes(file, 650).catch(() => [] as string[]);

    try {
      const comp = await compressImageClientSide(file, 1920, 0.86);
      base64 = comp.base64;
      mimeType = comp.mimeType;
    } catch {
      const rawData = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      base64 = rawData;
      mimeType = file.type || 'image/jpeg';
    }

    if (signal.aborted) return { items: [] };

    const visionPromise = (async () => {
      const response = await fetch('/api/extract-vin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
        signal,
      });
      const data = await response.json().catch(() => null);
      return { ok: response.ok, data };
    })();

    const [barcodeVins, visionResult] = await Promise.all([barcodePromise, visionPromise]);
    const collected: VehicleItem[] = [];
    const localSeen = new Set<string>();

    // Prefer rich AI Vision rows (include make/model/year/lot)
    if (visionResult?.data?.vehicles && Array.isArray(visionResult.data.vehicles)) {
      for (const v of visionResult.data.vehicles) {
        const cleanVin = cleanAndNormalizeVin(String(v.vin || ''));
        if (cleanVin && !localSeen.has(cleanVin)) {
          localSeen.add(cleanVin);
          collected.push({
            id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            vin: cleanVin,
            make: v.make || estimateMakeFromVin(cleanVin),
            model: v.model || '',
            year: v.year || estimateYearFromVin(cleanVin),
            color: v.color || '',
            lot: v.lot || '',
            status: v.status || 'En patio',
            notes: v.notes || '',
            checked: false,
          });
        }
      }
    }

    // Merge any hardware barcode detections not already captured
    for (const bVin of barcodeVins) {
      const cleanVin = cleanAndNormalizeVin(bVin);
      if (cleanVin && !localSeen.has(cleanVin)) {
        localSeen.add(cleanVin);
        collected.push({
          id: `bc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          vin: cleanVin,
          make: estimateMakeFromVin(cleanVin),
          model: '',
          year: estimateYearFromVin(cleanVin),
          color: '',
          lot: '',
          status: 'En patio',
          notes: 'Código de barras',
          checked: false,
        });
      }
    }

    const error = collected.length === 0 ? visionResult?.data?.error : undefined;
    return { items: collected, error };
  };

  // Main file processing handler (Photos, Gallery, Excel, CSV)
  const processFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;

    cancelActiveProcessing();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const allExtractedItems: VehicleItem[] = [];
    const seenVins = new Set<string>();
    let lastApiError: string | undefined;

    try {
      const excelFiles = fileList.filter((f) => f.name.match(/\.(xlsx|xls)$/i));
      const textFiles = fileList.filter((f) => f.name.match(/\.(csv|tsv|txt|json)$/i));
      const imageFiles = fileList.filter(
        (f) =>
          f.type.startsWith('image/') ||
          f.name.match(/\.(jpg|jpeg|png|webp|heic|heif|bmp)$/i)
      );
      const otherFiles = fileList.filter(
        (f) => !excelFiles.includes(f) && !textFiles.includes(f) && !imageFiles.includes(f)
      );
      if (otherFiles.length > 0) {
        imageFiles.push(...otherFiles);
      }

      // 1. Excel files (instant local parse)
      for (const ef of excelFiles) {
        setStatusMessage(`Leyendo planilla "${ef.name}"...`);
        const items = await parseExcelFile(ef);
        for (const item of items) {
          const vUpper = item.vin.toUpperCase();
          if (!seenVins.has(vUpper)) {
            seenVins.add(vUpper);
            allExtractedItems.push(item);
          }
        }
      }

      // 2. Text / CSV files (instant local parse)
      for (const tf of textFiles) {
        setStatusMessage(`Leyendo archivo "${tf.name}"...`);
        const items = await parseTextFile(tf);
        for (const item of items) {
          const vUpper = item.vin.toUpperCase();
          if (!seenVins.has(vUpper)) {
            seenVins.add(vUpper);
            allExtractedItems.push(item);
          }
        }
      }

      // 3. Images: process in concurrent batches of up to 3 for maximum speed
      if (imageFiles.length > 0) {
        const total = imageFiles.length;
        let completed = 0;
        const concurrency = 3;

        setStatusMessage(
          total === 1 ? 'Escaneando imagen...' : `Escaneando ${total} imágenes en paralelo...`
        );

        for (let start = 0; start < total; start += concurrency) {
          if (controller.signal.aborted) break;
          const batch = imageFiles.slice(start, start + concurrency);
          const results = await Promise.all(
            batch.map(async (file) => {
              try {
                const res = await processSingleImage(file, controller.signal);
                completed++;
                if (total > 1) {
                  setStatusMessage(`Procesadas ${completed} de ${total} imágenes...`);
                }
                return res;
              } catch (err: any) {
                completed++;
                if (err?.name === 'AbortError') return { items: [] };
                return { items: [], error: err?.message };
              }
            })
          );

          for (const res of results) {
            if (res.error) lastApiError = res.error;
            for (const item of res.items) {
              const vUpper = item.vin.toUpperCase();
              if (!seenVins.has(vUpper)) {
                seenVins.add(vUpper);
                allExtractedItems.push(item);
              }
            }
          }
        }
      }

      if (controller.signal.aborted) return;

      if (allExtractedItems.length > 0) {
        playScanBeep();
        onVehiclesExtracted(
          allExtractedItems,
          fileList.length === 1
            ? `Inventario - ${fileList[0].name.replace(/\.[^/.]+$/, '')}`
            : `Inventario (${allExtractedItems.length} VINs)`,
          `${allExtractedItems.length} número(s) VIN cargados`,
          existingCount > 0
        );
        setSuccessMessage(
          `Listo: se extrajeron ${allExtractedItems.length} VIN(s) de 17 caracteres.`
        );
        setTimeout(() => {
          onClose();
        }, 550);
      } else {
        setErrorMessage(
          lastApiError ||
            'No se detectaron números VIN válidos de 17 caracteres. Enfoca con claridad la etiqueta, parabrisas o planilla.'
        );
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Error al procesar archivos:', err);
        setErrorMessage(err?.message || 'Error al procesar los archivos seleccionados.');
      }
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setStatusMessage(null);
    }
  };

  // Direct paste handler
  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    const items = parseVinsFromRawText(pastedText);
    if (items.length > 0) {
      onVehiclesExtracted(
        items,
        'Lista Ingresada',
        `${items.length} VIN(s) agregados`,
        existingCount > 0
      );
      playScanBeep();
      setSuccessMessage(`Listo: se agregaron ${items.length} VIN(s) válidos.`);
      setPastedText('');
      setTimeout(() => {
        onClose();
      }, 450);
    } else {
      setErrorMessage(
        'No se detectaron números VIN válidos de 17 caracteres en el texto pegado.'
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 animate-fadeIn">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onClick={(e) => {
          (e.target as HTMLInputElement).value = '';
        }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
          }
        }}
      />

      <input
        type="file"
        ref={galleryInputRef}
        multiple
        accept="image/*"
        className="hidden"
        onClick={(e) => {
          (e.target as HTMLInputElement).value = '';
        }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
          }
        }}
      />

      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".xlsx,.xls,.csv,.tsv,.txt"
        className="hidden"
        onClick={(e) => {
          (e.target as HTMLInputElement).value = '';
        }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
          }
        }}
      />

      {/* Office Dialog Container */}
      <div className="bg-white rounded-lg shadow-xl border border-slate-300 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#185ABD] text-white flex items-center justify-center shrink-0">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-900">
                {activeView === 'live'
                  ? 'Cámara en Vivo'
                  : activeView === 'paste'
                  ? 'Pegar Lista de VINs'
                  : 'Escanear e Importar VINs'}
              </h3>
              <p className="text-xs text-slate-500">
                {activeView === 'live'
                  ? 'Lectura continua de código de barras o captura directa'
                  : activeView === 'paste'
                  ? 'Extrae automáticamente VINs de 17 caracteres desde texto'
                  : 'Selecciona el método de ingreso de vehículos'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="w-8 h-8 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto">
          {statusMessage && (
            <div className="mb-4 px-3.5 py-2.5 rounded-md bg-[#EFF6FC] border border-[#BFDBFE] text-[#0F172A] text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Loader2 className="w-4 h-4 animate-spin text-[#185ABD] shrink-0" />
                <span className="font-medium truncate">{statusMessage}</span>
              </div>
              <button
                type="button"
                onClick={cancelActiveProcessing}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-white cursor-pointer whitespace-nowrap shrink-0"
              >
                Cancelar
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 px-3.5 py-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 px-3.5 py-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* VIEW 1: Menu */}
          {activeView === 'menu' && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-md border border-slate-200 hover:border-[#185ABD] bg-white hover:bg-[#EFF6FC]/60 text-left transition-colors group cursor-pointer disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-md bg-[#EFF6FC] text-[#185ABD] group-hover:bg-[#185ABD] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 text-sm">
                    Tomar Foto con Cámara
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fotografía una lista impresa, etiqueta de marco o parabrisas
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-md border border-slate-200 hover:border-[#185ABD] bg-white hover:bg-[#EFF6FC]/60 text-left transition-colors group cursor-pointer disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-md bg-[#EFF6FC] text-[#185ABD] group-hover:bg-[#185ABD] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <Images className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 text-sm">
                    Abrir Galería / Capturas de Pantalla
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Selecciona una o varias fotos o capturas con listas completas
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={startLiveScanner}
                disabled={isProcessing}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-md border border-slate-200 hover:border-[#185ABD] bg-white hover:bg-[#EFF6FC]/60 text-left transition-colors group cursor-pointer disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-md bg-[#EFF6FC] text-[#185ABD] group-hover:bg-[#185ABD] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <Scan className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 text-sm">
                    Cámara en Vivo
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lector continuo de códigos de barras o captura instantánea
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('paste')}
                disabled={isProcessing}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-md border border-slate-200 hover:border-[#185ABD] bg-white hover:bg-[#EFF6FC]/60 text-left transition-colors group cursor-pointer disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-md bg-[#EFF6FC] text-[#185ABD] group-hover:bg-[#185ABD] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <ClipboardPaste className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 text-sm">
                    Pegar Lista desde Texto
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pega mensajes de WhatsApp, notas o columnas copiadas
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-md border border-slate-200 hover:border-[#107C41] bg-white hover:bg-emerald-50/40 text-left transition-colors group cursor-pointer disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-md bg-emerald-50 text-[#107C41] group-hover:bg-[#107C41] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 text-sm">
                    Importar Archivo Excel / CSV
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Carga directa desde planillas .xlsx, .xls, .csv o .txt
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* VIEW 2: Live Camera Viewfinder */}
          {activeView === 'live' && (
            <div className="flex flex-col gap-3">
              <div className="relative bg-slate-950 rounded-md overflow-hidden aspect-video sm:aspect-4/3 flex items-center justify-center border border-slate-300">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                  <div className="relative w-64 h-32 border-2 border-emerald-400 rounded-md">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-400" />
                  </div>
                  <p className="text-xs text-white font-medium mt-3 bg-slate-900/85 px-3 py-1 rounded">
                    Enfoca el código de barras o presiona Capturar
                  </p>
                </div>

                {lastScannedVin && (
                  <div className="absolute top-3 inset-x-3 bg-[#107C41] text-white px-3 py-2 rounded-md text-xs font-mono font-semibold text-center shadow">
                    Capturado: {lastScannedVin}
                  </div>
                )}

                {liveScannerError && (
                  <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
                    <p className="text-xs text-slate-200 mb-3">{liveScannerError}</p>
                    <button
                      type="button"
                      onClick={() => setLiveScannerError(null)}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Reintentar
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-slate-600 tabular-nums">
                  Capturados en sesión: <strong className="text-slate-900">{liveSessionCount}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={captureLiveFrameWithAi}
                    disabled={isCapturingLiveFrame}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#185ABD] hover:bg-[#104A9B] text-white text-xs font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {isCapturingLiveFrame ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analizando...</span>
                      </>
                    ) : (
                      <>
                        <Aperture className="w-3.5 h-3.5" />
                        <span>Capturar Foto</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopLiveScanner();
                      setActiveView('menu');
                    }}
                    className="px-3.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Finalizar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: Paste Text */}
          {activeView === 'paste' && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Pega tu listado (se extraerán todos los códigos VIN de 17 caracteres):
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={'Ejemplo:\n1HGCR2F83HA123456\n3N1AB8CV4RY219804 Toyota Hilux 2024\nMR0BA3CD2R0108924'}
                rows={8}
                className="w-full text-xs font-mono p-3 rounded-md border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#185ABD] focus:border-[#185ABD] text-slate-900"
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveView('menu')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-md cursor-pointer"
                >
                  Volver
                </button>
                <button
                  type="button"
                  disabled={!pastedText.trim()}
                  onClick={handlePasteSubmit}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#185ABD] hover:bg-[#104A9B] rounded-md cursor-pointer disabled:opacity-50"
                >
                  Extraer y Agregar VINs
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
