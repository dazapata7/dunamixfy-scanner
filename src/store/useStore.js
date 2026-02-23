import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store global de la aplicación usando Zustand
 * Persiste el operador actual en localStorage
 */
export const useStore = create(
  persist(
    (set, get) => ({
      // Estado del operador
      operator: null,
      operatorId: null,
      selectedStore: null,
      selectedWarehouse: null,  // WMS: Almacén seleccionado

      // Rol y empresa (multi-tenant)
      role: null,          // 'superadmin' | 'admin' | 'operator' | null
      companyId: null,     // UUID de la empresa
      companyName: null,   // Nombre de la empresa para mostrar
      
      // Estadísticas de la sesión
      sessionScans: 0,
      sessionRepeated: 0,
      
      // Estadísticas del día
      todayScans: 0,
      todayStats: {
        coordinadora: 0,
        interrapidisimo: 0,
        byStore: {}
      },
      
      // Cache de códigos (para detección rápida de duplicados)
      codesCache: new Set(),
      
      // Actions
      setOperator: (name, id) => set({
        operator: name,
        operatorId: id
      }),

      setUserProfile: (role, companyId, companyName) => set({
        role,
        companyId,
        companyName
      }),
      
      setSelectedStore: (store) => set({ selectedStore: store }),

      setSelectedWarehouse: (warehouse) => set({ selectedWarehouse: warehouse }),
      
      logout: () => set({
        operator: null,
        operatorId: null,
        selectedStore: null,
        selectedWarehouse: null,
        role: null,
        companyId: null,
        companyName: null,
        sessionScans: 0,
        sessionRepeated: 0
      }),
      
      incrementSessionScans: () => set((state) => ({ 
        sessionScans: state.sessionScans + 1 
      })),
      
      incrementSessionRepeated: () => set((state) => ({ 
        sessionRepeated: state.sessionRepeated + 1 
      })),
      
      setTodayScans: (count) => set({ todayScans: count }),
      
      setTodayStats: (stats) => set({ todayStats: stats }),
      
      addToCache: (code) => set((state) => {
        const newCache = new Set(state.codesCache);
        newCache.add(code);
        return { codesCache: newCache };
      }),
      
      isInCache: (code) => {
        return get().codesCache.has(code);
      },
      
      loadCachefromDB: (codes) => set({ 
        codesCache: new Set(codes.map(c => c.code)) 
      }),
      
      clearCache: () => set({ codesCache: new Set() })
    }),
    {
      name: 'dunamix-storage',
      partialize: (state) => ({
        operator: state.operator,
        operatorId: state.operatorId,
        selectedStore: state.selectedStore,
        selectedWarehouse: state.selectedWarehouse,
        role: state.role,
        companyId: state.companyId,
        companyName: state.companyName
      })
    }
  )
);
