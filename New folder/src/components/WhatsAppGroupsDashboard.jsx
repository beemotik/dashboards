
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, MessageCircle, TrendingUp, Users, AlertCircle,
  ChevronLeft, ChevronRight, Settings, Download, Bot,
  BarChart2, ArrowUpDown, Eye, PieChart, Filter
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAppContext } from '@/context/AppContext';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

// Helper to translate types
const translateType = (type) => {
  const t = (type || '').toLowerCase();
  if (t.includes('reclam') || t.includes('complain')) return 'Reclamações';
  if (t.includes('dúvida') || t.includes('duvida') || t.includes('question')) return 'Perguntas';
  if (t.includes('elogio') || t.includes('praise')) return 'Elogios';
  if (t.includes('solicita') || t.includes('request')) return 'Solicitações';
  if (t.includes('risco') || t.includes('risk')) return 'Riscos';
  if (t.includes('neutr')) return 'Neutro';
  return 'Outros';
};

// Helper to render markdown-like text (Bold and Line Breaks)
const renderFormattedText = (text) => {
  if (!text) return null;
  
  // Handle JSON encoded string just in case
  let cleanText = text;
  if (typeof text === 'string' && (text.trim().startsWith('[') || text.trim().startsWith('{'))) {
      try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed[0]?.output) {
              cleanText = parsed[0].output;
          } else if (parsed.output) {
              cleanText = parsed.output;
          }
      } catch (e) {
          // ignore parse error, use original text
      }
  }

  // Split by newlines to handle paragraphs
  // Replacing literal \n if they exist as characters instead of newlines
  const processedText = cleanText.replace(/\\n/g, '\n'); 
  const lines = processedText.split('\n');
  
  return (
    <div className="space-y-1 text-gray-300 leading-relaxed text-sm md:text-base">
      {lines.map((line, i) => {
        // If line is empty, render a spacer to preserve paragraph break visual
        if (!line.trim()) {
           return <div key={i} className="h-3" />;
        }

        // Parse bold markdown (**text**)
        const parts = line.split(/(\*\*.*?\*\*)/g);
        
        return (
          <div key={i}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="text-[#E8B930] font-bold">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </div>
        );
      })}
    </div>
  );
};

// Helper to extract clean summary content
const getSummaryContent = (result) => {
    if (!result) return null;
    
    // Case 1: Array with output key (standard n8n response)
    if (Array.isArray(result) && result[0] && result[0].output) {
        return result[0].output;
    }
    
    // Case 2: Object with output key
    if (result && typeof result === 'object' && result.output) {
        return result.output;
    }
    
    // Case 3: Already a string
    if (typeof result === 'string') return result;

    // Fallback
    return result.text || result.message || JSON.stringify(result, null, 2);
};

