
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAppContext } from '@/context/AppContext';
import { 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  MessageSquare, 
  Building2,
  Calendar,
  User,
  ArrowUpDown,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const ITEMS_PER_PAGE = 10;

// SVG Helper Functions for Gauge
const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y, 
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
};

const NpsDashboard = () => {
  const { tenantId, companyName: contextCompanyName, isAdmin } = useAppContext();
  
  // State
  const [loading, setLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [companies, setCompanies] = useState([]);
  
  // Filters
  const [selectedCompany, setSelectedCompany] = useState(''); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // Modal
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // 3. Non-admin access logic: Restrict editing/changing
  // Only Admin can change company. Others are locked to their tenantId.
  const isCompanyLocked = !isAdmin;

  // --- Effects ---
  
  // 1. Fetch Companies first
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        // Step 1: Resolve the current user's company name from 'empresas' table using tenantId
        // We check both 'id' and 'tenant_id' columns to be safe, prioritizing the one that matches
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresas')
          .select('Name, nome, name')
          .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
          .single();

        let myCompanyName = '';
        if (!empresaError && empresaData) {
          myCompanyName = empresaData.Name || empresaData.nome || empresaData.name || '';
        } else {
          // Fallback to context name if DB fetch fails
          myCompanyName = contextCompanyName || '';
        }

        if (isAdmin) {
          // Admin: Fetch ALL available companies from data source to populate dropdown
          const { data: allCompaniesData, error: allCompaniesError } = await supabase
            .from('chat_agente_nps')
            .select('empresa')
            .not('empresa', 'is', null);

          if (!allCompaniesError && allCompaniesData) {
            const uniqueCompanies = [...new Set(allCompaniesData.map(c => c.empresa))]
              .filter(c => c && c.trim() !== '')
              .sort();
            
            setCompanies(uniqueCompanies);
            
            // Auto-select: If we found a specific company name for this tenantId (e.g. admin's own company or specific param), select it.
            // Otherwise, if list is not empty and nothing selected, select first.
            if (myCompanyName && uniqueCompanies.includes(myCompanyName)) {
               setSelectedCompany(myCompanyName);
            } else if (uniqueCompanies.length > 0 && !selectedCompany) {
               // Optional: Select the first one if no match found (or keep empty to force selection)
               // setSelectedCompany(uniqueCompanies[0]); 
            }
          }
        } else {
          // Non-Admin: Lock to their company
          if (myCompanyName) {
            setCompanies([myCompanyName]);
            setSelectedCompany(myCompanyName);
          } else {
            // Emergency fallback if name not found in 'empresas' but exists in context
             setCompanies(contextCompanyName ? [contextCompanyName] : []);
             setSelectedCompany(contextCompanyName || '');
          }
        }

      } catch (err) {
        console.error("Error fetching companies:", err);
      }
    };
    fetchCompanies();
  }, [tenantId, contextCompanyName, isAdmin]);

  // 2. Fetch Data when company is selected
  useEffect(() => {
    if (selectedCompany && selectedCompany !== 'all') {
      fetchData();
    } else if (selectedCompany === 'all') {
      fetchData();
    } else {
      setFeedbacks([]);
    }
  }, [selectedCompany, tenantId]);

  // --- Data Fetching ---

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('Fetching NPS data for company:', selectedCompany);

      // Fetch ALL rows for the company to reconstruct sessions
      let query = supabase
        .from('chat_agente_nps')
        .select('*')
        .order('created_at', { ascending: false });

      // 3. Non-admin access logic: Only show data for their assigned company
      if (isCompanyLocked) {
        // Double check using tenant_id for security, though company name filter usually covers it if set correctly
        query = query.eq('tennat_id', tenantId);
      }
      
      // If specific company selected
      if (selectedCompany && selectedCompany !== 'all') {
        query = query.eq('empresa', selectedCompany);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      console.log('Raw NPS fetched count:', data?.length);

      // Aggregate Logic
      const sessions = {};
      
      // Iterate through raw data and group by session_id
      (data || []).forEach(row => {
          if (!row.session_id) return;
          
          if (!sessions[row.session_id]) {
              sessions[row.session_id] = {
                  id: row.session_id,
                  session_id: row.session_id,
                  user: row.user, // Will take last found (which is first in desc array)
                  empresa: row.empresa,
                  created_at: row.created_at, // Will take last found (latest)
                  NPS: null,
                  texts: []
              };
          }
          
          const session = sessions[row.session_id];
          
          // Capture NPS if available in this row
          if (row.NPS !== null && row.NPS !== undefined && row.NPS !== '') {
             session.NPS = Number(row.NPS);
          }
          
          // Update User if we have a better one (e.g. not null)
          if (row.user) session.user = row.user;
          
          // Collect text if role is human
          if (row.role === 'human' && row.text && row.text.trim()) {
             const cleanText = row.text.trim();
             // Ignore pure numbers as per instruction to clean comments in list, but don't filter the row
             const isPureNumber = /^\d+$/.test(cleanText);
             if (!isPureNumber) {
                 session.texts.push({ text: cleanText, time: new Date(row.created_at) });
             }
          }
      });
      
      const processedData = Object.values(sessions)
          .filter(session => session.NPS !== null) // Only keep valid feedback sessions (must have score)
          .map(session => {
              // Sort texts chronologically (earliest to latest)
              const sortedTexts = session.texts
                  .sort((a, b) => a.time - b.time)
                  .map(t => t.text);
              
              // Concatenate
              const concatenatedText = sortedTexts.join(' - ');
              
              return {
                 ...session,
                 text: concatenatedText, // This becomes the display comment
                 hasHumanText: sortedTexts.length > 0 
              };
          });

      console.log('Processed NPS (aggregated sessions):', processedData.length);
      setFeedbacks(processedData);

    } catch (error) {
      console.error('Error fetching NPS data:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Computed Data ---

  // 1. Filter
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(item => {
      // Search Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const userMatch = (item.user || '').toLowerCase().includes(term);
        const commentMatch = (item.text || '').toLowerCase().includes(term); 
        const scoreMatch = (item.NPS || '').toString().includes(term);

        if (!userMatch && !commentMatch && !scoreMatch) return false;
      }
      
      return true;
    });
  }, [feedbacks, searchTerm]);

  // 2. Sort
  const sortedFeedbacks = useMemo(() => {
    let sortable = [...filteredFeedbacks];
    if (sortConfig.key) {
      sortable.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        // Handle dates
        if (sortConfig.key === 'created_at') {
            valA = new Date(valA || 0).getTime();
            valB = new Date(valB || 0).getTime();
        }
        // Handle numeric explicitly
        if (sortConfig.key === 'NPS') {
            valA = Number(valA);
            valB = Number(valB);
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [filteredFeedbacks, sortConfig]);

  // 3. Pagination
  const totalPages = Math.ceil(sortedFeedbacks.length / ITEMS_PER_PAGE);
  const paginatedFeedbacks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedFeedbacks.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedFeedbacks, currentPage]);

  // 4. Statistics (NPS Calculation)
  const stats = useMemo(() => {
    const validScores = feedbacks.filter(f => f.NPS !== null);
    
    const total = validScores.length;
    let promoters = 0;
    let passives = 0;
    let detractors = 0;

    validScores.forEach(f => {
      const score = f.NPS;
      if (score >= 9) promoters++;
      else if (score >= 7) passives++;
      else detractors++;
    });

    const npsScore = total > 0 
      ? Math.round(((promoters - detractors) / total) * 100) 
      : 0;

    return { total, promoters, passives, detractors, npsScore };
  }, [feedbacks]);

  // --- Helpers ---

  const getClassification = (score) => {
    if (score >= 9) return { label: 'PROMOTOR', color: 'text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/10' };
    if (score >= 7) return { label: 'NEUTRO', color: 'text-[#facc15] border-[#facc15]/30 bg-[#facc15]/10' };
    return { label: 'DETRATOR', color: 'text-[#f87171] border-[#f87171]/30 bg-[#f87171]/10' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(date);
    } catch { return '-'; }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
    // IMPORTANT: Reset to page 1 when sorting changes to ensure user sees the sorted data from start
    setCurrentPage(1);
  };

  const handleOpenDetails = (feedback) => {
    setSelectedFeedback(feedback);
    setDetailsOpen(true);
  };

  const exportPDF = () => {
    window.print(); 
  };

  // --- Gauge Logic ---
  const calculateNeedleRotation = (score) => {
    // Map score -100..100 to angle 180..360
    if (score <= 0) {
      return 180 + ((score - (-100)) * 0.9);
    } else if (score <= 50) {
      return 270 + (score * 0.9);
    } else {
      return 315 + ((score - 50) * 0.9);
    }
  };

  const needleAngle = calculateNeedleRotation(stats.npsScore);

  // GAUGE VISUAL CONFIG
  // Center: 150, 130 (Moved UP from 150)
  // Radius: 130
  const gaugeCX = 150;
  const gaugeCY = 130; 
  const gaugeR = 130;

  return (
    <div className="min-h-full bg-[#1B1B1B] text-white font-manrope p-6 space-y-8">
      
      {/* Header with Company Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-domine font-bold text-[#E8B930] mb-1">Resultados NPS</h1>
          <p className="text-gray-400 text-sm">Visão geral de satisfação e feedback</p>
        </div>
        
        <div className="flex gap-2">
          {/* 3. Disable/lock the Empresa dropdown if not admin */}
          <Select 
            value={selectedCompany} 
            onValueChange={setSelectedCompany}
            disabled={isCompanyLocked}
          >
            <SelectTrigger className="w-[240px] bg-[#33393D] border-[#4C4E50] text-white h-10 opacity-100 disabled:opacity-80 disabled:cursor-not-allowed">
              <SelectValue placeholder="Selecione uma empresa" />
            </SelectTrigger>
            <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
              {companies.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
             onClick={exportPDF} 
             className="bg-[#E8B930] text-black hover:bg-[#d1a525] font-bold"
             disabled={!selectedCompany}
          >
             Exportar PDF
          </Button>
        </div>
      </div>

      {!selectedCompany ? (
        // --- Empty State ---
        <div className="flex flex-col items-center justify-center h-[500px] border border-[#3C4144] rounded-xl bg-[#252525] p-8 text-center">
          <div className="bg-[#33393D] p-6 rounded-full mb-6">
            <AlertCircle className="w-12 h-12 text-[#E8B930]" />
          </div>
          <h2 className="text-2xl font-domine font-bold text-white mb-2">Selecione uma Empresa</h2>
          <p className="text-gray-400 max-w-md">
            {isCompanyLocked 
              ? "Carregando dados da sua empresa..." 
              : "Para visualizar o dashboard de NPS e os feedbacks recentes, por favor selecione uma empresa no menu acima."}
          </p>
        </div>
      ) : (
        <>
          {/* --- Section 1: Resultados NPS --- */}
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gauge / Score Card */}
              <div className="lg:col-span-2 bg-[#252525] border border-[#3C4144] rounded-xl p-8 flex flex-col justify-between relative overflow-hidden h-[300px]">
                 <div>
                    <h3 className="text-xl font-domine font-bold text-white mb-2">Pontuação NPS Global</h3>
                    <p className="text-sm text-gray-400 max-w-sm">
                       Métrica baseada na probabilidade de recomendação dos seus clientes.
                    </p>
                 </div>
                 
                 <div className="absolute bottom-8 left-8">
                    <div className="flex items-baseline gap-2">
                       <span className="text-6xl font-bold text-[#E8B930] font-manrope">{stats.npsScore}</span>
                       <span className="text-sm font-bold text-gray-500 tracking-widest uppercase">Score</span>
                    </div>
                 </div>

                 {/* Custom SVG Gauge - Modified Position */}
                 <div className="absolute bottom-0 right-12 w-[300px] h-[160px]">
                    <svg viewBox="0 0 300 160" className="w-full h-full overflow-visible">
                       {/* Background Track - Shifted UP to y=130 */}
                       <path 
                         d={describeArc(gaugeCX, gaugeCY, gaugeR, 180, 360)} 
                         fill="none" 
                         stroke="#33393D" 
                         strokeWidth="20" 
                         strokeLinecap="round"
                       />

                       {/* Red Arc: -100 to 0 (180 to 270 deg) */}
                       <path 
                         d={describeArc(gaugeCX, gaugeCY, gaugeR, 180, 268)} 
                         fill="none" 
                         stroke="#ef4444" 
                         strokeWidth="20" 
                         strokeLinecap="round"
                       />
                       {/* Yellow Arc: 0 to 50 (272 to 313 deg) */}
                       <path 
                         d={describeArc(gaugeCX, gaugeCY, gaugeR, 272, 313)} 
                         fill="none" 
                         stroke="#eab308" 
                         strokeWidth="20" 
                         strokeLinecap="round"
                       />
                       {/* Green Arc: 50 to 100 (317 to 360 deg) */}
                       <path 
                         d={describeArc(gaugeCX, gaugeCY, gaugeR, 317, 360)} 
                         fill="none" 
                         stroke="#22c55e" 
                         strokeWidth="20" 
                         strokeLinecap="round"
                       />
                       
                       {/* Removed Labels (-100, 0, 100) as requested */}

                       {/* Rounded Needle */}
                       <g transform={`rotate(${needleAngle}, ${gaugeCX}, ${gaugeCY})`}>
                          {/* Needle Body */}
                          <path 
                            d={`M ${gaugeCX} ${gaugeCY-10} L ${gaugeCX+110} ${gaugeCY} L ${gaugeCX} ${gaugeCY+10} Z`} 
                            fill="#E8B930" 
                          />
                          {/* Central Pivot */}
                          <circle cx={gaugeCX} cy={gaugeCY} r="12" fill="#1B1B1B" stroke="#E8B930" strokeWidth="4" />
                       </g>
                    </svg>
                 </div>
              </div>

              {/* Stats Breakdown Panel */}
              <div className="flex flex-col gap-4">
                 {/* Total Card */}
                 <div className="bg-[#252525] border border-[#3C4144] rounded-xl p-6 flex items-center justify-between h-[140px]">
                    <div>
                       <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-domine">Total de Respostas</h3>
                       <span className="text-5xl font-bold text-white font-manrope">{stats.total}</span>
                    </div>
                    <div className="p-4 bg-[#33393D] rounded-full">
                       <MessageSquare className="w-6 h-6 text-[#E8B930]" />
                    </div>
                 </div>

                 {/* Breakdown Cards Row */}
                 <div className="grid grid-cols-3 gap-4 h-[144px]">
                    {/* Promoters */}
                    <div className="bg-[#252525] border border-[#3C4144] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                       <span className="text-3xl font-bold text-green-500 font-manrope mb-2">{stats.promoters}</span>
                       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Promotores</span>
                    </div>
                    {/* Neutrals */}
                    <div className="bg-[#252525] border border-[#3C4144] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                       <span className="text-3xl font-bold text-yellow-500 font-manrope mb-2">{stats.passives}</span>
                       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Neutros</span>
                    </div>
                    {/* Detractors */}
                    <div className="bg-[#252525] border border-[#3C4144] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                       <span className="text-3xl font-bold text-red-500 font-manrope mb-2">{stats.detractors}</span>
                       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Detratores</span>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* --- Section 2: Feedbacks Recentes --- */}
          <section className="bg-[#252525] border border-[#3C4144] rounded-xl overflow-hidden flex flex-col min-h-[600px]">
            {/* Header & Filter */}
            <div className="p-6 border-b border-[#3C4144] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <h2 className="text-xl font-domine font-bold text-white">Feedbacks Recentes</h2>
                 <Badge variant="outline" className="bg-[#33393D] text-gray-400 border-none font-normal">
                   Total: {filteredFeedbacks.length}
                 </Badge>
              </div>
              
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  placeholder="Buscar por usuário ou comentário..."
                  className="pl-9 bg-[#1B1B1B] border-[#4C4E50] text-gray-300 placeholder:text-gray-500 focus:ring-[#E8B930] h-10"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#2F2F2F] text-gray-400 uppercase font-manrope font-bold text-xs">
                  <tr>
                    <th className="px-6 py-4 w-1/4">Usuário</th>
                    <th className="px-6 py-4 cursor-pointer hover:text-white group w-24" onClick={() => handleSort('NPS')}>
                       <div className="flex items-center gap-1">Nota <ArrowUpDown className="w-3 h-3 opacity-50 group-hover:opacity-100"/></div>
                    </th>
                    <th className="px-6 py-4 w-1/3">Comentário (Preview)</th>
                    <th className="px-6 py-4 cursor-pointer hover:text-white group" onClick={() => handleSort('created_at')}>
                       <div className="flex items-center gap-1">Data e Hora <ArrowUpDown className="w-3 h-3 opacity-50 group-hover:opacity-100"/></div>
                    </th>
                    <th className="px-6 py-4 text-center">Classificação</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3C4144]">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-32 bg-[#33393D]" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-8 bg-[#33393D]" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-full bg-[#33393D]" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-24 bg-[#33393D]" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-6 w-20 mx-auto bg-[#33393D] rounded-full" /></td>
                        <td className="px-6 py-4"></td>
                      </tr>
                    ))
                  ) : paginatedFeedbacks.length === 0 ? (
                    <tr>
                       <td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-manrope">
                          {searchTerm ? 'Nenhum feedback encontrado com os filtros atuais.' : 'Nenhum feedback disponível para esta empresa.'}
                       </td>
                    </tr>
                  ) : (
                    paginatedFeedbacks.map((item) => {
                      const classification = getClassification(item.NPS);
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => handleOpenDetails(item)}
                          className="hover:bg-[#2F2F2F] transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full bg-[#33393D] flex items-center justify-center text-[#E8B930] font-bold shrink-0">
                                  {item.user ? item.user.charAt(0).toUpperCase() : <User className="w-4 h-4"/>}
                               </div>
                               <div className="min-w-0 max-w-[150px]">
                                  <p className="font-medium text-gray-200 truncate" title={item.user || 'Anônimo'}>
                                      {item.user || 'Anônimo'}
                                  </p>
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className={`font-bold text-lg ${
                                item.NPS >= 9 ? 'text-green-400' : item.NPS <= 6 ? 'text-red-400' : 'text-yellow-400'
                             }`}>
                               {item.NPS}
                             </span>
                          </td>
                          <td className="px-6 py-4">
                             <div className="text-gray-400 truncate max-w-[300px] italic">
                               {item.text || <span className="text-gray-600 font-normal not-italic">-</span>}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                             <div className="flex flex-col text-xs">
                                <span className="font-bold text-gray-200">{formatDate(item.created_at).split(',')[0]}</span>
                                <span className="text-gray-500">{formatDate(item.created_at).split(',')[1]}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                             <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${classification.color}`}>
                                {classification.label}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-[#3C4144] flex items-center justify-between bg-[#252525]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="text-white border-[#4C4E50] hover:bg-[#3C4144] bg-transparent"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <span className="text-sm text-gray-400">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="text-white border-[#4C4E50] hover:bg-[#3C4144] bg-transparent"
                >
                  Próximo <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </section>

          {/* Details Modal */}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
             <DialogContent className="bg-[#1B1B1B] border-[#3C4144] text-white max-w-2xl">
                <DialogHeader>
                   <DialogTitle className="font-domine text-xl text-[#E8B930] flex items-center gap-2">
                      <MessageSquare className="w-5 h-5"/> Detalhes do Feedback
                   </DialogTitle>
                </DialogHeader>
                
                {selectedFeedback && (
                   <div className="space-y-6 pt-4">
                      <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-gray-500">Usuário</label>
                            <div className="flex items-center gap-2 text-lg font-medium">
                               <User className="w-4 h-4 text-gray-400"/> {selectedFeedback.user || 'Anônimo'}
                            </div>
                         </div>
                         <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-gray-500">Data e Hora</label>
                            <div className="flex items-center gap-2 text-lg text-gray-300">
                               <Calendar className="w-4 h-4 text-gray-400"/> {formatDate(selectedFeedback.created_at)}
                            </div>
                         </div>
                         <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-gray-500">Nota NPS</label>
                            <div className="flex items-center gap-2">
                               <div className={`text-2xl font-bold px-3 py-1 rounded bg-[#2F2F2F] border border-[#3C4144]
                                  ${selectedFeedback.NPS >= 9 ? 'text-green-400' : selectedFeedback.NPS <= 6 ? 'text-red-400' : 'text-yellow-400'}
                               `}>
                                  {selectedFeedback.NPS}
                               </div>
                            </div>
                         </div>
                         <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-gray-500">Empresa</label>
                            <div className="flex items-center gap-2 text-lg text-gray-300">
                               <Building2 className="w-4 h-4 text-gray-400"/> {selectedFeedback.empresa}
                            </div>
                         </div>
                      </div>

                      <div className="bg-[#252525] p-6 rounded-lg border border-[#3C4144]">
                         <label className="text-xs uppercase font-bold text-gray-500 mb-2 block">Comentário Completo</label>
                         <p className="text-gray-200 leading-relaxed whitespace-pre-wrap text-lg">
                            {selectedFeedback.text || <span className="text-gray-500 italic">Nenhum comentário textual fornecido.</span>}
                         </p>
                      </div>
                   </div>
                )}
                
                <DialogFooter>
                   <Button onClick={() => setDetailsOpen(false)} className="bg-[#3C4144] hover:bg-[#4C4E50] text-white">
                      Fechar
                   </Button>
                </DialogFooter>
             </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default NpsDashboard;
