import { useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useStore } from "./store/useStore";
import { Toaster } from "react-hot-toast";
import "./App.css";

// V4: Code-Splitting - Lazy load de componentes pesados
// Esto reduce el bundle inicial de 862KB a ~200-300KB
const Login = lazy(() => import("./components/Login"));
const LoginAuth = lazy(() => import("./components/LoginAuth"));
const Dashboard = lazy(() => import("./components/Dashboard"));

// WMS Components
const WMSHome = lazy(() => import("./components/wms/WMSHome"));
const WarehouseSelector = lazy(() => import("./components/wms/WarehouseSelector"));
const ScanGuide = lazy(() => import("./components/wms/ScanGuide"));
const DispatchPreview = lazy(() => import("./components/wms/DispatchPreview"));
const InventoryList = lazy(() => import("./components/wms/InventoryList"));
const CSVImporter = lazy(() => import("./components/wms/CSVImporter"));
const ReceiptForm = lazy(() => import("./components/wms/ReceiptForm"));
const AdjustmentForm = lazy(() => import("./components/wms/AdjustmentForm"));
const DispatchDashboard = lazy(() => import("./components/wms/DispatchDashboard"));
const DispatchHistory = lazy(() => import("./components/wms/DispatchHistory")); // Historial completo
const ScanHistory = lazy(() => import("./components/wms/ScanHistory"));
const WarehouseManagement = lazy(() => import("./components/wms/WarehouseManagement"));
const ProductManagement = lazy(() => import("./components/wms/ProductManagement"));

// Componente interno que usa el hook useAuth
function AppContent() {
  const { user, loading } = useAuth();
  const operator = useStore((state) => state.operator);
  const [useRealAuth, setUseRealAuth] = useState(true); // Toggle para activar auth real

  // V4: Componente de loading reutilizable para Suspense y auth
  const LoadingScreen = ({ message = "Cargando..." }) => (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400 text-lg font-medium">{message}</p>
      </div>
    </div>
  );

  // Mostrar loading mientras verifica la sesión
  if (loading && useRealAuth) {
    return <LoadingScreen message="Verificando sesión..." />;
  }

  // Si está activada la autenticación real
  if (useRealAuth) {
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          {!user ? (
            <Routes>
              <Route path="/" element={<LoginAuth />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />

              {/* WMS Routes */}
              <Route path="/wms" element={<WMSHome />} />
              <Route path="/wms/select-warehouse" element={<WarehouseSelector />} />
              <Route path="/wms/scan-guide" element={<ScanGuide />} />
              <Route path="/wms/inventory" element={<InventoryList />} />
              <Route path="/wms/import-csv" element={<CSVImporter />} />
              <Route path="/wms/receipt" element={<ReceiptForm />} />
              <Route path="/wms/adjustment" element={<AdjustmentForm />} />
              <Route path="/wms/dashboard" element={<DispatchDashboard />} />
              <Route path="/wms/history" element={<DispatchHistory />} /> {/* Historial completo */}
              <Route path="/wms/scan-history" element={<ScanHistory />} /> {/* Historial antiguo */}
              <Route path="/wms/manage-warehouses" element={<WarehouseManagement />} />
              <Route path="/wms/manage-products" element={<ProductManagement />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          )}
        </Suspense>
      </BrowserRouter>
    );
  }

  // Modo legacy (sin auth real)
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        {!operator ? (
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />

            {/* WMS Routes */}
            <Route path="/wms" element={<WMSHome />} />
            <Route path="/wms/select-warehouse" element={<WarehouseSelector />} />
            <Route path="/wms/scan-guide" element={<ScanGuide />} />
            <Route path="/wms/inventory" element={<InventoryList />} />
            <Route path="/wms/import-csv" element={<CSVImporter />} />
            <Route path="/wms/receipt" element={<ReceiptForm />} />
            <Route path="/wms/adjustment" element={<AdjustmentForm />} />
            <Route path="/wms/dashboard" element={<DispatchDashboard />} />
            <Route path="/wms/history" element={<ScanHistory />} />
            <Route path="/wms/manage-warehouses" element={<WarehouseManagement />} />
            <Route path="/wms/manage-products" element={<ProductManagement />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        )}
      </Suspense>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: {
            background: "#1a1f2e",
            color: "#fff",
            border: "1px solid #00D9C0",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "600",
          },
          success: {
            iconTheme: {
              primary: "#00D9C0",
              secondary: "#1a1f2e",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#1a1f2e",
            },
          },
        }}
      />
    </AuthProvider>
  );
}

export default App;
