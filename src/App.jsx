import { useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useStore } from "./store/useStore";
import { useDeviceType } from "./hooks/useDeviceType";
import { Toaster } from "react-hot-toast";
import { SidebarLayout } from "./components/layout/SidebarLayout";
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
const BatchSummaryPage = lazy(() => import("./components/wms/BatchSummaryPage"));
const DebugGuide = lazy(() => import("./components/wms/DebugGuide"));
const DispatchPreview = lazy(() => import("./components/wms/DispatchPreview"));
const InventoryList = lazy(() => import("./components/wms/InventoryList"));
const CSVImporter = lazy(() => import("./components/wms/CSVImporter"));
const ReceiptForm = lazy(() => import("./components/wms/ReceiptForm"));
const AdjustmentForm = lazy(() => import("./components/wms/AdjustmentForm"));
const DispatchDashboard = lazy(() => import("./components/wms/DispatchDashboard"));
const DispatchHistory = lazy(() => import("./components/wms/DispatchHistory")); // Historial completo
const InventoryHistory = lazy(() => import("./components/wms/InventoryHistory")); // Historial movimientos inventario
const ScanHistory = lazy(() => import("./components/wms/ScanHistory"));
const WarehouseManagement = lazy(() => import("./components/wms/WarehouseManagement"));
const ProductManagement = lazy(() => import("./components/wms/ProductManagement"));

// Remote Scanner Components
const RemoteScannerHost = lazy(() => import("./components/wms/RemoteScannerHost"));
const RemoteScannerClient = lazy(() => import("./components/wms/RemoteScannerClient"));

// Role-based Components
const RegisterCompany = lazy(() => import("./components/RegisterCompany"));
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard"));
const ManageBodegas = lazy(() => import("./components/admin/ManageBodegas"));
const ManageOperators = lazy(() => import("./components/admin/ManageOperators"));
const SuperAdminDashboard = lazy(() => import("./components/superadmin/SuperAdminDashboard"));
const UserProfile = lazy(() => import("./components/UserProfile"));
const MobileWMS = lazy(() => import("./components/mobile/MobileWMS"));

// Componente interno que usa el hook useAuth
function AppContent() {
  const { user, loading } = useAuth();
  const operator = useStore((state) => state.operator);
  const role = useStore((state) => state.role);
  const companyId = useStore((state) => state.companyId);
  const { isMobile } = useDeviceType();
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
          ) : isMobile ? (
            /* ── MÓVIL: solo WMS simplificado + escaneo ── */
            <Routes>
              <Route path="/" element={<MobileWMS />} />
              <Route path="/wms/select-warehouse" element={<WarehouseSelector />} />
              <Route path="/wms/scan-guide" element={<ScanGuide />} />
              <Route path="/wms/batch-summary" element={<BatchSummaryPage />} />
              {/* Remote scanner client (el móvil puede actuar como scanner remoto) */}
              <Route path="/wms/remote-scanner/client/:sessionCode" element={<RemoteScannerClient />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          ) : (
            /* ── DESKTOP / TABLET: app completa con sidebar ── */
            <>
              <SidebarLayout />
              <div className="lg:ml-60">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<UserProfile />} />
                  <Route path="/register-company" element={<RegisterCompany />} />

                  {(role === 'admin' || role === 'superadmin') && (
                    <>
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/bodegas" element={<ManageBodegas />} />
                      <Route path="/admin/operadores" element={<ManageOperators />} />
                    </>
                  )}
                  {role === 'superadmin' && (
                    <Route path="/superadmin" element={<SuperAdminDashboard />} />
                  )}

                  <Route path="/wms" element={<WMSHome />} />
                  <Route path="/wms/select-warehouse" element={<WarehouseSelector />} />
                  <Route path="/wms/batch-summary" element={<BatchSummaryPage />} />
                  <Route path="/wms/remote-scanner/host" element={<RemoteScannerHost />} />
                  <Route path="/wms/remote-scanner/client/:sessionCode" element={<RemoteScannerClient />} />
                  <Route path="/wms/debug-guide" element={<DebugGuide />} />
                  <Route path="/wms/inventory" element={<InventoryList />} />
                  <Route path="/wms/import-csv" element={<CSVImporter />} />
                  <Route path="/wms/receipt" element={<ReceiptForm />} />
                  <Route path="/wms/adjustment" element={<AdjustmentForm />} />
                  <Route path="/wms/dashboard" element={<DispatchDashboard />} />
                  <Route path="/wms/history" element={<DispatchHistory />} />
                  <Route path="/wms/inventory-history" element={<InventoryHistory />} />
                  <Route path="/wms/scan-history" element={<ScanHistory />} />
                  <Route path="/wms/manage-warehouses" element={<WarehouseManagement />} />
                  <Route path="/wms/manage-products" element={<ProductManagement />} />

                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </div>
            </>
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
            <Route path="/wms/batch-summary" element={<BatchSummaryPage />} />

            {/* Remote Scanner Routes */}
            <Route path="/wms/remote-scanner/host" element={<RemoteScannerHost />} />
            <Route path="/wms/remote-scanner/client/:sessionCode" element={<RemoteScannerClient />} />
            <Route path="/wms/debug-guide" element={<DebugGuide />} />
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