const WhatsAppGroupsDashboard = () => {
  const { tenantId, companyName: contextCompanyName, isAdmin } = useAppContext();
  const { toast } = useToast();

  // --- State ---
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [groups, setGroups] = useState([]);

  // Filters
  const [selectedCompany, setSelectedCompany] = useState(''); 
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedMessageType, setSelectedMessageType] = useState('all');

  // Default date range: Last 7 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // Modals
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [messageDetailsModalOpen, setMessageDetailsModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState(null);

  // Settings
  const [webhookUrl, setWebhookUrl] = useState('https://n8n.beemotik.com/webhook/gerar_resumo');

  // 3. Non-admin access logic: Restrict editing/changing
  // Only Admin can change company. Others are locked to their tenantId.
  const isCompanyLocked = !isAdmin;

  // --- Effects ---

  // 1. Load Companies based on Tenant ID
  useEffect(() => {
    fetchCompanies();
  }, [tenantId, isAdmin, contextCompanyName]);

  // 2. Load Groups when company changes
  useEffect(() => {
    if (selectedCompany) {
      fetchGroups(selectedCompany);
    } else {
      setGroups([]);
    }
  }, [selectedCompany]);

  // 3. Load Messages when filters change
  useEffect(() => {
    if (selectedCompany) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [selectedCompany, selectedGroup, startDate, endDate, tenantId]);

  // --- Data Fetching ---

  const fetchCompanies = async () => {
    try {
      // Step 1: Resolve the current user's company name from 'empresas' table using tenantId
      // We check both 'id' and 'tenant_id' columns to be safe
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
        // Admin: Load all companies from data source
        const { data, error } = await supabase
          .from('grupos_whatsapp')
          .select('company')
          .not('company', 'is', null);

        if (!error && data) {
          const uniqueCompanies = [...new Set(data.map(item => item.company))].sort();
          setCompanies(uniqueCompanies);

          // Auto-select logic
          if (myCompanyName && uniqueCompanies.includes(myCompanyName)) {
            setSelectedCompany(myCompanyName);
          } else if (uniqueCompanies.length > 0 && !selectedCompany) {
            // Default select first for convenience
            // setSelectedCompany(uniqueCompanies[0]);
          }
        }
      } else {
        // Non-Admin: Load only their company
        if (myCompanyName) {
          setCompanies([myCompanyName]);
          setSelectedCompany(myCompanyName);
        } else {
          // Emergency fallback
          setCompanies(contextCompanyName ? [contextCompanyName] : []);
          setSelectedCompany(contextCompanyName || '');
        }
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: "Erro ao carregar empresas",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchGroups = async (company) => {
    try {
      let query = supabase
        .from('grupos_whatsapp')
        .select('group_name')
        .eq('company', company)
        .not('group_name', 'is', null);

      if (isCompanyLocked) {
        // Double check using tenant_id
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const uniqueGroups = [...new Set(data.map(item => item.group_name))].sort();
      setGroups(uniqueGroups);
      setSelectedGroup('all');
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        title: "Erro ao carregar grupos",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchMessages = async () => {
    if (!selectedCompany) return;

    setLoading(true);
    try {
      let query = supabase
        .from('grupos_whatsapp')
        .select('*')
        .eq('company', selectedCompany)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      // 3. Non-admin access logic: Only show data for their assigned company
      if (isCompanyLocked) {
        query = query.eq('tenant_id', tenantId);
      }

      if (selectedGroup !== 'all') {
        query = query.eq('group_name', selectedGroup);
      }

      const { data, error } = await query;

      if (error) throw error;

      setMessages(data || []);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Data Processing for UI ---

  const filteredMessages = useMemo(() => {
    let filtered = messages;

    // Filter by Message Type if selected
    if (selectedMessageType && selectedMessageType !== 'all') {
      filtered = filtered.filter(msg => translateType(msg.type) === selectedMessageType);
    }

    // Search Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(msg => 
        (msg.message && msg.message.toLowerCase().includes(lowerTerm)) ||
        (msg.user && msg.user.toLowerCase().includes(lowerTerm)) ||
        (msg.phone && msg.phone.includes(lowerTerm)) ||
        (translateType(msg.type).toLowerCase().includes(lowerTerm))
      );
    }
    
    return filtered;
  }, [messages, searchTerm, selectedMessageType]);

  const sortedMessages = useMemo(() => {
    let sortableMessages = [...filteredMessages];
    if (sortConfig !== null) {
      sortableMessages.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableMessages;
  }, [filteredMessages, sortConfig]);

  const kpiStats = useMemo(() => {
    const total = sortedMessages.length;
    const activeGroups = new Set(sortedMessages.map(m => m.group_name)).size;
    const activeUsers = new Set(sortedMessages.map(m => m.phone)).size;

    const daysDiff = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)));
    const avgPerDay = Math.round(total / daysDiff);

    return { total, activeGroups, activeUsers, avgPerDay };
  }, [sortedMessages, startDate, endDate]);

  const chartData = useMemo(() => {
    const counts = {};
    sortedMessages.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      counts[date] = (counts[date] || 0) + 1;
    });

    return Object.keys(counts).map(date => ({
      date,
      count: counts[date]
    })).sort((a, b) => {
       const [dA, mA] = a.date.split('/');
       const [dB, mB] = b.date.split('/');
       return new Date(2000, mA-1, dA) - new Date(2000, mB-1, dB);
    });
  }, [sortedMessages]);

  const typeChartData = useMemo(() => {
    const counts = {
      'Reclamações': 0,
      'Perguntas': 0,
      'Elogios': 0,
      'Solicitações': 0,
      'Riscos': 0,
      'Neutro': 0,
      'Outros': 0
    };

    sortedMessages.forEach(msg => {
      const translated = translateType(msg.type);
      if (counts[translated] !== undefined) {
         counts[translated]++;
      } else {
         counts['Outros']++;
      }
    });

    const data = Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).filter(item => item.value > 0);

    return data.sort((a, b) => b.value - a.value);
  }, [sortedMessages]);

  const paginatedMessages = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedMessages.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedMessages, currentPage]);

  const totalPages = Math.ceil(sortedMessages.length / ITEMS_PER_PAGE);

  const isAiSummaryEnabled = useMemo(() => {
    if (!selectedCompany) return false;
    if (!selectedGroup || selectedGroup === 'all') return false;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= 7;
  }, [selectedCompany, selectedGroup, startDate, endDate]);

  // --- Handlers ---

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleOpenMessageDetails = (msg) => {
    setSelectedMessage(msg);
    setMessageDetailsModalOpen(true);
  };

  const handleSummaryModalOpenChange = (open) => {
    setSummaryModalOpen(open);
    if (!open) {
      setSummaryResult(null);
    }
  };

  const handleGenerateSummary = async () => {
    if (!isAiSummaryEnabled) {
       toast({
         title: "Filtros inválidos para IA",
         description: "Selecione uma empresa, um grupo específico e um período máximo de 7 dias.",
         variant: "destructive"
       });
       return;
    }

    setSummaryLoading(true);
    setSummaryResult(null);

    // Calculate statistical counts for payload
    const typeCounts = {
      complaints: 0,
      questions: 0,
      praise: 0,
      requests: 0,
      risks: 0,
      neutral: 0
    };

    sortedMessages.forEach(msg => {
      const type = (msg.type || '').toLowerCase();
      if (type.includes('reclam') || type.includes('complain')) typeCounts.complaints++;
      else if (type.includes('dúvida') || type.includes('duvida') || type.includes('question')) typeCounts.questions++;
      else if (type.includes('elogio') || type.includes('praise')) typeCounts.praise++;
      else if (type.includes('solicita') || type.includes('request')) typeCounts.requests++;
      else if (type.includes('risco') || type.includes('risk')) typeCounts.risks++;
      else if (type.includes('neutr')) typeCounts.neutral++;
    });

    const payload = {
      empresa: selectedCompany,
      grupo: selectedGroup,
      periodo_inicio: startDate,
      periodo_fim: endDate,
      tenant_id: tenantId,
      total_mensagens: kpiStats.total,
      usuarios_ativos: kpiStats.activeUsers,
      ...typeCounts,
      mensagens: sortedMessages.map(m => ({
        data: m.created_at,
        usuario: m.user,
        telefone: m.phone,
        grupo: m.group_name,
        mensagem: m.message,
        tipo: m.type
      }))
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Webhook error: ${response.status}`);

      const result = await response.json();
      setSummaryResult(result);
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummaryResult({ error: "Falha ao gerar resumo. Verifique o console ou a configuração do Webhook." });
    } finally {
      setSummaryLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Grupo', 'Usuário', 'Telefone', 'Tipo', 'Mensagem'];
    const csvContent = [
      headers.join(','),
      ...sortedMessages.map(m => {
        const row = [
          `"${new Date(m.created_at).toLocaleString('pt-BR')}"`,
          `"${m.group_name || ''}"`,
          `"${m.user || ''}"`,
          `"${m.phone || ''}"`,
          `"${translateType(m.type)}"`,
          `"${(m.message || '').replace(/"/g, '""')}"`
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `whatsapp_export_${selectedCompany}_${startDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-full bg-[#1B1B1B] text-white font-manrope">

      {/* Header */}
      <header className="bg-[#2F2F2F] border-b border-[#3C4144] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-domine font-bold text-white flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-[#E8B930]" />
            Grupos de Whatsapp
          </h1>
          <p className="text-sm text-gray-400 mt-1">Monitoramento e análise de conversas</p>
        </div>

        <div className="flex gap-2">
           <Button
            variant="outline"
            className="bg-[#33393D] border-[#4C4E50] text-white hover:bg-[#3C4144]"
            onClick={() => setSettingsModalOpen(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
          <Button
            className={`font-bold ${!isAiSummaryEnabled ? 'opacity-50 cursor-not-allowed bg-gray-600' : 'bg-[#E8B930] text-[#1B1B1B] hover:bg-[#d1a525]'}`}
            onClick={() => isAiSummaryEnabled && setSummaryModalOpen(true)}
            disabled={!isAiSummaryEnabled}
          >
            <Bot className="w-4 h-4 mr-2" />
            Gerar Resumo IA
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="sticky top-0 z-30 bg-[#2F2F2F] border-b border-[#3C4144] px-6 py-4 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">

          {/* Company */}
          <div className="space-y-2 max-w-full">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Empresa</Label>
            {/* 3. Disable/lock the Empresa dropdown if not admin */}
            <Select
              value={selectedCompany}
              onValueChange={setSelectedCompany}
              disabled={isCompanyLocked}
            >
              <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10 w-full [&>span]:truncate [&>span]:block opacity-100 disabled:opacity-80 disabled:cursor-not-allowed">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white max-w-[300px]">
                {companies.map(c => (
                  <SelectItem key={c} value={c} className="truncate">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group */}
          <div className="space-y-2 max-w-full">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Grupo</Label>
            <Select
              value={selectedGroup}
              onValueChange={setSelectedGroup}
              disabled={groups.length === 0}
            >
              <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10 w-full [&>span]:truncate [&>span]:block">
                <SelectValue placeholder="Todos os Grupos" />
              </SelectTrigger>
              <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white max-h-[300px] max-w-[300px]">
                <SelectItem value="all">Todos os Grupos</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g} value={g} className="truncate" title={g}>
                    {g}
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

           {/* Export button */}
           <div className="pb-0.5">
             <Button
                onClick={exportToCSV}
                disabled={!selectedCompany || sortedMessages.length === 0}
                className="w-full bg-[#3C4144] hover:bg-[#4C4E50] text-white border border-[#4C4E50]"
             >
               <Download className="w-4 h-4 mr-2" />
               Exportar CSV
             </Button>
           </div>
        </div>
      </div>

      <main className="p-6 space-y-6 pb-20">
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
                 : "Para visualizar o dashboard e as mensagens, por favor selecione uma empresa no menu acima."}
            </p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KpiCard
                title="Total de Mensagens"
                value={kpiStats.total}
                icon={MessageCircle}
                color="#E8B930"
              />
              <KpiCard
                title="Grupos Ativos"
                value={kpiStats.activeGroups}
                icon={Users}
                color="#60A5FA"
              />
              <KpiCard
                title="Usuários Únicos"
                value={kpiStats.activeUsers}
                icon={Users}
                color="#34D399"
              />
              <KpiCard
                title="Média Diária"
                value={kpiStats.avgPerDay}
                icon={TrendingUp}
                color="#F472B6"
              />
            </div>

            {/* Charts Section - Modified to Stack Vertically */}
            <div className="flex flex-col gap-6">
              {/* Volume Chart */}
              <div className="bg-[#252525] border border-[#3C4144] rounded-lg p-6">
                <h3 className="text-lg font-domine font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-[#E8B930]" />
                  Volume de Mensagens
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3C4144" vertical={false} />
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#2F2F2F', border: '1px solid #3C4144', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#E8B930' }}
                        cursor={{ fill: '#3C4144', opacity: 0.2 }}
                      />
                      <Bar dataKey="count" fill="#E8B930" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#E8B930' : '#D4A017'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Type Distribution Chart */}
              <div className="bg-[#252525] border border-[#3C4144] rounded-lg p-6">
                <h3 className="text-lg font-domine font-bold text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-[#60A5FA]" />
                  Distribuição por Tipo
                </h3>
                <div className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#3C4144" horizontal={false} />
                      <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100}
                        stroke="#9CA3AF" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#2F2F2F', border: '1px solid #3C4144', borderRadius: '8px', color: '#fff' }}
                        cursor={{ fill: '#3C4144', opacity: 0.2 }}
                      />
                      <Bar dataKey="value" fill="#60A5FA" radius={[0, 4, 4, 0]}>
                         {typeChartData.map((entry, index) => (
                          <Cell key={`cell-type-${index}`} fill={['#60A5FA', '#34D399', '#F472B6', '#E8B930'][index % 4]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Messages Table */}
            <div className="bg-[#252525] border border-[#3C4144] rounded-lg overflow-hidden flex flex-col">
              <div className="p-6 border-b border-[#3C4144] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-domine font-bold text-white">Mensagens</h3>
                  <span className="text-xs text-gray-400">
                    Mostrando {paginatedMessages.length} de {filteredMessages.length}
                  </span>
                </div>
                
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-end md:items-center">
                    {/* Type Filter */}
                    <Select value={selectedMessageType} onValueChange={(val) => { setSelectedMessageType(val); setCurrentPage(1); }}>
                        <SelectTrigger className="w-full md:w-[180px] bg-[#1B1B1B] border-[#4C4E50] text-gray-300 h-10">
                            <SelectValue placeholder="Filtrar por Tipo" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                            <SelectItem value="all">Todos os Tipos</SelectItem>
                            <SelectItem value="Reclamações">Reclamações</SelectItem>
                            <SelectItem value="Perguntas">Perguntas</SelectItem>
                            <SelectItem value="Elogios">Elogios</SelectItem>
                            <SelectItem value="Solicitações">Solicitações</SelectItem>
                            <SelectItem value="Riscos">Riscos</SelectItem>
                            <SelectItem value="Neutro">Neutro</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Search Box */}
                    <div className="relative w-full md:w-72">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        placeholder="Buscar mensagens..."
                        className="pl-9 bg-[#1B1B1B] border-[#4C4E50] text-gray-300 placeholder:text-gray-500 focus:ring-[#E8B930] h-10"
                      />
                    </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-400">
                  <thead className="bg-[#2F2F2F] text-gray-200 uppercase font-manrope font-bold text-xs">
                    <tr>
                      <th className="px-6 py-3 cursor-pointer hover:text-white" onClick={() => handleSort('created_at')}>
                        <div className="flex items-center gap-1">Data/Hora <ArrowUpDown className="w-3 h-3" /></div>
                      </th>
                      <th className="px-6 py-3">Grupo</th>
                      <th className="px-6 py-3">Usuário</th>
                      <th className="px-6 py-3 cursor-pointer hover:text-white" onClick={() => handleSort('type')}>
                         <div className="flex items-center gap-1">Tipo <ArrowUpDown className="w-3 h-3" /></div>
                      </th>
                      <th className="px-6 py-3 w-1/3">Mensagem</th>
                      <th className="px-6 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3C4144]">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                           <div className="flex flex-col items-center gap-2">
                             <div className="w-6 h-6 border-2 border-[#E8B930] border-t-transparent rounded-full animate-spin"></div>
                             <span>Carregando mensagens...</span>
                           </div>
                        </td>
                      </tr>
                    ) : paginatedMessages.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                          Nenhuma mensagem encontrada para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      paginatedMessages.map((msg) => (
                        <tr 
                          key={msg.id} 
                          className="hover:bg-[#2F2F2F] transition-colors cursor-pointer"
                          onClick={() => handleOpenMessageDetails(msg)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            {new Date(msg.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 truncate max-w-[150px]" title={msg.group_name}>
                            {msg.group_name}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                               <span className="text-white font-medium">{msg.user || 'Desconhecido'}</span>
                               <span className="text-xs">{msg.phone}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="bg-[#33393D] border-[#4C4E50] text-gray-300">
                              {translateType(msg.type)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="line-clamp-1 max-w-md text-gray-300 italic">
                              {msg.message || '(sem conteúdo)'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleOpenMessageDetails(msg); }}>
                                <Eye className="w-4 h-4 text-gray-400 hover:text-white" />
                             </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-[#3C4144] flex items-center justify-between bg-[#2F2F2F]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="text-white border-[#4C4E50] hover:bg-[#3C4144]"
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
                    className="text-white border-[#4C4E50] hover:bg-[#3C4144]"
                  >
                    Próximo <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Summary Modal */}
      <Dialog open={summaryModalOpen} onOpenChange={handleSummaryModalOpenChange}>
        <DialogContent className="bg-[#1B1B1B] border-[#3C4144] text-white max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-domine text-xl">
              <Bot className="w-6 h-6 text-[#E8B930]" />
              Resumo IA - Análise de Conversas
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Gerado com base nas {filteredMessages.length} mensagens filtradas.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {summaryLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                 <div className="w-12 h-12 border-4 border-[#E8B930] border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-gray-400 animate-pulse">Analisando conversas com IA...</p>
                 <p className="text-xs text-gray-500 max-w-sm text-center">Isso pode levar alguns segundos dependendo do volume de mensagens.</p>
              </div>
            ) : summaryResult ? (
              <div className="bg-[#2F2F2F] p-6 rounded-lg border border-[#3C4144]">
                 {renderFormattedText(getSummaryContent(summaryResult))}
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
        </DialogContent>
      </Dialog>
      
      {/* Message Details Modal */}
      <Dialog open={messageDetailsModalOpen} onOpenChange={setMessageDetailsModalOpen}>
        <DialogContent className="bg-[#1B1B1B] border-[#3C4144] text-white max-w-2xl">
          <DialogHeader>
             <DialogTitle className="font-domine">Detalhes da Mensagem</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4 pt-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase font-bold">Data</Label>
                    <p className="text-sm">{new Date(selectedMessage.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                   <div>
                    <Label className="text-xs text-gray-500 uppercase font-bold">Tipo</Label>
                    <div><Badge variant="outline" className="mt-1">{translateType(selectedMessage.type)}</Badge></div>
                  </div>
                   <div>
                    <Label className="text-xs text-gray-500 uppercase font-bold">Grupo</Label>
                    <p className="text-sm">{selectedMessage.group_name}</p>
                  </div>
                   <div>
                    <Label className="text-xs text-gray-500 uppercase font-bold">Remetente</Label>
                    <p className="text-sm font-medium">{selectedMessage.user}</p>
                    <p className="text-xs text-gray-400">{selectedMessage.phone}</p>
                  </div>
               </div>
               
               <div className="bg-[#2F2F2F] p-4 rounded-md border border-[#3C4144]">
                  <Label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Conteúdo</Label>
                  <p className="text-gray-200 whitespace-pre-wrap leading-relaxed text-sm">
                    {selectedMessage.message}
                  </p>
               </div>
            </div>
          )}
          <DialogFooter>
             <Button onClick={() => setMessageDetailsModalOpen(false)} className="bg-[#3C4144] hover:bg-[#4C4E50] text-white">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="bg-[#1B1B1B] border-[#3C4144] text-white">
           <DialogHeader>
             <DialogTitle>Configurações</DialogTitle>
             <DialogDescription className="text-gray-400"> Ajuste os parâmetros de integração.</DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
              <div className="space-y-2">
                 <Label htmlFor="webhook" className="text-white">Webhook URL (n8n)</Label>
                 <Input
                   id="webhook"
                   value={webhookUrl}
                   onChange={(e) => setWebhookUrl(e.target.value)}
                   className="bg-[#33393D] border-[#4C4E50] text-white"
                 />
                 <p className="text-xs text-gray-500">URL para onde os dados das mensagens serão enviados para geração do resumo.</p>
              </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setSettingsModalOpen(false)} className="border-[#4C4E50] text-white hover:bg-[#3C4144]">Cancelar</Button>
             <Button onClick={() => setSettingsModalOpen(false)} className="bg-[#E8B930] text-black hover:bg-[#d1a525]">Salvar</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

// Helper Subcomponent
const KpiCard = ({ title, value, icon: Icon, color }) => (
  <Card className="bg-[#252525] border-[#3C4144] shadow-lg">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-bold text-white font-manrope">
              {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
            </span>
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

export default WhatsAppGroupsDashboard;
