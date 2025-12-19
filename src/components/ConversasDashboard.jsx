
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAppContext } from '@/context/AppContext';
import { 
  MessageSquare, 
  Users, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Bot,
  BarChart2,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Sparkles,
  Loader2,
  Phone,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// --- Helper Functions ---

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

// Normalize string: remove accents, uppercase, trim
const normalizeName = (name) => {
  if (!name) return '';
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toUpperCase()
    .trim();
};

const isValidCompanyName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  
  if (trimmed === '') return false;
  if (trimmed.length > 60) return false; 
  if (trimmed.includes('{{') || trimmed.includes('}}')) return false; 
  if (trimmed.includes('$')) return false; 
  if (/^\d+x\d+$/.test(trimmed)) return false; 

  return true;
};

const COLORS = ['#E8B930', '#60A5FA', '#34D399', '#F472B6', '#A78BFA', '#F87171', '#9CA3AF'];

const ConversasDashboard = () => {
  const { tenantId, companyName: contextCompanyName, isAdmin } = useAppContext();
  
  // State
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]); 
  const [companyOptions, setCompanyOptions] = useState([]); 
  const [companyMap, setCompanyMap] = useState({}); // Normalized -> [Raw Values]
  
  // Filters
  const [selectedCompany, setSelectedCompany] = useState(''); // Stores NORMALIZED name
  
  // Default date range: Last 7 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Additional Filters
  const [selectedType, setSelectedType] = useState('all'); 
  const [selectedStatus, setSelectedStatus] = useState('all'); 
  
  // UI State
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Summary Modal State
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  
  const isCompanyLocked = !isAdmin;

  // --- Effects ---

  // 1. Fetch Companies (Distinct & Normalized)
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_histories_custom')
          .select('empresa');

        if (error) throw error;

        if (data) {
          const mapping = {};
          
          data.forEach(item => {
            const rawName = item.empresa;
            if (!isValidCompanyName(rawName)) return;

            const normalized = normalizeName(rawName);
            if (!mapping[normalized]) {
              mapping[normalized] = new Set();
            }
            mapping[normalized].add(rawName);
          });
          
          // Convert Sets to Arrays
          const finalMap = {};
          Object.keys(mapping).forEach(key => {
            finalMap[key] = Array.from(mapping[key]);
          });
          
          setCompanyMap(finalMap);

          // Create Options
          const options = Object.keys(finalMap).sort().map(name => ({
            value: name,
            label: name
          }));
          
          setCompanyOptions(options);

          // Handle Selection
          if (isCompanyLocked) {
            const normalizedContextName = normalizeName(contextCompanyName);
            const match = options.find(o => o.value === normalizedContextName);
            
            if (match) {
              setSelectedCompany(match.value);
            } else if (options.length > 0) {
              // Try partial match if exact match fails
              const partial = options.find(o => o.value.includes(normalizedContextName) || normalizedContextName.includes(o.value));
              if (partial) {
                setSelectedCompany(partial.value);
              } else if (options.length === 1) {
                 setSelectedCompany(options[0].value);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };
    fetchCompanies();
  }, [tenantId, isAdmin, contextCompanyName, isCompanyLocked]);

  // 2. Fetch Data
  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    } else {
      setSessions([]);
    }
  }, [selectedCompany, startDate, endDate, tenantId]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCompany, startDate, endDate, selectedType, selectedStatus]);

  const fetchData = async () => {
    // Get all raw variations for the selected normalized company name
    const rawCompanyNames = companyMap[selectedCompany];
    
    if (!rawCompanyNames || rawCompanyNames.length === 0) {
      console.warn("No raw company names found for:", selectedCompany);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('chat_histories_custom')
        .select('*')
        .in('empresa', rawCompanyNames) // Match any of the raw variations
        .neq('type', 'group') // Explicitly exclude groups at DB level
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: true }); 

      if (isCompanyLocked) {
        query = query.eq('tennat_id', tenantId);
      }

      const { data: rawData, error } = await query;
      if (error) throw error;

      processData(rawData || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  // 3. Process Data into Sessions
  const processData = (rawData) => {
    const sessionMap = {};

    rawData.forEach(msg => {
      if (!msg.session_id) return;
      
      // Strict exclusion of 'group' type
      if (msg.type === 'group') return;

      if (!sessionMap[msg.session_id]) {
        sessionMap[msg.session_id] = {
          id: msg.session_id,
          messages: [],
          user: msg.user || 'Desconhecido',
          techTypes: new Set(),
          startTime: new Date(msg.created_at),
          endTime: new Date(msg.created_at),
        };
      }

      const session = sessionMap[msg.session_id];
      session.messages.push(msg);
      
      const msgTime = new Date(msg.created_at);
      if (msgTime < session.startTime) session.startTime = msgTime;
      if (msgTime > session.endTime) session.endTime = msgTime;

      // Type Normalization Logic
      let typeLabel = msg.type;
      
      // 1. Handle NULL or Empty -> "Mensagem Normal"
      if (!typeLabel || typeLabel.trim() === '') {
        typeLabel = 'Mensagem Normal';
      }
      // 2. Handle "text" -> "Mensagem Normal"
      else if (typeLabel === 'text') {
        typeLabel = 'Mensagem Normal';
      }
      
      session.techTypes.add(typeLabel);
    });

    const processedSessions = Object.values(sessionMap).map(s => {
      const lastMsg = s.messages[s.messages.length - 1];
      
      let status = 'Neutro';
      if (lastMsg.role === 'ai') status = 'Respondida';
      else if (lastMsg.role === 'human') status = 'Sem Resposta';

      // Format Types (Tech)
      const typesArray = Array.from(s.techTypes);
      const typeString = typesArray.length > 0 ? typesArray.join(', ') : 'Mensagem Normal';

      return {
        ...s,
        messageCount: s.messages.length,
        lastMessageRole: lastMsg.role,
        lastMessageText: lastMsg.text,
        status,
        type: typeString, 
        humanMsgCount: s.messages.filter(m => m.role === 'human').length,
        aiMsgCount: s.messages.filter(m => m.role === 'ai').length
      };
    });

    processedSessions.sort((a, b) => b.endTime - a.endTime);
    setSessions(processedSessions);
  };

  // --- Metrics Calculation ---
  const metrics = useMemo(() => {
    const filteredSessions = sessions.filter(s => {
      // Filter by Type
      if (selectedType !== 'all') {
         // Check if the consolidated type string contains the selected type
         if (!s.type.includes(selectedType)) return false;
      }
      
      // Filter by Status
      if (selectedStatus !== 'all') {
         if (selectedStatus === 'respondida' && s.status !== 'Respondida') return false;
         if (selectedStatus === 'sem_resposta' && s.status !== 'Sem Resposta') return false;
      }
      return true;
    });

    // 1. Visão Geral
    const totalConversations = filteredSessions.length;
    const totalMessages = filteredSessions.reduce((acc, s) => acc + s.messageCount, 0);
    const uniqueUsers = new Set(filteredSessions.map(s => s.user)).size;
    const avgMessages = totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0;
    const totalHumanMsgs = filteredSessions.reduce((acc, s) => acc + s.humanMsgCount, 0);
    const totalAiMsgs = filteredSessions.reduce((acc, s) => acc + s.aiMsgCount, 0);
    
    // 2. Distribuição por Tipo
    const typeCounts = {};
    filteredSessions.forEach(s => {
       const types = s.type.split(',').map(t => t.trim());
       types.forEach(t => {
         typeCounts[t] = (typeCounts[t] || 0) + 1;
       });
    });
    const typeData = Object.keys(typeCounts)
      .map(k => ({ name: k, value: typeCounts[k] }))
      .sort((a,b) => b.value - a.value);

    // 3. Status
    const answeredCount = filteredSessions.filter(s => s.status === 'Respondida').length;
    const unansweredCount = filteredSessions.filter(s => s.status === 'Sem Resposta').length;
    
    // 4. Carga por Usuário
    const userLoad = {};
    filteredSessions.forEach(s => {
      const uName = s.user;
      if (!userLoad[uName]) userLoad[uName] = { user: uName, conversations: 0, messages: 0 };
      userLoad[uName].conversations += 1;
      userLoad[uName].messages += s.messageCount;
    });
    const topUsers = Object.values(userLoad)
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 5);

    // 5. Volume por Hora
    const hours = Array(24).fill(0).map((_, i) => ({ name: `${i}h`, value: 0 }));
    filteredSessions.forEach(s => {
       s.messages.forEach(m => {
          const h = new Date(m.created_at).getHours();
          if (hours[h]) hours[h].value++;
       });
    });

    return {
      overview: { totalConversations, totalMessages, uniqueUsers, avgMessages, totalHumanMsgs, totalAiMsgs },
      typeData,
      status: { answeredCount, unansweredCount },
      load: { topUsers, hours },
      filteredSessions
    };

  }, [sessions, selectedType, selectedStatus]);

  // Extract available types dynamically from the processed sessions for the dropdown
  const availableTypes = useMemo(() => {
    const types = new Set();
    sessions.forEach(s => {
      s.type.split(',').map(t => t.trim()).forEach(t => types.add(t));
    });
    return Array.from(types).sort();
  }, [sessions]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(metrics.filteredSessions.length / ITEMS_PER_PAGE);
  const paginatedSessions = metrics.filteredSessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleSession = (sessionId) => {
    setExpandedSessionId(expandedSessionId === sessionId ? null : sessionId);
  };

  const handleGenerateSummary = async () => {
    if (!selectedCompany) return;
    
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryContent('');

    try {
      const response = await fetch('https://n8n.beemotik.com/webhook/analiseconversa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company: selectedCompany, // Sending normalized name, backend might need to handle this or send raw names
          startDate: startDate,
          endDate: endDate,
          tenantId: tenantId
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        setSummaryContent(json.summary || json.message || JSON.stringify(json, null, 2));
      } catch {
        setSummaryContent(text);
      }
    } catch (err) {
      console.error(err);
      setSummaryContent('Não foi possível gerar o resumo. Por favor, tente novamente mais tarde.');
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
           <p className="text-sm text-gray-400 mt-1">Análise quantitativa e detalhamento das interações</p>
        </div>
        <div className="flex gap-2">
           <Button 
             onClick={handleGenerateSummary}
             disabled={!selectedCompany || loading}
             className="bg-[#E8B930] text-black hover:bg-[#d1a525] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Sparkles className="w-4 h-4 mr-2" />
             Gerar Resumo
           </Button>
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
              <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10 w-full opacity-100 disabled:opacity-80 disabled:cursor-not-allowed">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white max-w-[300px] max-h-[300px] overflow-y-auto">
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
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Período</Label>
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
                   {availableTypes.map(type => (
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
            <div className="flex flex-col items-center justify-center h-[500px] border border-[#3C4144] rounded-xl bg-[#252525] p-8 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-[#33393D] p-6 rounded-full mb-6 shadow-lg shadow-black/20">
                <AlertCircle className="w-12 h-12 text-[#E8B930]" />
              </div>
              <h2 className="text-2xl font-domine font-bold text-white mb-2">Selecione uma Empresa</h2>
              <p className="text-gray-400 max-w-md">
                 Para visualizar as métricas de conversas, por favor selecione uma empresa no menu acima.
              </p>
            </div>
         ) : loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4">
                 <div className="w-8 h-8 border-4 border-[#E8B930] border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-gray-400">Carregando dados das conversas...</p>
             </div>
         ) : (
            <>
               {/* 1. VISÃO GERAL */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard title="Conversas Totais" value={metrics.overview.totalConversations} icon={MessageSquare} color="#E8B930" />
                  <KpiCard title="Total de Mensagens" value={metrics.overview.totalMessages} icon={BarChart2} color="#60A5FA" />
                  <KpiCard title="Usuários Únicos" value={metrics.overview.uniqueUsers} icon={Users} color="#34D399" />
                  <KpiCard 
                     title="Média Msgs/Conversa" 
                     value={metrics.overview.avgMessages} 
                     icon={ArrowUpDown} 
                     color="#F472B6" 
                     subtext={`${metrics.overview.totalHumanMsgs} H / ${metrics.overview.totalAiMsgs} IA`}
                  />
               </div>

               {/* 2. CHART GRID (Only Type Chart) */}
               <div className="grid grid-cols-1 gap-6">
                  {/* Chart 1: Distribuição por TIPO (Technical) */}
                  <Card className="bg-[#252525] border-[#3C4144]">
                     <CardHeader>
                        <CardTitle className="text-white font-domine flex items-center gap-2">
                           <FileText className="w-5 h-5 text-blue-400" />
                           Distribuição por Tipo
                        </CardTitle>
                        <CardDescription className="text-gray-400">Classificação técnica das mensagens</CardDescription>
                     </CardHeader>
                     <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={metrics.typeData} layout="vertical" margin={{ left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#3C4144" horizontal={false} />
                              <XAxis type="number" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis dataKey="name" type="category" width={150} stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#2F2F2F', borderColor: '#3C4144', color: '#fff' }} cursor={{ fill: '#3C4144', opacity: 0.2 }} />
                              <Bar dataKey="value" fill="#60A5FA" radius={[0, 4, 4, 0]}>
                                 {metrics.typeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                 ))}
                              </Bar>
                           </BarChart>
                        </ResponsiveContainer>
                     </CardContent>
                  </Card>
               </div>

               {/* 4. CARGA POR USUÁRIO */}
               <Card className="bg-[#252525] border-[#3C4144]">
                   <CardHeader>
                      <CardTitle className="text-white font-domine flex justify-between items-center">
                         <span>Carga por Usuário & Volume</span>
                         <span className="text-xs font-manrope font-normal text-gray-400 px-3 py-1 bg-[#33393D] rounded-full">
                            Top 5 Usuários
                         </span>
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 overflow-x-auto">
                         <table className="w-full text-sm text-left">
                            <thead className="bg-[#33393D] text-gray-400 uppercase font-bold text-xs">
                               <tr>
                                  <th className="px-4 py-2 rounded-l-md">Usuário</th>
                                  <th className="px-4 py-2 text-center">Conversas</th>
                                  <th className="px-4 py-2 text-center rounded-r-md">Mensagens</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-[#3C4144]/50">
                               {metrics.load.topUsers.length === 0 ? (
                                  <tr><td colSpan="3" className="text-center py-4 text-gray-500">Sem dados</td></tr>
                               ) : (
                                  metrics.load.topUsers.map((u, i) => (
                                     <tr key={i} className="hover:bg-[#33393D]/50 transition-colors">
                                        <td className="px-4 py-2 font-medium flex items-center gap-2">
                                           <div className="w-6 h-6 rounded-full bg-[#E8B930] text-black flex items-center justify-center text-xs font-bold">
                                              {u.user.charAt(0).toUpperCase()}
                                           </div>
                                           {getDisplayName(u.user)}
                                        </td>
                                        <td className="px-4 py-2 text-center text-gray-300">{u.conversations}</td>
                                        <td className="px-4 py-2 text-center font-bold text-white">{u.messages}</td>
                                     </tr>
                                  ))
                               )}
                            </tbody>
                         </table>
                      </div>
                      
                      <div className="h-[200px] w-full">
                         <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase text-center lg:text-left">Volume por Hora</h4>
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics.load.hours}>
                               <CartesianGrid strokeDasharray="3 3" stroke="#3C4144" vertical={false} />
                               <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                               <Tooltip contentStyle={{ backgroundColor: '#2F2F2F', borderColor: '#3C4144', color: '#fff' }} />
                               <Line type="monotone" dataKey="value" stroke="#E8B930" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            </LineChart>
                         </ResponsiveContainer>
                      </div>
                   </CardContent>
               </Card>

               {/* 5. STATUS DAS CONVERSAS (List) */}
               <Card className="bg-[#252525] border-[#3C4144]">
                  <CardHeader>
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                           <CardTitle className="text-white font-domine flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-500" /> 
                              Status das Conversas
                           </CardTitle>
                           <CardDescription className="text-gray-400 mt-1">
                              Clique em uma conversa para expandir. Mostrando {paginatedSessions.length} de {metrics.filteredSessions.length}.
                           </CardDescription>
                        </div>
                        <div className="flex gap-4 text-sm font-medium">
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                              <span className="text-gray-300">Respondidas: {metrics.status.answeredCount}</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              <span className="text-gray-300">Sem Resposta: {metrics.status.unansweredCount}</span>
                           </div>
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
                                    className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                                    onClick={() => toggleSession(session.id)}
                                 >
                                    <div className="flex items-start gap-4">
                                       <div className="mt-1">
                                          {session.status === 'Respondida' ? (
                                             <CheckCircle2 className="w-5 h-5 text-green-500" />
                                          ) : (
                                             <XCircle className="w-5 h-5 text-red-500" />
                                          )}
                                       </div>
                                       
                                       <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                                             <span className="font-bold text-white text-base">
                                                {getDisplayName(session.user)}
                                             </span>
                                             
                                             <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-[#1B1B1B] px-1.5 py-0.5 rounded border border-[#3C4144]">
                                                <Phone className="w-2.5 h-2.5" />
                                                {getPhoneFromSession(session.id)}
                                             </div>

                                             {/* Type Badge */}
                                             <Badge variant="outline" className="text-[10px] border-blue-900/50 bg-blue-900/20 text-blue-300 font-normal ml-1">
                                                {session.type}
                                             </Badge>
                                          </div>
                                          <p className="text-sm text-gray-400 truncate max-w-[300px] md:max-w-[500px]">
                                             <span className="text-[#E8B930] mr-1">Última:</span> 
                                             {session.lastMessageText}
                                          </p>
                                       </div>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-6 min-w-[180px]">
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

                                 {/* Expanded Content */}
                                 {expandedSessionId === session.id && (
                                    <div className="bg-[#1B1B1B] p-4 border-t border-[#3C4144]">
                                       <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar px-2">
                                          {session.messages.map((msg, idx) => (
                                             <div 
                                                key={idx} 
                                                className={cn(
                                                   "flex gap-3 max-w-[90%]",
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
                                                   "p-3 rounded-2xl text-sm leading-relaxed",
                                                   msg.role === 'human' 
                                                      ? "bg-[#33393D] text-white rounded-tr-sm" 
                                                      : "bg-[#2F2F2F] text-gray-200 border border-[#3C4144] rounded-tl-sm"
                                                )}>
                                                   <p>{msg.text}</p>
                                                   <span className="text-[10px] text-gray-500 block mt-2 opacity-70">
                                                      {formatDate(msg.created_at)}
                                                   </span>
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
         )}
      </main>

      {/* Summary Modal */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="bg-[#2F2F2F] border-[#3C4144] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-domine text-white">
              <Sparkles className="w-5 h-5 text-[#E8B930]" />
              Resumo Inteligente
            </DialogTitle>
            <DialogDescription className="text-gray-400">
               Análise das conversas do período selecionado gerada por IA.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 min-h-[150px] max-h-[60vh] overflow-y-auto custom-scrollbar bg-[#1B1B1B] rounded-lg p-4 border border-[#3C4144]">
            {summaryLoading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                 <Loader2 className="w-8 h-8 animate-spin text-[#E8B930]" />
                 <p className="text-sm animate-pulse">Gerando análise...</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                 <p className="whitespace-pre-wrap leading-relaxed text-gray-200">
                    {summaryContent || "Nenhum resumo disponível."}
                 </p>
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

const KpiCard = ({ title, value, icon: Icon, color, subtext }) => (
  <Card className="bg-[#252525] border-[#3C4144] shadow-lg">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <div className="mt-2 flex flex-col">
            <span className="text-3xl font-bold text-white font-manrope">
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
