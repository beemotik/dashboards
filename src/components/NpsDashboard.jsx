
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAppContext } from '@/context/AppContext';
import { exportToCSV } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  MessageSquare, 
  Building2,
  Calendar,
  User,
  ArrowUpDown,
  AlertCircle,
  FileDown,
  Printer,
  FileSpreadsheet,
  Sparkles,
  Loader2,
  Target,
  FileText,
  AlertTriangle,
  ClipboardList
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [unidades, setUnidades] = useState([]);
  const [tags, setTags] = useState([]);
  const [npsOptions, setNpsOptions] = useState([]);
  
  // Filters
  const [selectedCompany, setSelectedCompany] = useState(''); 
  const [selectedUnidade, setSelectedUnidade] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedNps, setSelectedNps] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // Modals
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Analysis Modal State
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Lock logic
  const isCompanyLocked = !isAdmin;

  // --- Effects ---
  
  // 1. Fetch Companies first
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresas')
          .select('Name, nome, name')
          .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
          .single();

        let myCompanyName = '';
        if (!empresaError && empresaData) {
          myCompanyName = empresaData.Name || empresaData.nome || empresaData.name || '';
        } else {
          myCompanyName = contextCompanyName || '';
        }

        if (isAdmin) {
          const { data: allCompaniesData, error: allCompaniesError } = await supabase
            .from('chat_agente_nps')
            .select('empresa')
            .not('empresa', 'is', null);

          if (!allCompaniesError && allCompaniesData) {
            const uniqueCompanies = [...new Set(allCompaniesData.map(c => c.empresa))]
              .filter(c => c && c.trim() !== '')
              .sort();
            
            setCompanies(uniqueCompanies);
            
            if (myCompanyName && uniqueCompanies.includes(myCompanyName)) {
               setSelectedCompany(myCompanyName);
            }
          }
        } else {
          if (myCompanyName) {
            setCompanies([myCompanyName]);
            setSelectedCompany(myCompanyName);
          } else {
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

  // 2. Fetch Unidades, Tags AND NPS Options when company changes
  useEffect(() => {
    const fetchFilters = async () => {
      if (!selectedCompany) {
        setUnidades([]);
        setTags([]);
        setNpsOptions([]);
        setSelectedUnidade('all');
        setSelectedTag('all');
        setSelectedNps('all');
        return;
      }

      try {
        // Fetch Unidades
        const { data: dataUnidades, error: errorUnidades } = await supabase
          .from('chat_agente_nps')
          .select('unidade')
          .eq('empresa', selectedCompany)
          .not('unidade', 'is', null);

        if (!errorUnidades && dataUnidades) {
          const uniqueUnidades = [...new Set(dataUnidades.map(u => u.unidade))]
            .filter(u => u && u.trim() !== '')
            .sort();
          setUnidades(uniqueUnidades);
        }

        // Fetch Tags
        const { data: dataTags, error: errorTags } = await supabase
          .from('chat_agente_nps')
          .select('tags')
          .eq('empresa', selectedCompany)
          .not('tags', 'is', null);

        if (!errorTags && dataTags) {
          // Flatten tags if they are comma separated or arrays, normalize strings
          const allTags = dataTags.flatMap(item => {
             if (!item.tags) return [];
             // Check if it looks like a comma separated string
             if (typeof item.tags === 'string' && item.tags.includes(',')) {
                return item.tags.split(',').map(t => t.trim());
             }
             return [item.tags.trim()];
          });
          
          const uniqueTags = [...new Set(allTags)]
            .filter(t => t && t !== '')
            .sort();
          setTags(uniqueTags);
        }

        // Fetch NPS Options (Titles)
        const { data: dataNps, error: errorNps } = await supabase
           .from('chat_agente_nps')
           .select('titulo, pill')
           .eq('empresa', selectedCompany)
           .not('titulo', 'is', null);

        if (!errorNps && dataNps) {
           // Create unique map based on title
           const uniqueMap = new Map();
           dataNps.forEach(item => {
              if (item.titulo && !uniqueMap.has(item.titulo)) {
                 // We use the first found pill ID for this title. 
                 // Assuming 1-to-1 mapping or that title is unique enough.
                 uniqueMap.set(item.titulo, item.pill); 
              }
           });
           
           const options = Array.from(uniqueMap.entries()).map(([titulo, pill]) => ({
              label: titulo,
              value: pill || titulo // fallback to title if pill is null, though query filters null
           })).sort((a, b) => a.label.localeCompare(b.label));
           
           setNpsOptions(options);
        }

        setSelectedUnidade('all');
        setSelectedTag('all');
        setSelectedNps('all');
      } catch (error) {
        console.error("Error fetching filters:", error);
      }
    };

    fetchFilters();
  }, [selectedCompany]);

  // 3. Fetch Data when filters change (or initial load)
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
      // NOTE: We fetch ALL data for the selected company to ensure Client-side filtering and sorting 
      // works on the full dataset, and exports include everything.
      let query = supabase
        .from('chat_agente_nps')
        .select('*')
        .order('created_at', { ascending: false });

      if (isCompanyLocked) {
        query = query.eq('tennat_id', tenantId);
      }
      
      if (selectedCompany && selectedCompany !== 'all') {
        query = query.eq('empresa', selectedCompany);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Aggregate Logic
      const sessions = {};
      
      (data || []).forEach(row => {
          if (!row.session_id) return;
          
          if (!sessions[row.session_id]) {
              sessions[row.session_id] = {
                  id: row.session_id,
                  session_id: row.session_id,
                  user: row.user,
                  empresa: row.empresa,
                  unidade: row.unidade,
                  tags: row.tags,
                  pill: row.pill, // Capture pill ID
                  titulo: row.titulo, // Capture title
                  created_at: row.created_at,
                  NPS: null,
                  texts: []
              };
          }
          
          const session = sessions[row.session_id];
          
          if (row.NPS !== null && row.NPS !== undefined && row.NPS !== '') {
             session.NPS = Number(row.NPS);
          }
          
          if (row.user) session.user = row.user;
          if (row.unidade) session.unidade = row.unidade;
          if (row.tags) session.tags = row.tags;
          if (row.pill) session.pill = row.pill;
          if (row.titulo) session.titulo = row.titulo;
          
          if (row.role === 'human' && row.text && row.text.trim()) {
             const cleanText = row.text.trim();
             const isPureNumber = /^\d+$/.test(cleanText);
             if (!isPureNumber) {
                 session.texts.push({ text: cleanText, time: new Date(row.created_at) });
             }
          }
      });
      
      const processedData = Object.values(sessions)
          .filter(session => session.NPS !== null)
          .map(session => {
              const sortedTexts = session.texts
                  .sort((a, b) => a.time - b.time)
                  .map(t => t.text);
              
              const concatenatedText = sortedTexts.join(' - ');
              
              return {
                 ...session,
                 text: concatenatedText,
                 hasHumanText: sortedTexts.length > 0 
              };
          });

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
      // Unidade Filter
      if (selectedUnidade !== 'all') {
        if (item.unidade !== selectedUnidade) return false;
      }
      
      // Tag Filter
      if (selectedTag !== 'all') {
        if (!item.tags || !item.tags.includes(selectedTag)) return false;
      }

      // NPS Filter (Pill/Title)
      if (selectedNps !== 'all') {
         // item.pill matches the value of the selected option
         if (item.pill !== selectedNps) return false;
      }

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
  }, [feedbacks, searchTerm, selectedUnidade, selectedTag, selectedNps]);

  // 2. Sort
  const sortedFeedbacks = useMemo(() => {
    let sortable = [...filteredFeedbacks];
    if (sortConfig.key) {
      sortable.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'created_at') {
            valA = new Date(valA || 0).getTime();
            valB = new Date(valB || 0).getTime();
        }
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

  // 4. Statistics (NPS Calculation) - Based on FILTERED feedbacks
  const stats = useMemo(() => {
    const validScores = filteredFeedbacks.filter(f => f.NPS !== null);
    
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
  }, [filteredFeedbacks]);

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
    setCurrentPage(1);
  };

  const handleOpenDetails = (feedback) => {
    setSelectedFeedback(feedback);
    setDetailsOpen(true);
  };

  const handleExportPDF = () => {
    // This triggers the browser print dialog. 
    // The CSS @media print block below ensures only the hidden table with ALL records is printed.
    window.print(); 
  };

  const handleExportExcel = () => {
    const headers = ['Nome', 'Nota', 'Comentário', 'Data e Hora', 'Classificação', 'Empresa', 'Unidade', 'Tag', 'Pesquisa'];
    // We use sortedFeedbacks here which contains ALL matching records, not just paginated ones
    const data = sortedFeedbacks.map(f => [
      f.user || 'Anônimo',
      f.NPS,
      f.text || '',
      formatDate(f.created_at),
      getClassification(f.NPS).label,
      f.empresa,
      f.unidade || '',
      f.tags || '',
      f.titulo || ''
    ]);
    exportToCSV(data, headers, `nps_export_${selectedCompany.replace(/\s+/g, '_')}`);
  };

  const handleGenerateAnalysis = async () => {
    setAnalysisOpen(true);
    setAnalysisLoading(true);
    setAnalysisResult(null);

    try {
      const payload = {
        empresa: selectedCompany,
        unidade: selectedUnidade,
        tags: selectedTag,
        pill: selectedNps // This sends 'all' or the pill ID
      };

      const response = await fetch('https://n8n.beemotik.com/webhook/analisar-nps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Falha na solicitação de análise');
      }

      // Check content type to see if we can parse as JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
         const jsonResponse = await response.json();
         
         // Logic for parsing the webhook response structure:
         // Expected structure: [{ output: "MARKDOWN TEXT..." }]
         if (Array.isArray(jsonResponse) && jsonResponse.length > 0 && jsonResponse[0].output) {
             setAnalysisResult(jsonResponse[0].output);
         } else if (jsonResponse.output) {
             // Fallback: simple object { output: "..." }
             setAnalysisResult(jsonResponse.output);
         } else {
             // Fallback: just dump the json
             setAnalysisResult(JSON.stringify(jsonResponse, null, 2));
         }
      } else {
         // Fallback for text/plain
         const textResponse = await response.text();
         setAnalysisResult(textResponse);
      }

    } catch (error) {
      console.error('Erro na análise:', error);
      setAnalysisResult("Ocorreu um erro ao gerar a análise. Por favor, tente novamente.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // --- Gauge Logic ---
  const calculateNeedleRotation = (score) => {
    if (score <= 0) {
      return 180 + ((score - (-100)) * 0.9);
    } else if (score <= 50) {
      return 270 + (score * 0.9);
    } else {
      return 315 + ((score - 50) * 0.9);
    }
  };

  const needleAngle = calculateNeedleRotation(stats.npsScore);
  const gaugeCX = 150;
  const gaugeCY = 130; 
  const gaugeR = 130;

  return (
    <>
      <div id="nps-dashboard-content" className="min-h-full bg-[#1B1B1B] text-white font-manrope p-6 space-y-8 print:hidden">
        
        {/* Header with Filters */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-domine font-bold text-[#E8B930] mb-1">Resultados NPS</h1>
            <p className="text-gray-400 text-sm">Visão geral de satisfação e feedback</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 no-print flex-wrap items-end justify-end">
             {/* Company Filter */}
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Empresa</label>
               <Select 
                  value={selectedCompany} 
                  onValueChange={setSelectedCompany}
                  disabled={isCompanyLocked}
               >
                  <SelectTrigger className="w-[200px] bg-[#33393D] border-[#4C4E50] text-white h-9">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                    {companies.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
               </Select>
             </div>

             {/* Unidade Filter */}
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Unidade</label>
               <Select 
                  value={selectedUnidade} 
                  onValueChange={setSelectedUnidade}
                  disabled={!selectedCompany || unidades.length === 0}
               >
                  <SelectTrigger className="w-[200px] bg-[#33393D] border-[#4C4E50] text-white h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {unidades.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
               </Select>
             </div>

             {/* Tag Filter */}
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tags</label>
               <Select 
                  value={selectedTag} 
                  onValueChange={setSelectedTag}
                  disabled={!selectedCompany || tags.length === 0}
               >
                  <SelectTrigger className="w-[200px] bg-[#33393D] border-[#4C4E50] text-white h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                    <SelectItem value="all">Todas as tags</SelectItem>
                    {tags.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
               </Select>
             </div>

             {/* NPS (Survey) Filter */}
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">NPS</label>
               <Select 
                  value={selectedNps} 
                  onValueChange={setSelectedNps}
                  disabled={!selectedCompany || npsOptions.length === 0}
               >
                  <SelectTrigger className="w-[200px] bg-[#33393D] border-[#4C4E50] text-white h-9 truncate">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                    <SelectItem value="all">Todos os NPS</SelectItem>
                    {npsOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="truncate max-w-[300px]">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
               </Select>
             </div>
             
             <div className="flex gap-2 sm:self-end">
                <Button 
                   className="bg-[#8b5cf6] text-white hover:bg-[#7c3aed] font-bold h-9 border border-[#8b5cf6]/50"
                   disabled={!selectedCompany}
                   onClick={handleGenerateAnalysis}
                >
                   <Sparkles className="w-4 h-4 mr-2"/> Gerar Análise
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      className="bg-[#E8B930] text-black hover:bg-[#d1a525] font-bold h-9"
                      disabled={!selectedCompany}
                    >
                       <FileDown className="w-4 h-4 mr-2"/> Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                    <DropdownMenuItem onClick={handleExportPDF} className="hover:bg-[#3C4144] cursor-pointer">
                      <Printer className="w-4 h-4 mr-2"/> Exportar PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportExcel} className="hover:bg-[#3C4144] cursor-pointer">
                      <FileSpreadsheet className="w-4 h-4 mr-2"/> Exportar Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
             </div>
          </div>
        </div>

        {!selectedCompany ? (
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
                <div className="lg:col-span-2 bg-[#252525] border border-[#3C4144] rounded-xl p-8 flex flex-col justify-between relative overflow-hidden h-[300px]">
                   <div className="z-10 relative">
                      <h3 className="text-xl font-domine font-bold text-white mb-2">Pontuação NPS Global</h3>
                      <p className="text-sm text-gray-400 max-w-sm">
                         Métrica baseada na probabilidade de recomendação dos seus clientes.
                         {selectedUnidade !== 'all' && <span className="block text-[#E8B930] mt-1">Filtro Unidade: {selectedUnidade}</span>}
                         {selectedTag !== 'all' && <span className="block text-[#E8B930] mt-1">Filtro Tag: {selectedTag}</span>}
                         {selectedNps !== 'all' && <span className="block text-[#E8B930] mt-1">Filtro NPS: {npsOptions.find(o => o.value === selectedNps)?.label || 'Selecionado'}</span>}
                      </p>
                   </div>
                   
                   <div className="absolute bottom-8 left-8 z-10">
                      <div className="flex items-baseline gap-2">
                         <span className="text-6xl font-bold text-[#E8B930] font-manrope">{stats.npsScore}</span>
                         <span className="text-sm font-bold text-gray-500 tracking-widest uppercase">Score</span>
                      </div>
                   </div>

                   <div className="absolute bottom-0 right-12 w-[300px] h-[160px]">
                      <svg viewBox="0 0 300 160" className="w-full h-full overflow-visible">
                         <path d={describeArc(gaugeCX, gaugeCY, gaugeR, 180, 360)} fill="none" stroke="#33393D" strokeWidth="20" strokeLinecap="round"/>
                         <path d={describeArc(gaugeCX, gaugeCY, gaugeR, 180, 268)} fill="none" stroke="#ef4444" strokeWidth="20" strokeLinecap="round"/>
                         <path d={describeArc(gaugeCX, gaugeCY, gaugeR, 272, 313)} fill="none" stroke="#eab308" strokeWidth="20" strokeLinecap="round"/>
                         <path d={describeArc(gaugeCX, gaugeCY, gaugeR, 317, 360)} fill="none" stroke="#22c55e" strokeWidth="20" strokeLinecap="round"/>
                         <g transform={`rotate(${needleAngle}, ${gaugeCX}, ${gaugeCY})`}>
                            <path d={`M ${gaugeCX} ${gaugeCY-10} L ${gaugeCX+110} ${gaugeCY} L ${gaugeCX} ${gaugeCY+10} Z`} fill="#E8B930"/>
                            <circle cx={gaugeCX} cy={gaugeCY} r="12" fill="#1B1B1B" stroke="#E8B930" strokeWidth="4" />
                         </g>
                      </svg>
                   </div>
                </div>

                <div className="flex flex-col gap-4">
                   <div className="bg-[#252525] border border-[#3C4144] rounded-xl p-6 flex items-center justify-between h-[140px]">
                      <div>
                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-domine">Total de Respostas</h3>
                         <span className="text-5xl font-bold text-white font-manrope">{stats.total}</span>
                      </div>
                      <div className="p-4 bg-[#33393D] rounded-full">
                         <MessageSquare className="w-6 h-6 text-[#E8B930]" />
                      </div>
                   </div>

                   <div className="grid grid-cols-3 gap-4 h-[144px]">
                      <div className="bg-[#252525] border border-[#3C4144] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                         <span className="text-3xl font-bold text-green-500 font-manrope mb-2">{stats.promoters}</span>
                         <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Promotores</span>
                      </div>
                      <div className="bg-[#252525] border border-[#3C4144] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                         <span className="text-3xl font-bold text-yellow-500 font-manrope mb-2">{stats.passives}</span>
                         <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Neutros</span>
                      </div>
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
              <div className="p-6 border-b border-[#3C4144] flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
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

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#2F2F2F] text-gray-400 uppercase font-manrope font-bold text-xs">
                    <tr>
                      <th className="px-6 py-4 w-1/4">Usuário / Unidade</th>
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
                            {searchTerm || selectedUnidade !== 'all' || selectedTag !== 'all' || selectedNps !== 'all' ? 'Nenhum feedback encontrado com os filtros atuais.' : 'Nenhum feedback disponível para esta empresa.'}
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
                                    <div className="flex flex-col">
                                       {item.unidade && (
                                         <p className="text-xs text-gray-500 truncate">{item.unidade}</p>
                                       )}
                                       {item.titulo && (
                                         <p className="text-[10px] text-gray-600 truncate max-w-[120px]" title={item.titulo}>{item.titulo}</p>
                                       )}
                                    </div>
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
                <div className="p-4 border-t border-[#3C4144] flex items-center justify-between bg-[#252525] no-print">
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
               <DialogContent className="bg-[#1B1B1B] border-[#3C4144] text-white max-w-2xl no-print">
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
                              <label className="text-xs uppercase font-bold text-gray-500">Empresa / Unidade</label>
                              <div className="flex items-center gap-2 text-lg text-gray-300">
                                 <Building2 className="w-4 h-4 text-gray-400"/> 
                                 <span>{selectedFeedback.empresa} {selectedFeedback.unidade ? ` - ${selectedFeedback.unidade}` : ''}</span>
                              </div>
                           </div>
                           {selectedFeedback.titulo && (
                             <div className="space-y-1 col-span-2">
                                <label className="text-xs uppercase font-bold text-gray-500">Pesquisa (NPS)</label>
                                <div className="text-sm text-gray-300">
                                   {selectedFeedback.titulo}
                                </div>
                             </div>
                           )}
                           {selectedFeedback.tags && (
                             <div className="space-y-1 col-span-2">
                                <label className="text-xs uppercase font-bold text-gray-500">Tags</label>
                                <div className="text-sm text-gray-300">
                                   {selectedFeedback.tags}
                                </div>
                             </div>
                           )}
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

            {/* Analysis Modal */}
            <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
               <DialogContent className="bg-[#1B1B1B] border-[#3C4144] text-white max-w-4xl no-print max-h-[85vh] flex flex-col">
                  <DialogHeader>
                     <DialogTitle className="font-domine text-xl text-[#00FFFF] flex items-center gap-2">
                        <Sparkles className="w-5 h-5"/> Plano de Ação do NPS
                     </DialogTitle>
                     <DialogDescription className="text-gray-400">
                        Análise detalhada e plano de ação gerados por Inteligência Artificial.
                     </DialogDescription>
                  </DialogHeader>

                  <ScrollArea className="flex-1 mt-4 p-4 bg-[#252525] rounded-lg border border-[#3C4144] min-h-[300px]">
                     {analysisLoading ? (
                        <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
                           <Loader2 className="w-10 h-10 text-[#8b5cf6] animate-spin" />
                           <p className="text-gray-400 animate-pulse">Gerando plano de ação detalhado...</p>
                        </div>
                     ) : analysisResult ? (
                        <div className="prose prose-invert max-w-none prose-sm prose-p:text-gray-300 prose-headings:text-white prose-strong:text-[#E8B930] prose-li:marker:text-[#E8B930]">
                            {/* Render raw markdown from webhook response directly */}
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                               {analysisResult}
                            </ReactMarkdown>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                           <AlertCircle className="w-10 h-10 mb-2" />
                           <p>Nenhuma análise gerada.</p>
                        </div>
                     )}
                  </ScrollArea>

                  <DialogFooter className="mt-4">
                     <Button onClick={() => setAnalysisOpen(false)} className="bg-[#3C4144] hover:bg-[#4C4E50] text-white">
                        Fechar
                     </Button>
                  </DialogFooter>
               </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* Hidden Print Table with ALL records */}
      <div id="print-section" className="hidden print:block p-8 bg-white text-black w-full">
         <h1 className="text-2xl font-bold mb-4">Relatório NPS - {selectedCompany}</h1>
         <div className="mb-6 flex gap-8 text-sm">
            <div><strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
            <div><strong>Total de Registros:</strong> {sortedFeedbacks.length}</div>
            <div><strong>NPS Score:</strong> {stats.npsScore}</div>
         </div>
         
         <table className="w-full text-xs text-left border-collapse border border-gray-300">
            <thead>
               <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1">Usuário</th>
                  <th className="border border-gray-300 px-2 py-1">Unidade</th>
                  <th className="border border-gray-300 px-2 py-1">Pesquisa</th>
                  <th className="border border-gray-300 px-2 py-1">Nota</th>
                  <th className="border border-gray-300 px-2 py-1">Classificação</th>
                  <th className="border border-gray-300 px-2 py-1">Comentário</th>
                  <th className="border border-gray-300 px-2 py-1">Data</th>
               </tr>
            </thead>
            <tbody>
               {sortedFeedbacks.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-300">
                     <td className="border border-gray-300 px-2 py-1">{item.user || 'Anônimo'}</td>
                     <td className="border border-gray-300 px-2 py-1">{item.unidade || '-'}</td>
                     <td className="border border-gray-300 px-2 py-1">{item.titulo || '-'}</td>
                     <td className="border border-gray-300 px-2 py-1">{item.NPS}</td>
                     <td className="border border-gray-300 px-2 py-1">{getClassification(item.NPS).label}</td>
                     <td className="border border-gray-300 px-2 py-1">{item.text || '-'}</td>
                     <td className="border border-gray-300 px-2 py-1">{formatDate(item.created_at)}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
};

export default NpsDashboard;
