import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  ClipboardPaste,
  RotateCcw,
  Image as ImageIcon,
  Images,
  Scan,
  X,
  Zap,
  Volume2,
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
} from '../utils/vinUtils';

interface CaptureDropzoneProps {
  onVehiclesExtracted: (
    vehicles: VehicleItem[],
    title?: string,
    summary?: string,
    append?: boolean
  ) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  existingCount: number;
  onNewCapture: () => void;
  onNavigateToTab?: (tab: 'inventory' | 'preview' | 'share') => void;
}

export const CaptureDropzone: React.FC<CaptureDropzoneProps> = ({
  onVehiclesExtracted,
  isProcessing,
  setIsProcessing,
  existingCount,
  onNewCapture,
  onNavigateToTab,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Live Camera Scanner State
  const [isLiveScannerOpen, setIsLiveScannerOpen] = useState(false);
  const [liveScannerError, setLiveScannerError] = useState<string | null>(null);
  const [lastScannedVin, setLastScannedVin] = useState<string | null>(null);
  const [liveSessionCount, setLiveSessionCount] = useState<number>(0);
  const [isCapturingLiveFrame, setIsCapturingLiveFrame] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const activeAbortController = useRef<AbortController | null>(null);

  // Video & Live Scanner Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const liveCodeReaderRef = useRef<ZXing.BrowserMultiFormatReader | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const recentLiveScans = useRef<Map<string, number>>(new Map());

  // Web Audio Beeper for instant scan confirmation
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
    } catch {
      // AudioContext not permitted or supported
    }

    // Gentle tactile haptic feedback on mobile devices
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 40, 100]);
      }
    } catch {}
  }, []);

  const cancelActiveProcess = () => {
    if (activeAbortController.current) {
      activeAbortController.current.abort();
      activeAbortController.current = null;
    }
    setIsProcessing(false);
    setStatusMessage(null);
    setErrorMessage('Escaneo cancelado por el usuario.');
  };

  // Close live video stream cleanly
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

    setIsLiveScannerOpen(false);
    setLiveScannerError(null);
    setIsCapturingLiveFrame(false);
  }, []);

  // Snap current live video frame and process with Gemini Vision AI
  const captureLiveFrameWithAi = async () => {
    if (!videoRef.current || isCapturingLiveFrame) return;
    try {
      setIsCapturingLiveFrame(true);
      setLiveScannerError(null);
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.88);

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
          const cleanVin = (v.vin || '').toUpperCase().trim();
          if (cleanVin && !recentLiveScans.current.has(cleanVin)) {
            recentLiveScans.current.set(cleanVin, Date.now());
            const item: VehicleItem = {
              id: `live-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              vin: cleanVin,
              make: v.make || estimateMakeFromVin(cleanVin),
              model: v.model || '',
              year: v.year || estimateYearFromVin(cleanVin),
              color: v.color || '',
              lot: v.lot || '',
              status: v.status || 'En patio',
              notes: v.notes || (data.aiModel ? `IA ${data.aiModel}` : 'Captura en vivo'),
              checked: false,
            };
            newVehicles.push(item);
            setLastScannedVin(cleanVin);
            setLiveSessionCount((c) => c + 1);
          }
        }
        if (newVehicles.length > 0) {
          onVehiclesExtracted(newVehicles, undefined, undefined, true);
        } else {
          setLiveScannerError('Este VIN ya fue capturado en la sesión actual.');
        }
      } else {
        setLiveScannerError(
          data?.error || 'No se reconoció un VIN en este encuadre. Acércate más a la etiqueta o parabrisas e intenta de nuevo.'
        );
      }
    } catch (err: any) {
      setLiveScannerError('Error al procesar la captura con IA: ' + (err?.message || 'Error de red'));
    } finally {
      setIsCapturingLiveFrame(false);
    }
  };

  // Launch Live Camera Barcode Scanner
  const startLiveScanner = async () => {
    setLiveScannerError(null);
    setLastScannedVin(null);
    setLiveSessionCount(0);
    setIsLiveScannerOpen(true);

    try {
      const codeReader = new ZXing.BrowserMultiFormatReader();
      liveCodeReaderRef.current = codeReader;

      // Request rear camera with optimal resolution for barcode reading
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

        // Start continuous decoding
        codeReader.decodeFromVideoElementContinuously(
          videoRef.current,
          (result, error) => {
            if (result) {
              const rawText = result.getText();
              const cleanText = rawText.replace(/[\*\s\-_]/g, '').toUpperCase();
              const match = cleanText.match(/[A-HJ-NPR-Z0-9]{17}/);

              if (match) {
                const vin = match[0];
                const now = Date.now();
                const lastSeen = recentLiveScans.current.get(vin) || 0;

                // Debounce duplicate reads of the exact same vehicle within 3 seconds
                if (now - lastSeen > 3000) {
                  recentLiveScans.current.set(vin, now);
                  playScanBeep();
                  setLastScannedVin(vin);
                  setLiveSessionCount((c) => c + 1);

                  const newVehicle: VehicleItem = {
                    id: `live-vin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    vin,
                    make: estimateMakeFromVin(vin),
                    model: '',
                    year: estimateYearFromVin(vin),
                    color: '',
                    lot: '',
                    status: 'En patio',
                    notes: 'Escaneado con cámara en vivo',
                    checked: false,
                  };

                  onVehiclesExtracted([newVehicle], undefined, undefined, true);
                }
              }
            }
          }
        );
      }
    } catch (err: any) {
      console.error('Error al iniciar cámara en vivo:', err);
      setLiveScannerError(
        'No se pudo acceder a la cámara en vivo. Por favor permite el acceso o usa el botón de "Abrir Galería de Fotos".'
      );
    }
  };

  // Global paste handler (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.clipboardData) {
        const items = e.clipboardData.items;
        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              imageFiles.push(blob);
            }
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault();
          processMultipleFiles(imageFiles);
          return;
        }

        const text = e.clipboardData.getData('text');
        if (text && text.trim().length > 0) {
          e.preventDefault();
          processDirectText(text);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [existingCount]);

  const isImageFile = (f: File): boolean => {
    const mime = (f.type || '').toLowerCase();
    const name = (f.name || '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|heic|heif|jfif|pjpeg|bmp|tiff?|gif|avif)$/i.test(name);
  };

  // Primary scanning function: Fluid, resilient, never hangs or crashes
  const processMultipleFiles = async (files: File[] | FileList) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsProcessing(true);

    const controller = new AbortController();
    activeAbortController.current = controller;

    try {
      const allExtractedItems: VehicleItem[] = [];
      const seenVins = new Set<string>();

      // Group files
      const excelFiles = fileList.filter((f) => {
        const lower = f.name.toLowerCase();
        return lower.endsWith('.xlsx') || lower.endsWith('.xls');
      });

      const textFiles = fileList.filter((f) => {
        const lower = f.name.toLowerCase();
        return (
          lower.endsWith('.csv') ||
          lower.endsWith('.tsv') ||
          lower.endsWith('.txt') ||
          lower.endsWith('.json') ||
          f.type === 'text/plain' ||
          f.type === 'text/csv'
        );
      });

      const imageFiles = fileList.filter(
        (f) => !excelFiles.includes(f) && !textFiles.includes(f) && isImageFile(f)
      );

      const otherFiles = fileList.filter(
        (f) =>
          !excelFiles.includes(f) &&
          !textFiles.includes(f) &&
          !imageFiles.includes(f)
      );
      if (otherFiles.length > 0) {
        imageFiles.push(...otherFiles);
      }

      // 1. Process Excel files instantly
      for (const ef of excelFiles) {
        setStatusMessage(`Analizando planilla "${ef.name}"...`);
        const items = await parseExcelFile(ef);
        for (const item of items) {
          const vUpper = item.vin.toUpperCase();
          if (!seenVins.has(vUpper)) {
            seenVins.add(vUpper);
            allExtractedItems.push(item);
          }
        }
      }

      // 2. Process Text/CSV files instantly
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

      // 3. Process Image files (Dual-Engine: Instant Local Barcode Detection + Visual Gemini AI Fallback)
      let lastServerError: string | null = null;
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          if (controller.signal.aborted) break;

          const file = imageFiles[i];
          const fileLabel =
            imageFiles.length > 1
              ? `Foto ${i + 1} de ${imageFiles.length}`
              : file.name || 'foto';

          // STEP A: Instant Barcode Detection (<80ms) using ZXing + BarcodeDetector
          setStatusMessage(`Escaneando código de barras (${fileLabel})...`);
          let foundInBarcode = false;
          try {
            const barcodeVins = await detectVinBarcodes(file);
            if (barcodeVins.length > 0) {
              for (const bVin of barcodeVins) {
                const cleanVin = bVin.toUpperCase().trim();
                if (cleanVin && !seenVins.has(cleanVin)) {
                  seenVins.add(cleanVin);
                  allExtractedItems.push({
                    id: `barcode-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
                  foundInBarcode = true;
                }
              }
              if (foundInBarcode) {
                playScanBeep();
                // Found in barcode! Skip heavy AI processing for this file
                continue;
              }
            }
          } catch (barcodeErr) {
            console.warn('Escaneo de código de barras omitido:', barcodeErr);
          }

          // STEP B: If no barcode was found, compress for AI OCR with high clarity (2048px)
          setStatusMessage(`Optimizando imagen (${fileLabel})...`);
          let base64 = '';
          let mimeType = 'image/jpeg';
          try {
            const comp = await compressImageClientSide(file, 2048, 0.88);
            base64 = comp.base64;
            mimeType = comp.mimeType;
          } catch (compErr: any) {
            console.warn(`Error al comprimir ${fileLabel}, intentando lectura directa:`, compErr);
            try {
              const rawData = await new Promise<string>((res, rej) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result as string);
                reader.onerror = rej;
                reader.readAsDataURL(file);
              });
              base64 = rawData;
              mimeType = file.type || 'image/jpeg';
            } catch (frErr) {
              console.warn(`No se pudo leer archivo ${fileLabel}:`, frErr);
              continue;
            }
          }

          if (!base64 || base64.length < 50) continue;

          // STEP C: AI Vision OCR with per-file timeout (does not break other photos in batch)
          setStatusMessage(
            imageFiles.length > 1
              ? `Leyendo VINs con IA visual Gemini (${fileLabel}) - detectados: ${allExtractedItems.length}...`
              : 'Leyendo texto, placa y chasis con IA Gemini Vision...'
          );

          const fileController = new AbortController();
          const userAbortHandler = () => fileController.abort();
          controller.signal.addEventListener('abort', userAbortHandler);
          const timeoutId = setTimeout(() => fileController.abort(), 35000);

          try {
            const response = await fetch('/api/extract-vin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64, mimeType }),
              signal: fileController.signal,
            });

            const data = await response.json().catch(() => null);
            if (data && data.vehicles && Array.isArray(data.vehicles) && data.vehicles.length > 0) {
              let newlyAdded = 0;
              for (const v of data.vehicles) {
                const cleanVin = (v.vin || '').toUpperCase().trim();
                if (cleanVin && !seenVins.has(cleanVin)) {
                  seenVins.add(cleanVin);
                  allExtractedItems.push({
                    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    vin: cleanVin,
                    make: v.make || estimateMakeFromVin(cleanVin),
                    model: v.model || '',
                    year: v.year || estimateYearFromVin(cleanVin),
                    color: v.color || '',
                    lot: v.lot || '',
                    status: v.status || 'En patio',
                    notes: v.notes || (data.aiModel ? `IA ${data.aiModel}` : 'Reconocimiento visual'),
                    checked: false,
                  });
                  newlyAdded++;
                }
              }
              if (newlyAdded > 0) {
                playScanBeep();
              }
            } else if (data && !data.success && data.error) {
              lastServerError = data.error;
              console.warn(`Aviso de IA para ${fileLabel}:`, data.error);
            }
          } catch (fetchErr: any) {
            if (fetchErr.name === 'AbortError') {
              console.warn(`Tiempo límite o cancelación en ${fileLabel}`);
            } else {
              console.warn(`Error en ${fileLabel}:`, fetchErr);
            }
          } finally {
            clearTimeout(timeoutId);
            controller.signal.removeEventListener('abort', userAbortHandler);
          }
        }
      }

      if (allExtractedItems.length > 0) {
        onVehiclesExtracted(
          allExtractedItems,
          fileList.length === 1
            ? `Inventario - ${fileList[0].name.replace(/\.[^/.]+$/, '')}`
            : `Inventario (${allExtractedItems.length} unidades)`,
          `${allExtractedItems.length} vehículos cargados desde ${fileList.length} ${
            fileList.length === 1 ? 'archivo/foto' : 'fotos o archivos'
          }`,
          existingCount > 0
        );
        setSuccessMessage(
          `¡Éxito! Se detectaron ${allExtractedItems.length} vehículo(s) en ${fileList.length} ${
            fileList.length === 1
              ? 'foto o archivo'
              : 'fotos seleccionadas de la galería'
          }.`
        );
      } else {
        setErrorMessage(
          lastServerError ||
          `No se detectaron elementos legibles en ${
            fileList.length === 1
              ? 'la foto o archivo seleccionado'
              : `las ${fileList.length} fotos o archivos seleccionados`
          }. Asegúrate de que la lista o códigos estén bien enfocados e iluminados, o usa "Pegar Texto o Lista" para ingresarla directamente.`
        );
      }
    } catch (err: any) {
      console.error('Error procesando archivos:', err);
      setErrorMessage(
        err?.message || 'Error al procesar los archivos. Intenta nuevamente.'
      );
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
      activeAbortController.current = null;
    }
  };

  const processDirectText = (text: string) => {
    const items = parseVinsFromRawText(text);
    if (items.length > 0) {
      onVehiclesExtracted(
        items,
        'Lista Ingresada',
        `${items.length} elemento(s) agregados de la lista`,
        existingCount > 0
      );
      setSuccessMessage(`¡Éxito! Se agregaron ${items.length} elemento(s) a la lista.`);
      setShowPasteModal(false);
      setPastedText('');
    } else {
      setErrorMessage(
        'El texto ingresado está vacío o no contiene líneas legibles para agregar.'
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processMultipleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all">
      {/* 1. Dedicated Gallery input (Multiple photos allowed) */}
      <input
        type="file"
        ref={galleryInputRef}
        multiple
        accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onClick={(e) => {
          (e.target as HTMLInputElement).value = '';
        }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            processMultipleFiles(selectedFiles);
          }
        }}
      />

      {/* 2. Direct camera input for mobile photo snap */}
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
            const selectedFiles = Array.from(e.target.files);
            processMultipleFiles(selectedFiles);
          }
        }}
      />

      {/* 3. File input for Excel (.xlsx, .xls) and CSV */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".xlsx,.xls,.csv,.tsv,.txt,.json,image/*"
        className="hidden"
        onClick={(e) => {
          (e.target as HTMLInputElement).value = '';
        }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            processMultipleFiles(selectedFiles);
          }
        }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#185abd] flex items-center justify-center font-bold shrink-0">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base sm:text-lg text-slate-900 flex items-center gap-2 flex-wrap">
              <span>1. Escaneo y Lectura de VINs</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-[#185abd] border border-blue-200">
                Lector Óptico + IA Gemini Vision
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Escanea instantáneamente desde fotos de galería, cámara en vivo, Excel o texto
            </p>
          </div>
        </div>

        {existingCount > 0 && (
          <button
            type="button"
            onClick={onNewCapture}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer self-start sm:self-auto"
            title="Limpiar y empezar nueva captura"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Nueva Lectura</span>
          </button>
        )}
      </div>

      {/* Dropzone Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && galleryInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 sm:p-10 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/70 scale-[0.99] shadow-inner'
            : isProcessing
            ? 'border-blue-300 bg-blue-50/30 pointer-events-none'
            : 'border-slate-300 hover:border-[#185abd] bg-slate-50/50 hover:bg-blue-50/20'
        }`}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-14 h-14 rounded-xl bg-blue-100 text-[#185abd] flex items-center justify-center shadow-xs">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div className="text-center max-w-sm">
              <h4 className="font-semibold text-slate-900 text-sm sm:text-base">
                Escaneando información de vehículos...
              </h4>
              <p className="text-xs text-[#185abd] font-medium mt-1">
                {statusMessage || 'Decodificando código de barras y texto...'}
              </p>
              <div className="mt-3 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelActiveProcess();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar escaneo
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-blue-50 text-[#185abd] flex items-center justify-center shadow-2xs">
              <Images className="w-7 h-7" />
            </div>

            <div>
              <p className="font-semibold text-slate-900 text-base sm:text-lg">
                Toca aquí para abrir Galería o arrastrar fotos
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-lg">
                Soporta fotos de autos, etiquetas de chasis en marco de puerta, parabrisas o capturas de pantalla
              </p>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                <Images className="w-3.5 h-3.5 text-blue-600" /> Galería de Fotos
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                <Scan className="w-3.5 h-3.5 text-emerald-600" /> Escáner en Vivo
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel / CSV
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons: Fluid & Ergonomic */}
      <div className="space-y-3 mt-5">
        {/* ROW 1: 3 Powerful Scanning Modes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Botón 1: Abrir Galería */}
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isProcessing}
            className="btn-3d flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#185abd] hover:bg-[#106ebe] active:bg-[#004578] text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer disabled:opacity-50 text-center transition-all"
            title="Seleccionar foto de chasis o auto desde tu galería"
          >
            <Images className="w-4 h-4 shrink-0 text-white" />
            <span>Abrir Galería de Fotos</span>
          </button>

          {/* Botón 2: Cámara en Vivo (Escaneo en Tiempo Real) */}
          <button
            type="button"
            onClick={startLiveScanner}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer disabled:opacity-50 text-center transition-all"
            title="Apunta la cámara al código de barras del VIN para escaneo continuo"
          >
            <Scan className="w-4 h-4 shrink-0 text-white" />
            <span>Cámara en Vivo (Tiempo Real)</span>
          </button>

          {/* Botón 3: Tomar Foto Directa */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium border border-slate-300 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 text-center"
            title="Tomar foto con la cámara del dispositivo"
          >
            <Camera className="w-4 h-4 shrink-0 text-slate-600" />
            <span>Tomar Foto con Cámara</span>
          </button>
        </div>

        {/* ROW 2: Complementary Input Methods */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer disabled:opacity-50 text-center"
            title="Subir archivo Excel (.xlsx) o CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span>Subir Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            disabled={isProcessing}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer disabled:opacity-50 text-center"
            title="Pegar cualquier lista de vehículos, patentes o códigos de texto"
          >
            <ClipboardPaste className="w-3.5 h-3.5 shrink-0 text-blue-600" />
            <span>Pegar Texto o Lista</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab && onNavigateToTab('inventory')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer text-center"
            title="Ver inventario o agregar auto manual"
          >
            <Plus className="w-3.5 h-3.5 shrink-0 text-slate-600" />
            <span>Añadir Auto Manual</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="mt-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs animate-fadeIn">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm text-emerald-900">
              {successMessage}
            </span>
          </div>
          {onNavigateToTab && (
            <div className="flex items-center gap-2 pt-2 border-t border-emerald-100 mt-2">
              <button
                type="button"
                onClick={() => onNavigateToTab('inventory')}
                className="px-3.5 py-1.5 rounded-md bg-[#185abd] hover:bg-[#106ebe] text-white font-medium text-xs shadow-2xs cursor-pointer"
              >
                Ver en Inventario
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab('preview')}
                className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-200 cursor-pointer"
              >
                Ir a Vista Previa
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error / Assistance Notification */}
      {errorMessage && (
        <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-xs sm:text-sm text-rose-900 block mb-0.5">
                Aviso de lectura:
              </span>
              <p className="leading-relaxed">{errorMessage}</p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={startLiveScanner}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs cursor-pointer shadow-2xs"
                >
                  Probar Cámara en Vivo
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-300 cursor-pointer"
                >
                  Probar otra foto
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasteModal(true)}
                  className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-300 cursor-pointer"
                >
                  Pegar VIN manualmente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Video Viewfinder Scanner Modal */}
      {isLiveScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Scan className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-white">
                    Escáner de Código de Barras en Vivo
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Apunta al código de barras del VIN (puerta o parabrisas)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={stopLiveScanner}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Viewfinder Area */}
            <div className="relative bg-black flex items-center justify-center min-h-[320px] max-h-[460px] overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Target Scan Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                <div className="relative w-64 h-32 sm:w-72 sm:h-36 border-2 border-emerald-400/80 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {/* Laser scan line animation */}
                  <div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-[bounce_2s_infinite]" />

                  {/* Corner Reticle Accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-300" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-300" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-300" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-300" />
                </div>

                <p className="text-xs text-emerald-300 font-medium mt-4 bg-slate-900/80 px-3 py-1 rounded-full border border-emerald-500/30">
                  Apunta al código de barras o pulsa "Capturar con IA" si es texto
                </p>
              </div>

              {/* Scan Feedback Badge */}
              {lastScannedVin && (
                <div className="absolute top-4 inset-x-4 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between animate-fadeIn z-10">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                    <div>
                      <p className="text-xs font-semibold">¡VIN Capturado!</p>
                      <p className="text-[11px] font-mono tracking-wider">
                        {lastScannedVin}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-700 px-2 py-0.5 rounded font-medium">
                    Añadido
                  </span>
                </div>
              )}

              {/* Error overlay inside video if camera blocked */}
              {liveScannerError && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center z-20">
                  <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                  <p className="text-xs text-slate-300 max-w-xs mb-4">
                    {liveScannerError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setLiveScannerError(null)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium cursor-pointer"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-300">
                  Leídos:{' '}
                  <strong className="text-emerald-400 font-bold">
                    {liveSessionCount}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={captureLiveFrameWithAi}
                  disabled={isCapturingLiveFrame}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60 transition-colors"
                  title="Capturar fotograma y analizar con IA Gemini Vision si no hay código de barras"
                >
                  {isCapturingLiveFrame ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Leyendo con IA...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      <span>Capturar con IA</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={stopLiveScanner}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 cursor-pointer transition-colors"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for manual text paste */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#185abd] flex items-center justify-center font-bold">
                  <ClipboardPaste className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base text-slate-900">
                  Pegar Texto o Lista
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="py-3">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Pega aquí tu lista (un elemento por línea, o filas copiadas de Excel, WhatsApp, notas o papel):
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Pega tu lista aquí... (ej:&#10;BBCL19 - Toyota Hilux 2021&#10;KXYZ89 - Chevrolet Sail 2018&#10;1HGCR2F83HA123456&#10;COD-402 Nissan Navara...)"
                rows={7}
                className="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 text-slate-900 shadow-2xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Acepta cualquier lista: VINs, patentes, códigos de stock o descripciones de autos.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!pastedText.trim()}
                onClick={() => processDirectText(pastedText)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#185abd] hover:bg-[#106ebe] active:bg-[#004578] rounded-lg shadow-2xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                Pegar y Agregar Lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
