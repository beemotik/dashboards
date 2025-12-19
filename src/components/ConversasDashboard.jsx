import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAppContext } from '@/context/AppContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageSquare, 
  Users, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Sparkles,
  Loader2,
  Phone,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  PieChart,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

// --- Helper Functions ---

const normalizeText = (text) => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
};

const getDisplayName = (fullName) => {
  if (!fullName) return 'Usuário Desconhecido';
  return fullName; 
};

const getPhoneFromSession = (sessionId) => {
  if (!sessionId) return '';
  const phone = sessionId.split('_')[0];
  return phone;
};

// Colors for Charts
const COLORS = ['#E8B930', '#60A5FA', '#34D399', '#F472B6', '#A78BFA', '#F87171', '#9CA3AF'];
const HUMAN_AI_COLORS = ['#33393D', '#E8B930']; // Human (Dark), AI (Gold)

// Standard Types
const STANDARD_TYPES = ["Mensagem Normal", "quiz", "NPS", "Agendamento", "Suporte", "Vendas", "group"];

const ConversasDashboard = () => {
  const { tenantId, companyName: contextCompanyName, isAdmin } = useAppContext();
  const { toast } = useToast();
  
  // --- State ---
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState([]); // All messages from Supabase
  const [sessions, setSessions] = useState([]); // Grouped sessions
  const [metrics, setMetrics] = useState(null); // Calculated aggregations
  
  const [companyOptions, setCompanyOptions] = useState([]); 
  const [companyMap, setCompanyMap] = useState({}); // Maps normalized -> [originals]
  
  // Filters
  const [selectedCompany, setSelectedCompany] = useState(''); // Empty by default
  
  // Default date range: Last 7 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [selectedType, setSelectedType] = useState('all'); 
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [filterHumanOnly, setFilterHumanOnly] = useState(false); // Toggle for human messages
  
  // Sorting & Pagination
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = newest first
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5; // Updated limit to 5 per user as requested

  // Summary Modal
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  
  const isCompanyLocked = !isAdmin;

  // --- Effects ---

  // 1. Fetch Company Options with Normalization
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_histories_custom')
          .select('empresa'); 

        if (error) throw error;

        if (data) {
          const map = {};
          data.forEach(item => {
            if (item.empresa && item.empresa.trim().length > 0 && item.empresa.length < 60) {
               const raw = item.empresa;
               const normalized = normalizeText(raw);
               
               if (!map[normalized]) map[normalized] = new Set();
               map[normalized].add(raw);
            }
          });
          
          // Convert Set to Array
          const finalMap = {};
          Object.keys(map).forEach(key => {
            finalMap[key] = Array.from(map[key]);
          });
          
          setCompanyMap(finalMap);
          
          const options = Object.keys(finalMap).sort().map(name => ({
            value: name,
            label: name // Display normalized name
          }));
          
          setCompanyOptions(options);

          if (isCompanyLocked && contextCompanyName) {
            const normalizedContext = normalizeText(contextCompanyName);
            const match = options.find(o => o.value === normalizedContext);
            if (match) setSelectedCompany(match.value);
            else if (options.length > 0) setSelectedCompany(options[0].value);
          }
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };
    fetchCompanies();
  }, [tenantId, isAdmin, contextCompanyName, isCompanyLocked]);

  // 2. Fetch Data from Supabase
  useEffect(() => {
    if (!selectedCompany) {
      setRawData([]);
      setMetrics(null);
      setSessions([]);
      return;
    }
    fetchData();
  }, [selectedCompany, startDate, endDate]); 

  // 3. Process Data (Grouping & Aggregation)
  useEffect(() => {
    if (rawData.length > 0 || !loading) {
       processDataAndAggregates();
    }
  }, [rawData, selectedType, selectedStatus, sortOrder, filterHumanOnly]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCompany, startDate, endDate, selectedType, selectedStatus, sortOrder, filterHumanOnly]);


  // --- Data Fetching Logic ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const targetCompanies = companyMap[selectedCompany];
      
      if (!targetCompanies || targetCompanies.length === 0) {
        throw new Error("Invalid company selection");
      }

      // Build Query
      // UPDATED: Added limit(2000)
      let query = supabase
        .from('chat_histories_custom')
        .select('*')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .in('empresa', targetCompanies)
        .limit(2000);

      const { data, error } = await query;

      if (error) throw error;
      setRawData(data || []);

    } catch (error) {
      console.error("Error fetching chat data:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: error.message
      });
      setRawData([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Processing Logic ---
  const processDataAndAggregates = () => {
    if (!rawData || rawData.length === 0) {
      setMetrics(null);
      setSessions([]);
      return;
    }

    // 1. Filter raw messages (remove 'group' type if strict, etc.)
    const messages = rawData.filter(m => (m.type || '').toLowerCase() !== 'group');

    // 2. Group by Session ID
    const sessionMap = {};
    
    // Aggregation counters
    let countTotal = 0;
    let countAi = 0;
    let countHuman = 0;
    const typeCounts = {}; // { type: count }
    
    messages.forEach(msg => {
      // Global Counters
      countTotal++;
      // Determine Role (assuming 'human' is consistent, 'ai' or others are AI)
      const role = (msg.role || '').toLowerCase();
      const isHuman = role === 'human' || role === 'user';
      const isAI = !isHuman;

      if (isAI) countAi++;
      else countHuman++;

      // Type Counter
      const t = msg.type || 'Mensagem Normal';
      typeCounts[t] = (typeCounts[t] || 0) + 1;

      // Grouping
      if (!msg.session_id) return;
      if (!sessionMap[msg.session_id]) {
        sessionMap[msg.session_id] = {
          id: msg.session_id,
          messages: [],
          user: msg.user || 'Desconhecido',
          company: msg.empresa || 'N/A',
          typesSet: new Set(),
          startTime: new Date(msg.created_at),
          endTime: new Date(msg.created_at),
          hasHumanMessage: false
        };
      }
      
      const session = sessionMap[msg.session_id];
      // Normalize role for internal use
      const normalizedMsg = { 
        ...msg, 
        role: isHuman ? 'human' : 'ai' 
      };
      session.messages.push(normalizedMsg);
      
      // Check for human messages in this session
      if (isHuman) {
        session.hasHumanMessage = true;
      }
      
      // Update times
      const msgDate = new Date(msg.created_at);
      if (msgDate < session.startTime) session.startTime = msgDate;
      if (msgDate > session.endTime) session.endTime = msgDate;
      
      // Collect types
      session.typesSet.add(t);
    });

    // 3. Finalize Sessions (Sort messages inside, determine status, capture last 5)
    let processedSessions = Object.values(sessionMap).map(s => {
      // Sort messages by time ascending for proper history inside expanded view
      // But we need descending for "preview" or logical last messages
      
      // Full history sorted ascending (Oldest -> Newest)
      s.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      const lastMsg = s.messages[s.messages.length - 1];
      
      // Get last 5 messages (sorted Newest -> Oldest for display in list)
      const last5Messages = [...s.messages]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

      // Status Logic: Last message AI = Respondida, Human = Sem Resposta
      const status = lastMsg.role === 'ai' ? 'Respondida' : 'Sem Resposta';
      
      const typeString = Array.from(s.typesSet).join(', ');

      return {
        ...s,
        lastMessageText: lastMsg.text,
        last5Messages, // Using 5 now as requested
        status,
        type: typeString,
        messageCount: s.messages.length
      };
    });

    // 4. Calculate Aggregated Metrics (JSON Structure)
    const total = countTotal || 1; // avoid div by zero
    const typeDistribution = Object.entries(typeCounts)
      .map(([type, qtd]) => ({
        tipo: type,
        quantidade: qtd,
        percentual: ((qtd / total) * 100).toFixed(2)
      }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const calculatedMetrics = {
      total_mensagens: countTotal,
      quantidade_role_ai: countAi,
      percent_role_ai: ((countAi / total) * 100).toFixed(2),
      quantidade_role_human: countHuman,
      percent_role_human: ((countHuman / total) * 100).toFixed(2),
      tipos: typeDistribution,
      uniqueUsers: new Set(processedSessions.map(s => s.user)).size,
      unansweredCount: processedSessions.filter(s => s.status === 'Sem Resposta').length
    };

    setMetrics(calculatedMetrics);

    // 5. Apply Client-Side Filters for the List View
    let filteredList = processedSessions;

    if (selectedType !== 'all') {
      filteredList = filteredList.filter(s => s.typesSet.has(selectedType));
    }

    if (selectedStatus !== 'all') {
       if (selectedStatus === 'respondida') filteredList = filteredList.filter(s => s.status === 'Respondida');
       if (selectedStatus === 'sem_resposta') filteredList = filteredList.filter(s => s.status === 'Sem Resposta');
    }

    // Toggle for Human Messages
    if (filterHumanOnly) {
      filteredList = filteredList.filter(s => s.hasHumanMessage);
    }

    // 6. Sort Sessions (using startTime which is reliable date object)
    // We want newest first if desc
    filteredList.sort((a, b) => {
       const timeA = a.startTime.getTime();
       const timeB = b.startTime.getTime();
       
       if (sortOrder === 'asc') return timeA - timeB;
       return timeB - timeA;
    });

    setSessions(filteredList);
  };

  // --- Pagination ---
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const paginatedSessions = sessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const availableTypes = useMemo(() => {
    const types = new Set(STANDARD_TYPES);
    if (metrics && metrics.tipos) {
      metrics.tipos.forEach(t => types.add(t.tipo));
    }
    return Array.from(types).sort();
  }, [metrics]);

  // --- Handlers ---
  const toggleSession = (id) => {
    setExpandedSessionId(expandedSessionId === id ? null : id);
  };

  const handleUpdateMessageType = async (messageId, newType, sessionId) => {
    // Optimistic Update
    const updatedRaw = rawData.map(m => m.id === messageId ? { ...m, type: newType } : m);
    setRawData(updatedRaw); // This triggers reprocessing

    toast({ title: "Mensagem Atualizada", description: `Tipo alterado para ${newType}` });

    // DB Update
    const { error } = await supabase.from('chat_histories_custom').update({ type: newType }).eq('id', messageId);
    if (error) console.error("Error updating message type:", error);
  };
  
  // UPDATED: Open summary modal without auto-fetching immediately
  const handleOpenSummaryModal = () => {
    if (!selectedCompany) {
      toast({ variant: "destructive", title: "Selecione uma empresa", description: "Para gerar o resumo, selecione uma empresa específica." });
      return;
    }
    setSummaryOpen(true);
    // Reset state when opening
    setSummaryContent(''); 
    setSummaryLoading(false);
  };

  // UPDATED: The actual generation logic triggered by button inside modal
  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    setSummaryContent('');

    try {
      // Prepare filtered data context (max 50 to avoid payload limit issues)
      const contextSessions = sessions.slice(0, 50).map(s => ({
        user: s.user,
        type: s.type,
        status: s.status,
        messages: s.messages.map(m => ({ role: m.role, text: m.text, time: m.created_at }))
      }));

      const payload = {
        filters: { empresa: selectedCompany, tipo: selectedType, user: 'Todos', dateRange: { start: startDate, end: endDate }, status: selectedStatus },
        conversations: contextSessions,
        totalMessages: metrics?.total_mensagens || 0,
        totalConversas: sessions.length
      };

      const response = await fetch('https://n8n.beemotik.com/webhook/analiseconversa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Erro: ${response.status}`);
      const data = await response.json(); 
      
      let finalContent = "";
      
      // Updated extraction logic for array responses [ { "output": "..." } ]
      if (Array.isArray(data) && data.length > 0) {
        finalContent = data[0].output || data[0].summary || data[0].message || JSON.stringify(data);
      } 
      // Handle standard object response
      else if (typeof data === 'object' && data !== null) {
        finalContent = data.output || data.summary || data.message || JSON.stringify(data);
      } 
      // Fallback
      else {
        finalContent = String(data);
      }

      setSummaryContent(finalContent);

    } catch (err) {
      console.error(err);
      setSummaryContent('Não foi possível gerar o resumo. Verifique se o webhook está ativo.');
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-[#1B1B1B] text-white font-manrope">
      {/* Header */}
      <header className="bg-[#2F2F2F] border-b border-[#3C4144] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-domine font-bold text-white flex items-center gap-2">
             <MessageSquare className="h-6 w-6 text-[#E8B930]" />
             Dashboard de Conversas
           </h1>
           <p className="text-sm text-gray-400 mt-1">Análise direta do banco de dados</p>
        </div>
      </header>

      {/* Filters */}
      <div className="sticky top-0 z-30 bg-[#2F2F2F] border-b border-[#3C4144] px-6 py-4 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
           {/* Company */}
           <div className="space-y-2 max-w-full">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Empresa</Label>
            <Select
              value={selectedCompany}
              onValueChange={setSelectedCompany}
              disabled={isCompanyLocked}
            >
              <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10 w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white max-h-[300px]">
                {companyOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="truncate">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="space-y-2 lg:col-span-2">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Período (Max 30d)</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-[#33393D] border-[#4C4E50] text-white h-10"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-[#33393D] border-[#4C4E50] text-white h-10"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="space-y-2">
             <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Tipo</Label>
             <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10">
                   <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                   <SelectItem value="all">Todos</SelectItem>
                   {availableTypes.filter(t => t !== 'group').map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                   ))}
                </SelectContent>
             </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
             <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Status</Label>
             <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10">
                   <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                   <SelectItem value="all">Todos</SelectItem>
                   <SelectItem value="respondida">Respondidas</SelectItem>
                   <SelectItem value="sem_resposta">Sem Resposta</SelectItem>
                </SelectContent>
             </Select>
          </div>
        </div>
      </div>

      <main className="p-6 space-y-6 pb-20">
         {!selectedCompany ? (
            <div className="flex flex-col items-center justify-center h-[50vh] border border-[#3C4144] rounded-xl bg-[#252525] p-8 text-center animate-in fade-in zoom-in-95 duration-300">
               <div className="bg-[#33393D] p-4 rounded-full mb-4">
                  <Search className="w-10 h-10 text-[#E8B930]" />
               </div>
               <h2 className="text-xl font-domine font-bold text-white mb-2">Selecione uma Empresa</h2>
               <p className="text-gray-400 max-w-md">
                  Para visualizar as métricas e o histórico de conversas, por favor selecione uma empresa na barra de filtros acima.
               </p>
            </div>
         ) : loading && !metrics ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4">
                 <Loader2 className="w-8 h-8 text-[#E8B930] animate-spin" />
                 <p className="text-gray-400">Carregando dados das conversas...</p>
             </div>
         ) : metrics ? (
            <>
               {/* 1. VISÃO GERAL - BIG NUMBERS */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <KpiCard 
                     title="Total de Mensagens" 
                     value={metrics.total_mensagens} 
                     icon={MessageSquare} 
                     color="#E8B930" 
                  />
                  <KpiCard 
                     title="Mensagens de IA" 
                     value={metrics.quantidade_role_ai} 
                     icon={Bot} 
                     color="#FBBF24" 
                     subtext={`${metrics.percent_role_ai}% do total`}
                  />
                  <div 
                     onClick={() => setFilterHumanOnly(!filterHumanOnly)} 
                     className={cn(
                        "cursor-pointer transition-transform hover:scale-105",
                        filterHumanOnly ? "ring-2 ring-[#9CA3AF]" : ""
                     )}
                  >
                   <KpiCard 
                     title="Mensagens Humanas" 
                     value={metrics.quantidade_role_human} 
                     icon={Users} 
                     color="#9CA3AF" 
                     subtext={filterHumanOnly ? "Filtro Ativo: Exibindo apenas conversas com interação humana" : `${metrics.percent_role_human}% do total`}
                     active={filterHumanOnly}
                  />
                  </div>
                  <KpiCard 
                     title="Usuários Únicos" 
                     value={metrics.uniqueUsers} 
                     icon={Users} 
                     color="#34D399" 
                  />
                  <div onClick={() => setSelectedStatus('sem_resposta')} className="cursor-pointer transition-transform hover:scale-105">
                     <KpiCard 
                        title="Sem Resposta" 
                        value={metrics.unansweredCount} 
                        icon={AlertCircle} 
                        color="#EF4444" 
                        subtext="Conversas pendentes"
                        warning={metrics.unansweredCount > 0}
                     />
                  </div>
               </div>

               {/* 2. CARGA POR USUÁRIO - ADJUSTED SECTION */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Side: IA vs Humano Distribution */}
                  <Card className="bg-[#252525] border-[#3C4144] lg:col-span-1">
                     <CardHeader>
                        <CardTitle className="text-white font-domine flex items-center gap-2 text-lg">
                           <PieChart className="w-5 h-5 text-gray-400" />
                           Distribuição de Mensagens
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="flex flex-col items-center justify-center h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                           <RechartsPieChart>
                              <Pie
                                 data={[
                                    { name: 'Humano', value: metrics.quantidade_role_human },
                                    { name: 'IA', value: metrics.quantidade_role_ai }
                                 ]}
                                 cx="50%"
                                 cy="50%"
                                 innerRadius={60}
                                 outerRadius={80}
                                 paddingAngle={5}
                                 dataKey="value"
                              >
                                 {HUMAN_AI_COLORS.map((color, index) => (
                                    <Cell key={`cell-${index}`} fill={color} stroke="none" />
                                 ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#2F2F2F', borderColor: '#3C4144', color: '#fff' }} />
                           </RechartsPieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-6 mt-4">
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-[#33393D]"></div>
                              <span className="text-sm text-gray-300">Humano ({metrics.percent_role_human}%)</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-[#E8B930]"></div>
                              <span className="text-sm text-gray-300">IA ({metrics.percent_role_ai}%)</span>
                           </div>
                        </div>
                     </CardContent>
                  </Card>

                  {/* Right Side: Table with Types */}
                  <Card className="bg-[#252525] border-[#3C4144] lg:col-span-2">
                     <CardHeader>
                        <CardTitle className="text-white font-domine text-lg">
                           Detalhamento por Tipo
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                           {selectedCompany ? `Dados filtrados para: ${selectedCompany}` : "Visão Geral"}
                        </CardDescription>
                     </CardHeader>
                     <CardContent>
                        <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
                           <table className="w-full text-sm text-left">
                              <thead className="bg-[#33393D] text-gray-400 uppercase font-bold text-xs sticky top-0">
                                 <tr>
                                    <th className="px-4 py-3 rounded-l-md">Tipo</th>
                                    <th className="px-4 py-3 text-center">Quantidade</th>
                                    <th className="px-4 py-3 text-center rounded-r-md">Percentual</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-[#3C4144]/50">
                                 {metrics.tipos.length === 0 ? (
                                    <tr><td colSpan="3" className="text-center py-8 text-gray-500">Sem dados de distribuição</td></tr>
                                 ) : (
                                    metrics.tipos.map((item, i) => (
                                       <tr key={i} className="hover:bg-[#33393D]/50 transition-colors">
                                          <td className="px-4 py-3 font-normal text-gray-300 flex items-center gap-2">
                                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                             {item.tipo}
                                          </td>
                                          <td className="px-4 py-3 text-center text-gray-300 font-medium">
                                             {item.quantidade}
                                          </td>
                                          <td className="px-4 py-3 text-center text-gray-400">
                                             {item.percentual ? `${item.percentual}%` : '-'}
                                          </td>
                                       </tr>
                                    ))
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </CardContent>
                  </Card>
               </div>

               {/* 5. STATUS DAS CONVERSAS (List) */}
               <Card className="bg-[#252525] border-[#3C4144]">
                  <CardHeader>
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                           <CardTitle className="text-white font-domine flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-500" /> 
                              Status das Conversas
                              {filterHumanOnly && (
                                 <span className="ml-2 px-2 py-0.5 rounded-full bg-[#33393D] border border-[#9CA3AF] text-xs font-normal text-gray-300">
                                    Filtro: Humano
                                 </span>
                              )}
                           </CardTitle>
                           <CardDescription className="text-gray-400 mt-1">
                              Mostrando {paginatedSessions.length} conversas. (Ordenação: {sortOrder === 'desc' ? 'Mais recentes' : 'Mais antigas'})
                           </CardDescription>
                        </div>
                        
                        <div className="flex items-center gap-4">
                           {/* Sort Toggle */}
                           <Button 
                             onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                             variant="outline"
                             size="sm"
                             className="border-[#4C4E50] bg-[#33393D] hover:bg-[#3C4144] hover:text-white gap-2"
                           >
                              <ArrowUpDown className="w-4 h-4" />
                              <span className="hidden sm:inline">
                                {sortOrder === 'desc' ? 'Recentes' : 'Antigas'}
                              </span>
                           </Button>

                           <Button 
                             onClick={(e) => {
                               e.stopPropagation();
                               handleOpenSummaryModal();
                             }}
                             disabled={summaryLoading || sessions.length === 0}
                             size="sm"
                             className="bg-[#E8B930] text-black hover:bg-[#d1a525] font-bold"
                           >
                             <Sparkles className="w-3 h-3 mr-2" />
                             Gerar Resumo
                           </Button>
                        </div>
                     </div>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-2">
                        {paginatedSessions.length === 0 ? (
                           <div className="text-center py-12 text-gray-500 bg-[#2A2A2A] rounded-lg border border-dashed border-[#3C4144]">
                              Nenhuma conversa encontrada com os filtros atuais.
                           </div>
                        ) : (
                           paginatedSessions.map((session) => (
                              <div 
                                 key={session.id} 
                                 className={cn(
                                    "border rounded-lg overflow-hidden transition-all duration-200",
                                    expandedSessionId === session.id 
                                       ? "bg-[#33393D] border-[#E8B930]" 
                                       : "bg-[#2F2F2F] border-[#3C4144] hover:border-[#666]"
                                 )}
                              >
                                 {/* Header Row - Clickable */}
                                 <div 
                                    className="p-4 cursor-pointer flex flex-col md:flex-row md:items-start justify-between gap-4"
                                    onClick={() => toggleSession(session.id)}
                                 >
                                    <div className="flex items-start gap-4 flex-1">
                                       <div className="mt-1 flex-shrink-0">
                                          {session.status === 'Respondida' ? (
                                             <CheckCircle2 className="w-5 h-5 text-green-500" />
                                          ) : (
                                             <XCircle className="w-5 h-5 text-red-500" />
                                          )}
                                       </div>
                                       
                                       <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                                             <span className="font-bold text-white text-base">
                                                {getDisplayName(session.user)}
                                             </span>
                                             
                                             <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-[#1B1B1B] px-1.5 py-0.5 rounded border border-[#3C4144]">
                                                <Phone className="w-2.5 h-2.5" />
                                                {getPhoneFromSession(session.id)}
                                             </div>
                                             {session.hasHumanMessage && (
                                                <div className="flex items-center gap-1 text-[10px] text-[#33393D] bg-gray-300 font-bold px-1.5 py-0.5 rounded">
                                                   <Users className="w-2.5 h-2.5" />
                                                   Humano
                                                </div>
                                             )}
                                          </div>
                                          
                                          {/* Last 5 messages preview */}
                                          <div className="space-y-1.5">
                                             {session.last5Messages.map((msg, idx) => (
                                                <div key={idx} className="flex gap-2 text-xs">
                                                   <span className={cn(
                                                      "uppercase font-bold text-[10px] w-8 shrink-0 text-right mt-0.5",
                                                      msg.role === 'human' ? "text-gray-400" : "text-[#E8B930]"
                                                   )}>
                                                      {msg.role === 'human' ? 'USER' : 'BOT'}
                                                   </span>
                                                   <p className={cn(
                                                       "truncate flex-1 line-clamp-1",
                                                       msg.role === 'human' ? "text-gray-300" : "text-gray-400 italic"
                                                    )}>
                                                      {msg.text}
                                                   </p>
                                                   <span className="text-[10px] text-gray-600 shrink-0 whitespace-nowrap">
                                                      {formatDate(msg.created_at)}
                                                   </span>
                                                </div>
                                             ))}
                                          </div>
                                       </div>
                                    </div>

                                    <div className="flex items-start justify-between md:justify-end gap-6 min-w-[120px]">
                                       <div className="text-right">
                                          <div className="flex items-center gap-1 text-xs text-gray-400 justify-end">
                                             <Calendar className="w-3 h-3" />
                                             {formatDate(session.startTime).split(',')[0]}
                                          </div>
                                          <div className="flex items-center gap-1 text-xs text-gray-500 justify-end mt-0.5">
                                             <Clock className="w-3 h-3" />
                                             {formatDate(session.endTime).split(',')[1]}
                                          </div>
                                       </div>
                                       {expandedSessionId === session.id ? (
                                          <ChevronUp className="w-5 h-5 text-gray-400" />
                                       ) : (
                                          <ChevronDown className="w-5 h-5 text-gray-400" />
                                       )}
                                    </div>
                                 </div>

                                 {/* Expanded Content - Full Message History */}
                                 {expandedSessionId === session.id && (
                                    <div className="bg-[#1B1B1B] p-4 border-t border-[#3C4144]">
                                       <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar px-2">
                                          {session.messages.map((msg, idx) => (
                                             <div 
                                                key={idx} 
                                                className={cn(
                                                   "flex gap-3 max-w-[95%] group/msg",
                                                   msg.role === 'human' ? "ml-auto flex-row-reverse" : ""
                                                )}
                                             >
                                                <div className={cn(
                                                   "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                                   msg.role === 'human' ? "bg-[#33393D]" : "bg-[#E8B930]"
                                                )}>
                                                   {msg.role === 'human' ? (
                                                      <span className="text-xs font-bold">{session.user.charAt(0).toUpperCase()}</span>
                                                   ) : (
                                                      <Bot className="w-5 h-5 text-black" />
                                                   )}
                                                </div>
                                                
                                                <div className={cn(
                                                   "p-3 rounded-2xl text-sm leading-relaxed relative min-w-[200px]",
                                                   msg.role === 'human' 
                                                      ? "bg-[#33393D] text-white rounded-tr-sm" 
                                                      : "bg-[#2F2F2F] text-gray-200 border border-[#3C4144] rounded-tl-sm"
                                                )}>
                                                   <p className="mb-4">{msg.text}</p>
                                                   
                                                   <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-1">
                                                      <span className="text-[10px] text-gray-500 opacity-70">
                                                         {formatDate(msg.created_at)}
                                                      </span>

                                                      {/* Message Level Type Edit */}
                                                      <div className="opacity-100 transition-opacity">
                                                        <Select 
                                                          defaultValue={msg.type || 'Mensagem Normal'} 
                                                          onValueChange={(val) => handleUpdateMessageType(msg.id, val, session.id)}
                                                        >
                                                          <SelectTrigger className="h-5 w-auto text-[10px] bg-black/20 text-gray-300 border-none px-2 py-0 gap-1 rounded hover:bg-black/40">
                                                            <SelectValue />
                                                          </SelectTrigger>
                                                          <SelectContent className="bg-[#252525] border-[#3C4144] text-white">
                                                            {availableTypes.map(t => (
                                                              <SelectItem key={t} value={t} className="text-xs">
                                                                {t === 'group' ? 'Ocultar (Group)' : t}
                                                              </SelectItem>
                                                            ))}
                                                          </SelectContent>
                                                        </Select>
                                                      </div>
                                                   </div>
                                                </div>
                                             </div>
                                          ))}
                                       </div>
                                    </div>
                                 )}
                              </div>
                           ))
                        )}
                     </div>

                     {/* Pagination Controls */}
                     {totalPages > 1 && (
                        <div className="flex items-center justify-end gap-4 mt-6">
                           <span className="text-sm text-gray-400">
                             Página {currentPage} de {totalPages}
                           </span>
                           <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="border-[#4C4E50] text-gray-300 hover:bg-[#33393D] hover:text-white"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="border-[#4C4E50] text-gray-300 hover:bg-[#33393D] hover:text-white"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                           </div>
                        </div>
                     )}
                  </CardContent>
               </Card>
            </>
         ) : null}
      </main>

      {/* Summary Modal - UPDATED to match WhatsApp Groups style */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="bg-[#2F2F2F] border-[#3C4144] text-white sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-domine text-white">
              <Bot className="w-6 h-6 text-[#E8B930]" />
              Resumo IA - Análise de Conversas
            </DialogTitle>
            <DialogDescription className="text-gray-400">
               Gerado com base nas {sessions.length} mensagens filtradas.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {summaryLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                 <div className="w-12 h-12 border-4 border-[#E8B930] border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-gray-400 animate-pulse">Analisando conversas com IA...</p>
                 <p className="text-xs text-gray-500 max-w-sm text-center">Isso pode levar alguns segundos dependendo do volume de mensagens.</p>
              </div>
            ) : summaryContent ? (
               <div className="bg-[#1B1B1B] p-6 rounded-lg border border-[#3C4144] prose prose-invert prose-sm max-w-none text-gray-200">
                 <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h1: ({node, ...props}) => <h1 className="text-xl font-bold text-[#E8B930] mt-6 mb-3" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold text-[#E8B930] mt-5 mb-2" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-bold text-[#E8B930] mt-4 mb-2" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-[#E8B930]" {...props} />,
                        p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1" {...props} />
                    }}
                 >
                    {summaryContent}
                 </ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Clique em "Gerar" para iniciar a análise.
                <div className="mt-4 flex justify-center">
                   <Button onClick={handleGenerateSummary} className="bg-[#E8B930] text-black hover:bg-[#d1a525]">
                     Iniciar Análise
                   </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSummaryOpen(false)} className="border-[#4C4E50] text-gray-300 hover:bg-[#3C4144] hover:text-white">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const KpiCard = ({ title, value, icon: Icon, color, subtext, warning, active }) => (
  <Card className={cn(
    "bg-[#252525] border border-[#3C4144] shadow-lg transition-colors",
    warning ? "border-red-500/30 bg-red-950/10" : "",
    active ? "bg-[#33393D] border-[#9CA3AF]" : ""
  )}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <div className="mt-2 flex flex-col">
            <span className={cn(
              "text-3xl font-bold font-manrope",
              warning ? "text-red-400" : "text-white"
            )}>
              {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
            </span>
            {subtext && <span className="text-xs text-gray-500 mt-1">{subtext}</span>}
          </div>
        </div>
        <div
          className="p-3 rounded-full bg-opacity-10"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default ConversasDashboard;