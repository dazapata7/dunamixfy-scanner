// =====================================================
// CSV IMPORTER - Dunamix WMS
// =====================================================
// Importador de CSV para cualquier transportadora soportada
// Preview, validación, importación y reporte de errores
// =====================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { csvImportService } from '../../services/csvImportService';
import { carriersService } from '../../services/supabase';
import {
  ArrowLeft, Upload, FileText, CheckCircle2, XCircle,
  AlertTriangle, Truck
} from 'lucide-react';
import toast from 'react-hot-toast';

// Transportadoras que soportan importación por CSV
const CSV_SUPPORTED_CARRIERS = ['interrapidisimo', 'coordinadora'];

// Notas informativas por transportadora
const CARRIER_NOTES = {
  interrapidisimo: {
    color: 'blue',
    title: 'Interrápidisimo',
    note: 'Exporta desde Dunamix → sección Interrápidisimo. Las guías quedarán listas para escanear.',
  },
  coordinadora: {
    color: 'orange',
    title: 'Coordinadora',
    note: 'Al escanear, se validará cada guía contra la API de Dunamixfy (can_ship). El CSV pre-carga los datos del cliente y tienda.',
  },
};

export function CSVImporter() {
  const navigate = useNavigate();
  const { operatorId } = useStore();
  const fileInputRef = useRef(null);

  const [carriers, setCarriers] = useState([]);
  const [selectedCarrier, setSelectedCarrier] = useState(null); // objeto carrier
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(true);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [validation, setValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 100, message: '' });

  // Cargar transportadoras soportadas al montar
  useEffect(() => {
    loadCarriers();
  }, []);

  async function loadCarriers() {
    setIsLoadingCarriers(true);
    try {
      const all = await carriersService.getAll();
      const supported = all.filter(c => CSV_SUPPORTED_CARRIERS.includes(c.code));
      setCarriers(supported);
      // Seleccionar Interrápidisimo por defecto (backward compat)
      const interrapidisimo = supported.find(c => c.code === 'interrapidisimo');
      setSelectedCarrier(interrapidisimo || supported[0] || null);
    } catch (error) {
      console.error('❌ Error al cargar transportadoras:', error);
      toast.error('Error al cargar transportadoras');
    } finally {
      setIsLoadingCarriers(false);
    }
  }

  function handleCarrierChange(carrierId) {
    const carrier = carriers.find(c => c.id === carrierId);
    setSelectedCarrier(carrier || null);
    // Resetear archivo si cambia la transportadora
    handleReset();
  }

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      toast.error('El archivo debe ser CSV (.csv) o Excel (.xlsx, .xls)');
      return;
    }

    setFile(selectedFile);
    setImportResult(null);
    await validateAndPreview(selectedFile);
  };

  const validateAndPreview = async (file) => {
    setIsValidating(true);
    setPreview(null);
    setValidation(null);

    try {
      const result = await csvImportService.validateCSVFormat(file);

      if (!result.valid) {
        toast.error(result.error || 'Archivo inválido');
        setValidation(result);
        return;
      }

      setPreview(result.preview);
      setValidation(result);

      if (result.validationErrors && result.validationErrors.length > 0) {
        toast.error(`${result.validationErrors.length} errores encontrados en el archivo`);
      } else {
        toast.success(`Archivo válido: ${result.totalRows} filas`);
      }
    } catch (error) {
      console.error('❌ Error al validar archivo:', error);
      toast.error('Error al validar el archivo');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedCarrier) {
      toast.error('Seleccione transportadora y archivo');
      return;
    }

    if (validation && !validation.valid) {
      toast.error('El archivo tiene errores. Corrígelos antes de importar.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: 100, message: 'Iniciando...' });

    try {
      const result = await csvImportService.importCSV(
        file,
        selectedCarrier.id,
        operatorId,
        (current, total, message) => setImportProgress({ current, total, message })
      );

      setImportResult(result);

      if (result.errorCount === 0) {
        toast.success(`✅ ${result.successCount} envíos importados exitosamente`);
      } else {
        toast.error(`⚠️ ${result.errorCount} errores. ${result.successCount} exitosos.`);
      }

      // Limpiar archivo
      setFile(null);
      setPreview(null);
      setValidation(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error) {
      console.error('❌ Error al importar CSV:', error);
      toast.error(error.message || 'Error al importar el archivo');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setValidation(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const carrierNote = selectedCarrier ? CARRIER_NOTES[selectedCarrier.code] : null;
  const noteColors = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', title: 'text-blue-300', text: 'text-blue-200/80' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', title: 'text-orange-300', text: 'text-orange-200/80' },
  };
  const nc = carrierNote ? noteColors[carrierNote.color] : noteColors.blue;

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Volver – solo móvil */}
        <button
          onClick={() => navigate('/wms')}
          className="lg:hidden mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Selector de transportadora */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5 mb-4">
          <label className="block text-white/50 text-xs uppercase tracking-wider mb-3">
            Transportadora
          </label>

          {isLoadingCarriers ? (
            <div className="flex items-center gap-2 text-white/40 text-sm py-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              Cargando transportadoras...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {carriers.map(carrier => {
                const isSelected = selectedCarrier?.id === carrier.id;
                const note = CARRIER_NOTES[carrier.code];
                const isCoord = carrier.code === 'coordinadora';
                return (
                  <button
                    key={carrier.id}
                    type="button"
                    onClick={() => handleCarrierChange(carrier.id)}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                      ${isSelected
                        ? isCoord
                          ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                          : 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                        : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }
                    `}
                  >
                    <div className={`p-1.5 rounded-lg ${isSelected ? (isCoord ? 'bg-orange-500/20' : 'bg-blue-500/20') : 'bg-white/10'}`}>
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{carrier.display_name || carrier.name}</p>
                      <p className={`text-[11px] mt-0.5 ${isSelected ? 'opacity-70' : 'opacity-40'}`}>
                        {note?.note.slice(0, 55)}…
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 ml-auto flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Nota informativa del carrier seleccionado */}
          {carrierNote && !isLoadingCarriers && (
            <div className={`mt-3 p-3 rounded-xl ${nc.bg} border ${nc.border}`}>
              <p className={`text-xs ${nc.text}`}>{carrierNote.note}</p>
            </div>
          )}
        </div>

        {/* Zona de carga de archivo */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5 mb-4">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Archivo</p>

          <label
            htmlFor="csv-upload"
            className={`
              block w-full p-8 rounded-xl border-2 border-dashed
              ${file ? 'border-green-500/50 bg-green-500/5' : 'border-white/20 bg-white/5'}
              hover:border-white/40 hover:bg-white/10
              cursor-pointer transition-all text-center
              ${!selectedCarrier ? 'opacity-40 pointer-events-none' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              id="csv-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={!selectedCarrier}
            />

            <div className="flex flex-col items-center gap-3">
              {file ? (
                <>
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                  <div>
                    <p className="text-white font-medium text-sm">{file.name}</p>
                    <p className="text-white/50 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-white/30" />
                  <div>
                    <p className="text-white/70 font-medium text-sm">
                      {selectedCarrier ? 'Click para seleccionar archivo' : 'Selecciona una transportadora primero'}
                    </p>
                    <p className="text-white/40 text-xs mt-1">Excel (.xlsx) o CSV (.csv)</p>
                  </div>
                </>
              )}
            </div>
          </label>

          {file && (
            <button
              onClick={handleReset}
              className="mt-3 w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all text-sm"
            >
              Cambiar archivo
            </button>
          )}
        </div>

        {/* Validando */}
        {isValidating && (
          <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5 mb-4">
            <div className="flex items-center gap-3 text-white/70">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-sm">Validando archivo...</span>
            </div>
          </div>
        )}

        {/* Progreso de importación */}
        {isImporting && (
          <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white text-sm font-medium flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Importando {selectedCarrier?.display_name || selectedCarrier?.name}...
              </span>
              <span className="text-white font-bold">{importProgress.current}%</span>
            </div>
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${importProgress.current}%` }}
              />
            </div>
            {importProgress.message && (
              <p className="text-white/50 text-xs">{importProgress.message}</p>
            )}
          </div>
        )}

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5 mb-4">
            <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-white/50" />
              Preview — primeras {preview.length} filas
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/40 px-3 py-2 font-medium text-xs">#</th>
                    <th className="text-left text-white/40 px-3 py-2 font-medium text-xs">Guía</th>
                    <th className="text-left text-white/40 px-3 py-2 font-medium text-xs">SKU</th>
                    <th className="text-left text-white/40 px-3 py-2 font-medium text-xs">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="text-white/30 px-3 py-2 text-xs">{i + 1}</td>
                      <td className="text-white font-mono px-3 py-2 text-xs">{row.guide_code}</td>
                      <td className="text-white/70 px-3 py-2 text-xs">{row.sku}</td>
                      <td className="text-white px-3 py-2 text-xs">{row.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {validation && validation.totalRows > preview.length && (
              <p className="mt-3 text-white/40 text-xs text-center">
                +{validation.totalRows - preview.length} filas más
              </p>
            )}
          </div>
        )}

        {/* Errores de validación */}
        {validation && validation.validationErrors && validation.validationErrors.length > 0 && (
          <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl border border-red-500/30 p-5 mb-4">
            <h3 className="text-red-300 font-semibold text-sm mb-3 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Errores de Validación ({validation.validationErrors.length})
            </h3>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {validation.validationErrors.map((error, i) => (
                <div key={i} className="px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <p className="text-red-200/80 text-xs">
                    <span className="font-mono text-red-300">Fila {error.row}:</span> {error.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultado de importación */}
        {importResult && (
          <div className={`
            backdrop-blur-xl rounded-2xl border p-5 mb-4
            ${importResult.errorCount === 0
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-orange-500/10 border-orange-500/30'
            }
          `}>
            <h3 className={`font-semibold text-sm mb-4 flex items-center gap-2 ${importResult.errorCount === 0 ? 'text-green-300' : 'text-orange-300'}`}>
              {importResult.errorCount === 0
                ? <><CheckCircle2 className="w-5 h-5" /> Importación Exitosa</>
                : <><AlertTriangle className="w-5 h-5" /> Importación Parcial</>
              }
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-green-200/50 text-xs mb-1">Exitosos</p>
                <p className="text-green-300 text-3xl font-bold">{importResult.successCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-red-200/50 text-xs mb-1">Errores</p>
                <p className="text-red-300 text-3xl font-bold">{importResult.errorCount}</p>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div>
                <p className="text-orange-200/60 text-xs font-medium mb-2">Detalles:</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((error, i) => (
                    <div key={i} className="px-2 py-1.5 rounded bg-red-500/5 border border-red-500/15 text-xs">
                      <span className="font-mono text-red-300">Fila {error.row}:</span>
                      <span className="text-red-200/70 ml-1">{error.message}</span>
                    </div>
                  ))}
                </div>
                {importResult.errors.length > 10 && (
                  <p className="text-orange-200/40 text-xs mt-2">+{importResult.errors.length - 10} errores más...</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Botón importar */}
        {file && validation && (
          <button
            onClick={handleImport}
            disabled={isImporting || !validation.valid || !selectedCarrier}
            className={`
              w-full px-6 py-4 rounded-xl font-medium
              flex items-center justify-center gap-2 transition-all
              ${validation.valid && selectedCarrier
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-blue-500/20'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
              }
              disabled:opacity-50
            `}
          >
            {isImporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {importProgress.current > 0 ? `${importProgress.current}%` : 'Importando...'}
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Importar {validation.totalRows} envíos
                {selectedCarrier && <span className="opacity-60 text-sm">· {selectedCarrier.display_name || selectedCarrier.name}</span>}
              </>
            )}
          </button>
        )}

        <p className="mt-4 text-center text-white/30 text-xs">
          Los envíos importados estarán disponibles al escanear las guías
        </p>
      </div>
    </div>
  );
}

export default CSVImporter;
