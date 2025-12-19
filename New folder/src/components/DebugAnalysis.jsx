
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Database, 
  AlertTriangle, 
  Search, 
  FileText, 
  RefreshCw,
  Copy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DebugAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [typeAnalysis, setTypeAnalysis] = useState({
    total: 0,
    nullCount: 0,
    emptyCount: 0,
    zeroCount: 0,
    samples: []
  });

  const [companyAnalysis, setCompanyAnalysis] = useState({
    divino: [],
    jah: [],
    allRaw: []
  });

  const [structure, setStructure] = useState({
    totalRows: 0,
    columns: [],
    sampleRow: {}
  });

  const runAnalysis = async () => {
    setLoading(true);
    try {
      // 1. Structure Analysis (Head & 1 Row)
      const { count, error: countError } = await supabase
        .from('chat_histories_custom')
        .select('*', { count: 'exact', head: true });
      
      const { data: oneRow, error: rowError } = await supabase
        .from('chat_histories_custom')
        .select('*')
        .limit(1);

      if (!countError && !rowError) {
        setStructure({
          totalRows: count,
          columns: oneRow.length > 0 ? Object.keys(oneRow[0]) : [],
          sampleRow: oneRow.length > 0 ? oneRow[0] : {}
        });
      }

      // 2. Fetch Data for Type & Company Analysis
      // We limit to 10,000 to prevent crashing browser if table is huge, 
      // but enough to catch patterns.
      const { data: rows, error: dataError } = await supabase
        .from('chat_histories_custom')
        .select('type, empresa')
        .limit(10000); // ADJUST LIMIT IF NEEDED

      if (!dataError && rows) {
        // --- Type Analysis ---
        const nulls = rows.filter(r => r.type === null);
        const empties = rows.filter(r => r.type === '');
        const zeros = rows.filter(r => r.type === '0');
        const distinctTypes = [...new Set(rows.map(r => r.type))];

        setTypeAnalysis({
          total: rows.length,
          nullCount: nulls.length,
          emptyCount: empties.length,
          zeroCount: zeros.length,
          samples: distinctTypes.slice(0, 15) // Show first 15 distinct types
        });

        // --- Company Analysis ---
        const divino = analyzeCompanyVariants(rows, 'Divino Fogão');
        const jah = analyzeCompanyVariants(rows, 'JAH Açaí');

        setCompanyAnalysis({
          divino,
          jah,
          allRaw: rows.map(r => r.empresa)
        });
      }

      setLastUpdated(new Date());

    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const analyzeCompanyVariants = (rows, searchString) => {
    // 1. Filter loosely
    const matches = rows.filter(r => 
      r.empresa && r.empresa.toLowerCase().includes(searchString.toLowerCase())
    );

    // 2. Group by EXACT string content
    const groups = {};
    matches.forEach(m => {
      const key = m.empresa;
      groups[key] = (groups[key] || 0) + 1;
    });

    // 3. Convert to array with details
    return Object.entries(groups).map(([name, count]) => {
      return {
        name,
        count,
        length: name.length,
        // Show char codes to detect hidden spaces
        charCodes: name.split('').map(c => c.charCodeAt(0)).join(', '),
        // JSON stringify makes invisible chars visible (e.g. \u0020)
        safeString: JSON.stringify(name)
      };
    });
  };

  useEffect(() => {
    runAnalysis();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-[#1B1B1B] min-h-screen text-white font-manrope">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3C4144] pb-6">
        <div>
          <h1 className="text-3xl font-domine font-bold text-white flex items-center gap-3">
            <Database className="w-8 h-8 text-[#E8B930]" />
            Diagnóstico de Dados
          </h1>
          <p className="text-gray-400 mt-2">
            Análise estrutural da tabela <code className="bg-[#33393D] px-2 py-0.5 rounded text-[#E8B930]">chat_histories_custom</code>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Atualizado: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button 
            onClick={runAnalysis} 
            disabled={loading}
            className="bg-[#33393D] text-white hover:bg-[#404649]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Reanalisar
          </Button>
        </div>
      </div>

      {/* 1. TYPE Column Analysis */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#E8B930] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> 1. Análise da Coluna TYPE
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Registros Analisados (Amostra)" value={typeAnalysis.total} />
          <StatCard label="TYPE = NULL" value={typeAnalysis.nullCount} warning={typeAnalysis.nullCount > 0} />
          <StatCard label="TYPE = Vazio ('')" value={typeAnalysis.emptyCount} warning={typeAnalysis.emptyCount > 0} />
          <StatCard label="TYPE = '0'" value={typeAnalysis.zeroCount} warning={typeAnalysis.zeroCount > 0} />
        </div>

        <Card className="bg-[#252525] border-[#3C4144]">
          <CardHeader>
            <CardTitle className="text-white text-base">Amostra de Valores em TYPE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {typeAnalysis.samples.map((val, i) => (
                <Badge key={i} variant="outline" className="text-gray-300 border-[#4C4E50]">
                  {val === null ? 'NULL' : val === '' ? "'' (Empty)" : val}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. EMPRESA Duplicates Analysis */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#E8B930] flex items-center gap-2">
          <Search className="w-5 h-5" /> 2. Duplicatas em EMPRESA
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Divino Fogão */}
          <Card className="bg-[#252525] border-[#3C4144]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex justify-between">
                <span>Variações: "Divino Fogão"</span>
                <Badge className="bg-[#E8B930] text-black">{companyAnalysis.divino.length} variantes</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {companyAnalysis.divino.length === 0 ? (
                <p className="text-gray-500 italic">Nenhum registro encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {companyAnalysis.divino.map((item, idx) => (
                    <VariantRow key={idx} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* JAH Açaí */}
          <Card className="bg-[#252525] border-[#3C4144]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex justify-between">
                <span>Variações: "JAH Açaí"</span>
                <Badge className="bg-[#E8B930] text-black">{companyAnalysis.jah.length} variantes</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {companyAnalysis.jah.length === 0 ? (
                <p className="text-gray-500 italic">Nenhum registro encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {companyAnalysis.jah.map((item, idx) => (
                    <VariantRow key={idx} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3. Table Structure */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#E8B930] flex items-center gap-2">
          <FileText className="w-5 h-5" /> 3. Estrutura da Tabela
        </h2>
        <Card className="bg-[#252525] border-[#3C4144]">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-[#3C4144] pb-4">
                <span className="text-gray-400">Total de Linhas (Estimado DB):</span>
                <span className="text-2xl font-mono font-bold text-white">{structure.totalRows.toLocaleString()}</span>
              </div>
              
              <div>
                <span className="text-gray-400 block mb-2">Colunas Detectadas:</span>
                <div className="flex flex-wrap gap-2">
                  {structure.columns.map(col => (
                    <Badge key={col} className="bg-[#33393D] hover:bg-[#33393D] text-gray-200 font-mono text-xs">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

    </div>
  );
};

const StatCard = ({ label, value, warning }) => (
  <Card className={`bg-[#252525] border ${warning ? 'border-red-500/50' : 'border-[#3C4144]'}`}>
    <CardContent className="p-6">
      <p className="text-sm font-medium text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${warning ? 'text-red-400' : 'text-white'}`}>
        {value.toLocaleString()}
      </p>
    </CardContent>
  </Card>
);

const VariantRow = ({ item }) => (
  <div className="bg-[#1B1B1B] p-3 rounded border border-[#3C4144] text-sm">
    <div className="flex justify-between items-start mb-2">
      <span className="font-mono text-[#E8B930] font-bold">{item.safeString}</span>
      <Badge variant="secondary">{item.count} ocorrencias</Badge>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
      <div>Length: {item.length} chars</div>
      <div title="ASCII Char Codes" className="truncate">Codes: {item.charCodes}</div>
    </div>
  </div>
);

export default DebugAnalysis;
