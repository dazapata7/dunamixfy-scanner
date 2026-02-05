// =====================================================
// CSV IMPORTER - Dunamix WMS
// =====================================================
// Importador de CSV para Interrápidisimo
// Preview, validación, importación y reporte de errores
// =====================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { csvImportService } from '../../services/csvImportService';
import { carriersService } from '../../services/supabase';
import { ArrowLeft, Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export function CSVImporter() {
  const navigate = useNavigate();
  const { operatorId } = useStore();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [validation, setValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Carrier ID de Interrápidisimo (hardcoded por ahora, podría ser dinámico)
  const [carrierId, setCarrierId] = useState(null);

  // Cargar carrier ID al montar
  useEffect(() => {
    loadInterrapidisimoCarrier();
  }, []);

  async function loadInterrapidisimoCarrier() {
    try {
      const carriers = await carriersService.getAll();
      const interrapidisimo = carriers.find(c => c.code === 'interrapidisimo');
      if (interrapidisimo) {
        setCarrierId(interrapidisimo.id);
      } else {
        toast.error('No se encontró la transportadora Interrápidisimo');
      }
    } catch (error) {
      console.error('❌ Error al cargar transportadora:', error);
    }
  }

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    // Validar que sea CSV o Excel
    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      toast.error('El archivo debe ser formato CSV (.csv) o Excel (.xlsx, .xls)');
      return;
    }

    setFile(selectedFile);
    setImportResult(null);

    // Validar y mostrar preview
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
    if (!file || !carrierId) {
      toast.error('Seleccione un archivo válido');
      return;
    }

    if (validation && !validation.valid) {
      toast.error('El archivo tiene errores. Corrígelos antes de importar.');
      return;
    }

    setIsImporting(true);

    try {
      const result = await csvImportService.importInterrapidisimoCSV(
        file,
        carrierId,
        operatorId
      );

      setImportResult(result);

      if (result.errorCount === 0) {
        toast.success(`✅ ${result.successCount} envíos importados exitosamente`);
      } else {
        toast.error(`⚠️ ${result.errorCount} errores al importar. ${result.successCount} exitosos.`);
      }

      // Limpiar formulario
      setFile(null);
      setPreview(null);
      setValidation(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <button
          onClick={() => navigate('/wms')}
          className="mb-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Title Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 rounded-2xl bg-blue-500/20">
              <Upload className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Importar CSV
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Envíos de Interrápidisimo
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <h3 className="text-blue-300 font-medium mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Formato Soportado
            </h3>
            <p className="text-blue-200/80 text-sm mb-2">
              Exportación directa desde Dunamix:
            </p>
            <ul className="text-blue-200/80 text-sm space-y-1 ml-4 list-disc">
              <li>Archivo Excel (.xlsx, .xls)</li>
              <li>CSV (.csv) con columnas: NÚMERO GUIA, SKU, CANTIDAD</li>
            </ul>
            <p className="text-blue-200/60 text-xs mt-3">
              💡 Puedes subir el archivo tal como se descarga de Dunamix
            </p>
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
          <label
            htmlFor="csv-upload"
            className={`
              block w-full p-8 rounded-2xl border-2 border-dashed
              ${file ? 'border-green-500/50 bg-green-500/5' : 'border-white/20 bg-white/5'}
              hover:border-white/40 hover:bg-white/10
              cursor-pointer transition-all
              text-center
            `}
          >
            <input
              ref={fileInputRef}
              id="csv-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
              {file ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-green-400" />
                  <div>
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-white/60 text-sm mt-1">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-white/40" />
                  <div>
                    <p className="text-white font-medium">
                      Click para seleccionar archivo
                    </p>
                    <p className="text-white/60 text-sm mt-1">
                      Excel (.xlsx) o CSV (.csv)
                    </p>
                  </div>
                </>
              )}
            </div>
          </label>

          {file && (
            <button
              onClick={handleReset}
              className="mt-4 w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all text-sm"
            >
              Cambiar archivo
            </button>
          )}
        </div>

        {/* Validating */}
        {isValidating && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-glass-lg mb-6">
            <div className="flex items-center gap-3 text-white/80">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Validando archivo...</span>
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Preview (primeras {preview.length} filas)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/60 p-3 font-medium">#</th>
                    <th className="text-left text-white/60 p-3 font-medium">Guide Code</th>
                    <th className="text-left text-white/60 p-3 font-medium">SKU</th>
                    <th className="text-left text-white/60 p-3 font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr key={index} className="border-b border-white/5">
                      <td className="text-white/40 p-3">{index + 1}</td>
                      <td className="text-white font-mono p-3">{row.guide_code}</td>
                      <td className="text-white/80 p-3">{row.sku}</td>
                      <td className="text-white p-3">{row.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {validation && validation.totalRows > preview.length && (
              <p className="mt-4 text-white/60 text-sm text-center">
                +{validation.totalRows - preview.length} filas más...
              </p>
            )}
          </div>
        )}

        {/* Validation Errors */}
        {validation && validation.validationErrors && validation.validationErrors.length > 0 && (
          <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl border border-red-500/30 p-6 shadow-glass-lg mb-6">
            <h3 className="text-red-300 font-bold mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Errores de Validación ({validation.validationErrors.length})
            </h3>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {validation.validationErrors.map((error, index) => (
                <div key={index} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <p className="text-red-200 text-sm">
                    <span className="font-mono text-red-300">Fila {error.row}:</span> {error.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className={`
            backdrop-blur-xl rounded-3xl border p-6 shadow-glass-lg mb-6
            ${importResult.errorCount === 0
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-orange-500/10 border-orange-500/30'
            }
          `}>
            <h3 className={`
              font-bold mb-4 flex items-center gap-2
              ${importResult.errorCount === 0 ? 'text-green-300' : 'text-orange-300'}
            `}>
              {importResult.errorCount === 0 ? (
                <><CheckCircle2 className="w-6 h-6" /> Importación Exitosa</>
              ) : (
                <><AlertTriangle className="w-6 h-6" /> Importación Parcial</>
              )}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-green-200/60 text-xs mb-1">Exitosos</p>
                <p className="text-green-300 text-3xl font-bold">{importResult.successCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-red-200/60 text-xs mb-1">Errores</p>
                <p className="text-red-300 text-3xl font-bold">{importResult.errorCount}</p>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="text-orange-200 font-medium mb-2">Detalles de errores:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20 text-xs">
                      <p className="text-red-200">
                        <span className="font-mono">Fila {error.row}:</span> {error.message}
                      </p>
                    </div>
                  ))}
                </div>
                {importResult.errors.length > 10 && (
                  <p className="text-orange-200/60 text-xs mt-2">
                    +{importResult.errors.length - 10} errores más...
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {file && validation && (
          <div className="flex gap-4">
            <button
              onClick={handleImport}
              disabled={isImporting || !validation.valid}
              className={`
                flex-1 px-6 py-4 rounded-2xl font-medium
                flex items-center justify-center gap-2
                transition-all
                ${validation.valid
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-lg'
                  : 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                }
                disabled:opacity-50
              `}
            >
              {isImporting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Importar {validation.totalRows} Envíos
                </>
              )}
            </button>
          </div>
        )}

        {/* Help */}
        <div className="mt-6 text-center text-white/40 text-sm">
          <p>Los envíos importados estarán disponibles al escanear las guías</p>
        </div>
      </div>
    </div>
  );
}

export default CSVImporter;
