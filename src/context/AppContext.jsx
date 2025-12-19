import React, { createContext, useContext, useMemo } from 'react';

const AppContext = createContext();

export const MASTER_TENANT_ID = "1750857959135x773523250945720300";

export const AppProvider = ({ children }) => {
  // Use window.location.search directly to avoid hook dependency issues during initialization
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const contextValue = useMemo(() => {
    // 1. Read URL parameters (prioritize 'id' and 'tenant_id' as requested)
    // Extract id (user ID) from URL
    const paramId = searchParams.get('id');
    const paramUserId = searchParams.get('userId'); // fallback
    
    // Extract tenant_id (company ID) from URL
    const paramTenantIdShort = searchParams.get('tenant_id');
    const paramTenantIdLong = searchParams.get('tenantId'); // fallback
    
    const paramCompanyName = searchParams.get('companyName');
    const paramUsername = searchParams.get('username');

    // Resolve final values
    const userId = paramId || paramUserId || "1746024278611x958627040674540500";
    const tenantId = paramTenantIdShort || paramTenantIdLong || MASTER_TENANT_ID;
    const username = paramUsername || "Feliciano";
    const companyName = paramCompanyName || "beemotik";

    // 2. Admin access logic
    const isAdmin = tenantId === MASTER_TENANT_ID;

    // Check if any of the specific parameters are present to trigger embedded mode logic if needed
    // But mainly we rely on isAdmin for sidebar visibility now
    const hasUrlParams = [paramId, paramUserId, paramTenantIdShort, paramTenantIdLong].some(val => val !== null);

    return {
      username,
      userId,
      companyName,
      tenantId,
      isAdmin,
      isEmbedded: hasUrlParams, // kept for backward compatibility if used elsewhere
      searchParams
    };
  }, [searchParams]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};