import React, { useState, useEffect } from 'react';
import FilterBar from '@/components/FilterBar';
import ScoresCard from '@/components/ScoresCard';
import BadCommentsCard from '@/components/BadCommentsCard';
import MeetingsCard from '@/components/MeetingsCard';
import TimelineCard from '@/components/TimelineCard';
import MeetingDrawer from '@/components/MeetingDrawer';
import { useMeetings } from '@/hooks/useMeetings';
import { AlertCircle } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';

// Advanced Tenant Mapping Configuration
const TENANT_CONFIG = {
  '1746648297278x228824935168213000': {
    options: ['cacau-cristian-001'],
    defaultOption: 'cacau-cristian-001',
    lock: true
  },
  '1746042759022x580092293537857500': {
    options: ['sanduba'],
    defaultOption: 'sanduba',
    lock: true
  },
  '1754578523842x310706497185120260': {
    options: [
      'divino-fogão-lojas-proprias',
      'divino-fogão-fora-de-sp',
      'divino-fogão-dentro-de-sp'
    ],
    defaultOption: 'divino-fogão-lojas-proprias',
    lock: false // Explicitly unlocked for this tenant
  }
};

const fetchAllCompanyNames = async (tenantId) => {
  try {
    const url = `https://n8n.beemotik.com/webhook/reunioesdatameet?tenantId=${tenantId}&from=2000-01-01&to=2099-12-31`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Error fetching company names: ${response.status}`);
      return [];
    }
    const data = await response.json();
    const companyNames = [...new Set(data.map(m => m.companyName).filter(Boolean))];
    return companyNames.sort();
  } catch (error) {
    console.error('Failed to fetch all company names:', error);
    return [];
  }
};

const Dashboard = () => {
  const { tenantId, companyName, isAdmin } = useAppContext();
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [isDropdownLocked, setIsDropdownLocked] = useState(false);

  // Initialize filters with context values
  const [filters, setFilters] = useState({
    tenantId: tenantId,
    companyName: '', 
    storeName: '',
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    auditor: '',
    status: 'Todas'
  });

  const [appliedFilters, setAppliedFilters] = useState({
    tenantId: tenantId,
    companyName: '',
    storeName: '',
    from: '',
    to: '',
    auditor: '',
    status: 'Todas'
  });

  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // If context changes, update filters
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      tenantId: tenantId
    }));
  }, [tenantId]);

  const {
    meetings,
    loading,
    error
  } = useMeetings(appliedFilters);

  useEffect(() => {
    const initCompanies = async () => {
      setCompaniesLoading(true);

      // Check if current tenant has a specific configuration
      const tenantConfig = TENANT_CONFIG[filters.tenantId];

      if (tenantConfig) {
        // Use configured options
        setAvailableCompanies(tenantConfig.options);
        
        // Set lock state from config
        setIsDropdownLocked(tenantConfig.lock);
        
        // Auto-select default if not already selected
        if (!filters.companyName || !tenantConfig.options.includes(filters.companyName)) {
           const defaultComp = tenantConfig.defaultOption;
           setFilters(prev => ({ ...prev, companyName: defaultComp }));
           
           // Auto-apply if we have dates
           if (filters.from && filters.to) {
             setAppliedFilters(prev => ({
               ...prev,
               tenantId: filters.tenantId,
               companyName: defaultComp,
               from: filters.from,
               to: filters.to
             }));
           }
        }
      } else {
        // Fallback to API fetch for unknown tenants
        const companies = await fetchAllCompanyNames(filters.tenantId);
        setAvailableCompanies(companies);
        
        // Determine lock state: Lock if only 1 company found, otherwise unlock
        setIsDropdownLocked(companies.length <= 1);
        
        // Auto-select if there's only one company or matches context
        let autoFill = '';
        if (companyName && companies.includes(companyName)) {
          autoFill = companyName;
        } else if (companies.length === 1) {
          autoFill = companies[0];
        }

        if (autoFill) {
           setFilters(prev => ({ ...prev, companyName: autoFill }));
           if (filters.from && filters.to) {
            setAppliedFilters(prev => ({
              ...prev,
              tenantId: filters.tenantId,
              companyName: autoFill,
              from: filters.from,
              to: filters.to
            }));
          }
        }
      }
      setCompaniesLoading(false);
    };

    if (filters.tenantId) {
      initCompanies();
    }
  }, [filters.tenantId, companyName]); 


  const handleFilterChange = newFilters => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  };

  const handleApplyFilters = () => {
    if (filters.companyName && filters.from && filters.to) {
      setAppliedFilters(filters);
    }
  };

  const handleMeetingClick = meeting => {
    setSelectedMeeting(meeting);
    setDrawerOpen(true);
  };

  const hasAppliedFilters = appliedFilters.companyName && appliedFilters.from && appliedFilters.to;

  return (
    <div className="min-h-full bg-[#1B1B1B]">
      {isAdmin && (
        <header className="bg-[#2F2F2F] border-b border-[#3C4144] px-6 py-4">
          <h1 className="text-2xl font-domine font-bold text-white">Reuniões</h1>
        </header>
      )}

      <FilterBar 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        onApply={handleApplyFilters}
        meetings={meetings}
        availableCompanies={availableCompanies}
        companiesLoading={companiesLoading}
        isDropdownLocked={isDropdownLocked}
      />

      <main className="p-6 space-y-10 pb-20">
        {!hasAppliedFilters ? (
           <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
             <AlertCircle className="w-12 h-12 mb-4 text-gold-light" />
             <h2 className="text-xl font-domine font-semibold text-white mb-2">Selecione os Filtros</h2>
             <p className="max-w-md text-center font-manrope">
               Para visualizar o dashboard, por favor selecione uma <strong>Empresa</strong> e o <strong>Período</strong> desejado e clique em "Filtrar".
             </p>
           </div>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 min-h-[700px]">
              <ScoresCard 
                meetings={meetings} 
                loading={loading} 
                filters={appliedFilters} 
              />
              <BadCommentsCard 
                meetings={meetings}
                loading={loading}
              />
            </div>

            <div className="min-h-[700px]">
              <MeetingsCard 
                meetings={meetings}
                loading={loading}
                onMeetingClick={handleMeetingClick}
              />
            </div>

            <div className="min-h-[700px]">
              <TimelineCard 
                meetings={meetings}
                loading={loading}
              />
            </div>
          </>
        )}
      </main>

      <MeetingDrawer meeting={selectedMeeting} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
};

export default Dashboard;