import express, { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type, GenerateContentResponse } from '@google/genai';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const getAi = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Normalize candidate string to a valid 17-character ISO 3779 VIN
function normalizeVinCandidate(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\*\s\-_:.|,/\\]/g, '').toUpperCase().trim();
  if (cleaned.length === 17) {
    const fixed = cleaned.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
    if (/^[A-HJ-NPR-Z0-9]{17}$/.test(fixed)) {
      return fixed;
    }
  }
  // If longer string (e.g. "VIN1FTFW1ED4MFA12301"), scan 17-char sliding windows
  if (cleaned.length > 17 && cleaned.length <= 32) {
    const fixedAll = cleaned.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
    const subMatch = fixedAll.match(/[A-HJ-NPR-Z0-9]{17}/);
    if (subMatch) return subMatch[0];
  }
  return null;
}

// Helper: extract strictly valid 17-character VINs from text
function extractVinsLocally(text: string) {
  if (!text) return [];
  const foundVins = new Set<string>();
  const items: any[] = [];

  // Direct and OCR-corrected 17-char matches
  const tokenMatches = text.match(/[A-Za-z0-9\-_*.:]{17,24}/g) || [];
  for (const raw of tokenMatches) {
    const vin = normalizeVinCandidate(raw);
    if (vin && !foundVins.has(vin)) {
      foundVins.add(vin);
      items.push({
        vin,
        make: '',
        model: '',
        year: '',
        color: '',
        lot: '',
        status: 'En patio',
        notes: 'Lectura de VIN',
      });
    }
  }

  return items;
}

const VIN_SYSTEM_INSTRUCTION = `Eres un auditor automotriz experto en lectura óptica (OCR) de números VIN (Vehicle Identification Number, norma ISO 3779 de exactamente 17 caracteres).

REGLAS OBLIGATORIAS:
1. EXTRAE ABSOLUTAMENTE TODOS LOS VINs DE 17 CARACTERES presentes en la imagen o documento. Si la foto es una lista, planilla, tabla de Excel, captura de pantalla o reporte con 5, 10, 20, 30 o más filas, transcribe TODOS de principio a fin en orden descendente sin omitir ninguno ni detenerte antes del final.
2. Solo incluye códigos VIN reales de exactamente 17 caracteres alfanuméricos. Descarta patentes cortas (ej. BBCL19), teléfonos, fechas o encabezados.
3. Corrección OCR estricta para VINs: las letras I, O y Q nunca existen en un VIN estándar; si aparecen por error óptico, corrígelas a 1, 0 y 0 respectivamente. Quita espacios o asteriscos dentro del VIN.
4. Si en la misma fila o etiqueta figuran Marca (make), Modelo (model), Año (year), Color (color) o Lote/Ubicación (lot), inclúyelos; si no aparecen, deja cadena vacía "".
5. Responde únicamente con el JSON estructurado según el esquema.`;

const VIN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Título breve del lote o documento detectado.',
    },
    vehicles: {
      type: Type.ARRAY,
      description: 'Lista completa y ordenada de todos los vehículos con VIN de 17 caracteres detectados.',
      items: {
        type: Type.OBJECT,
        properties: {
          vin: {
            type: Type.STRING,
            description: 'Número VIN de exactamente 17 caracteres alfanuméricos válidos (sin I, O ni Q).',
          },
          make: { type: Type.STRING, description: 'Marca del vehículo o vacío.' },
          model: { type: Type.STRING, description: 'Modelo del vehículo o vacío.' },
          year: { type: Type.STRING, description: 'Año de 4 dígitos o vacío.' },
          color: { type: Type.STRING, description: 'Color o vacío.' },
          lot: { type: Type.STRING, description: 'Lote, patio o ubicación o vacío.' },
          notes: { type: Type.STRING, description: 'Observación breve o vacío.' },
        },
        required: ['vin'],
      },
    },
  },
  required: ['vehicles'],
};

// API Endpoint: Extract strictly valid 17-character VINs from photo, screenshot, or text
app.post('/api/extract-vin', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const { imageBase64, mimeType = 'image/jpeg', images, textContent } = req.body;

    const hasImages = (images && Array.isArray(images) && images.length > 0) || Boolean(imageBase64);
    if (!hasImages && !textContent) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una imagen o texto con números VIN.',
      });
    }

    // Instant local extraction when only text is provided
    if (!hasImages && textContent) {
      const localVehicles = extractVinsLocally(textContent);
      return res.json({
        success: localVehicles.length > 0,
        title: 'VINs Extraídos',
        summary: `Se detectaron ${localVehicles.length} número(s) VIN de 17 caracteres.`,
        vehicles: localVehicles,
        error: localVehicles.length === 0 ? 'No se encontraron códigos VIN válidos de 17 caracteres en el texto.' : undefined,
      });
    }

    const ai = getAi();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'La clave de Gemini (GEMINI_API_KEY) no está configurada en el servidor.',
        vehicles: [],
      });
    }

    const sanitizeBase64 = (raw: string) => {
      if (!raw) return '';
      return raw.replace(/^data:[^;]+;base64,/, '').trim();
    };

    const userPrompt = 'Escanea la imagen completa de arriba a abajo y extrae TODOS los números VIN de 17 caracteres presentes sin omitir ninguna fila.';
    let contentsPayload: any;

    if (images && Array.isArray(images) && images.length > 0) {
      const parts: any[] = images
        .map((img: any) => {
          const data = sanitizeBase64(img.imageBase64 || '');
          if (!data) return null;
          return {
            inlineData: {
              data,
              mimeType: img.mimeType || 'image/jpeg',
            },
          };
        })
        .filter(Boolean);

      if (parts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Las imágenes enviadas no contienen datos legibles.',
          vehicles: [],
        });
      }

      parts.push({ text: userPrompt });
      contentsPayload = { parts };
    } else if (imageBase64) {
      const cleanBase64 = sanitizeBase64(imageBase64);
      if (!cleanBase64) {
        return res.status(400).json({
          success: false,
          error: 'La imagen enviada no contiene datos legibles.',
          vehicles: [],
        });
      }
      contentsPayload = {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || 'image/jpeg',
            },
          },
          { text: userPrompt },
        ],
      };
    }

    const attempts: Array<{ model: string; thinkingLevel: ThinkingLevel; timeoutMs: number }> = [
      { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, timeoutMs: 14000 },
      { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 18000 },
    ];

    let lastError: any = null;
    let responseText: string | null = null;
    let usedModel: string | null = null;

    for (let idx = 0; idx < attempts.length; idx++) {
      const { model, thinkingLevel, timeoutMs } = attempts[idx];
      let timer: NodeJS.Timeout | null = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`TIMEOUT_${timeoutMs}MS`)), timeoutMs);
        });

        const generatePromise: Promise<GenerateContentResponse> = ai.models.generateContent({
          model,
          contents: contentsPayload,
          config: {
            systemInstruction: VIN_SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingLevel },
            responseMimeType: 'application/json',
            responseSchema: VIN_RESPONSE_SCHEMA,
          },
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (timer) clearTimeout(timer);

        if (response && response.text) {
          // If first fast model returned empty vehicles array, allow fallback to gemini-4-hydrogen once
          let hasAnyVehicle = true;
          try {
            const quickCheck = JSON.parse(response.text);
            if (Array.isArray(quickCheck?.vehicles) && quickCheck.vehicles.length === 0) {
              hasAnyVehicle = false;
            }
          } catch {
            // Let full parser handle it
          }

          responseText = response.text;
          usedModel = model;
          if (hasAnyVehicle || idx === attempts.length - 1) {
            break;
          }
        }
      } catch (err: any) {
        if (timer) clearTimeout(timer);
        lastError = err;
        const status = err?.status || err?.code;
        console.warn(`Intento ${idx + 1} (${model}) falló:`, status || err?.message || err);

        // Don't retry auth/invalid-key errors
        if (status === 400 || status === 401 || status === 403) {
          break;
        }
        if (idx < attempts.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }

    if (!responseText) {
      const status = Number(lastError?.status) || 502;
      const errMsg = String(lastError?.message || '');
      const isQuota = status === 429 || errMsg.includes('RESOURCE_EXHAUSTED');
      const isBusy = status === 503 || errMsg.includes('high demand') || errMsg.includes('TIMEOUT');
      const isAuth = status === 401 || status === 403 || errMsg.includes('API_KEY_INVALID') || errMsg.includes('PERMISSION_DENIED');

      let clientMessage = 'No se pudo completar el análisis visual en este momento. Reintenta con una foto más nítida.';
      if (isAuth) {
        clientMessage = 'La clave API de Gemini no es válida o no tiene permisos. Verifica Secrets en la configuración.';
      } else if (isQuota) {
        clientMessage = 'Se alcanzó el límite temporal de solicitudes. Espera unos segundos e intenta de nuevo.';
      } else if (isBusy) {
        clientMessage = 'El servicio de visión tardó más de lo esperado o está saturado. Reintenta nuevamente.';
      }

      return res.status(status >= 400 && status < 600 ? status : 502).json({
        success: false,
        error: clientMessage,
        vehicles: [],
      });
    }

    let parsedData: any = {};
    try {
      const cleanJson = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsedData = JSON.parse(cleanJson);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch {
          parsedData = { vehicles: [] };
        }
      } else {
        parsedData = { vehicles: [] };
      }
    }

    if (!parsedData.vehicles || !Array.isArray(parsedData.vehicles) || parsedData.vehicles.length === 0) {
      const fallbackVins = extractVinsLocally(responseText);
      if (fallbackVins.length > 0) {
        parsedData.vehicles = fallbackVins;
      }
    }

    // Strict 17-character ISO 3779 VIN filtering & deduplication
    const seenFinalVins = new Set<string>();
    const cleanedVehicles: any[] = [];

    for (const v of parsedData.vehicles || []) {
      const cleanVin = normalizeVinCandidate(String(v.vin || ''));
      if (cleanVin && !seenFinalVins.has(cleanVin)) {
        seenFinalVins.add(cleanVin);
        cleanedVehicles.push({
          vin: cleanVin,
          make: String(v.make || '').trim(),
          model: String(v.model || '').trim(),
          year: String(v.year || '').trim(),
          color: String(v.color || '').trim(),
          lot: String(v.lot || '').trim(),
          status: String(v.status || 'En patio').trim(),
          notes: String(v.notes || '').trim(),
        });
      }
    }

    // Safety net: scan raw responseText in case any 17-char VIN was missed in parsed array
    if (responseText) {
      const extraTokens = responseText.match(/[A-Za-z0-9\-_*.:]{17,24}/g) || [];
      for (const raw of extraTokens) {
        const fixed = normalizeVinCandidate(raw);
        if (fixed && !seenFinalVins.has(fixed)) {
          seenFinalVins.add(fixed);
          cleanedVehicles.push({
            vin: fixed,
            make: '',
            model: '',
            year: '',
            color: '',
            lot: '',
            status: 'En patio',
            notes: '',
          });
        }
      }
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(`[VIN Scan] model=${usedModel} count=${cleanedVehicles.length} time=${elapsedMs}ms`);

    if (cleanedVehicles.length === 0) {
      return res.json({
        success: false,
        error: 'No se detectó ningún número VIN válido de 17 caracteres en la foto. Enfoca la etiqueta de la puerta, el parabrisas o la planilla.',
        vehicles: [],
      });
    }

    return res.json({
      success: true,
      title: parsedData.title || 'Inventario VIN',
      summary: `Se detectaron ${cleanedVehicles.length} número(s) VIN de 17 caracteres.`,
      aiModel: usedModel || 'gemini-4-hydrogen',
      elapsedMs,
      vehicles: cleanedVehicles,
    });
  } catch (error: any) {
    console.error('Error en /api/extract-vin:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la imagen. Intenta nuevamente.',
      vehicles: [],
    });
  }
});

// Resilient error handler for payload limits and bad JSON requests
app.use((err: any, _req: Request, res: Response, next: any) => {
  if (err) {
    console.error('Aviso de Middleware de Express:', err?.message || err);
    return res.status(err.status || 400).json({
      success: false,
      error: err.type === 'entity.too.large'
        ? 'El archivo es demasiado pesado para el servidor. Prueba seleccionando una foto más liviana.'
        : 'Error al interpretar los datos enviados. Intenta con otra foto.',
      vehicles: [],
    });
  }
  next();
});

const httpServer = http.createServer(app);

// Serve frontend in production or mount vite in development
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`AutoPrint VIN Server running on http://localhost:${PORT}`);
});
