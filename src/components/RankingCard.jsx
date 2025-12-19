import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const RankingCard = ({
  meetings,
  loading
}) => {
  const [selectedPillar, setSelectedPillar] = useState('all');
  const [expandedRows, setExpandedRows] = useState({});
  const [sortBy, setSortBy] = useState('nota');

  // Extract all unique pillars from all questions in all meetings
  const pillars = useMemo(() => {
    if (!meetings) return [];
    const allPillars = new Set();
    meetings.forEach(meeting => {
      // Handle different possible data structures for questions
      const questionsList = meeting.questions || meeting.answers || [];
      questionsList.forEach(q => {
        if (q.pillar || q.category) allPillars.add(q.pillar || q.category);
      });
    });
    // Filter out empty strings or nulls
    return ['all', ...Array.from(allPillars).filter(p => p && p.trim() !== '').sort()];
  }, [meetings]);

  const rankingData = useMemo(() => {
    if (!meetings || meetings.length === 0) return [];
    
    // Group by unique meeting/store instance to show individual evaluations
    const storeEvaluations = [];

    meetings.forEach(meeting => {
      if (!meeting.storeName) return;

      const questionsList = meeting.questions || meeting.answers || [];
      const relevantQuestions = [];
      let totalScore = 0;
      let count = 0;

      questionsList.forEach(q => {
        const currentPillar = q.pillar || q.category;
        
        // Filter by selected pillar if not 'all'
        if (selectedPillar === 'all' || currentPillar === selectedPillar) {
          const score = parseFloat(q.score || q.value || 0);
          
          relevantQuestions.push({
            question: q.question || q.label || 'Sem pergunta',
            comment: q.comment || q.observation || 'Sem comentário',
            score: score,
            pillar: currentPillar
          });
          
          totalScore += score;
          count += 1;
        }
      });

      // Only add to ranking if there are relevant questions for the selected pillar
      if (count > 0) {
        storeEvaluations.push({
          id: meeting.id || `${meeting.companyName}-${meeting.storeName}-${meeting.date}`,
          company: meeting.companyName,
          store: meeting.storeName,
          period: meeting.date ? new Date(meeting.date).toLocaleDateString('pt-BR') : 'N/A',
          questions: relevantQuestions,
          score: (totalScore / count).toFixed(2),
          // Store raw score for sorting
          rawScore: totalScore / count
        });
      }
    });

    // Sort the results
    if (sortBy === 'nota') {
      storeEvaluations.sort((a, b) => b.rawScore - a.rawScore);
    }
    
    return storeEvaluations;
  }, [meetings, selectedPillar, sortBy]);

  const toggleRow = idx => {
    setExpandedRows(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  if (loading) {
    return (
      <div className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6">
        <Skeleton className="h-8 w-64 mb-6 bg-[#3C4144]" />
        <Skeleton className="h-64 w-full bg-[#3C4144]" />
      </div>
    );
  }

  if (!meetings || meetings.length === 0) {
    return (
      <div className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6">
        <h2 className="text-xl font-domine font-semibold text-white mb-2">Visão por ranking de lojas</h2>
        <p className="text-sm text-gray-400 font-manrope mb-6">
          Nenhuma reunião encontrada para os filtros selecionados
        </p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: 0.2 }} 
      className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-domine font-semibold text-white">
          Visão por ranking de lojas
        </h2>
        <Select value={selectedPillar} onValueChange={setSelectedPillar}>
          <SelectTrigger className="w-full sm:w-48 bg-[#33393D] border-[#4C4E50] text-white">
            <SelectValue placeholder="Selecione um pilar" />
          </SelectTrigger>
          <SelectContent className="bg-[#2F2F2F] border-[#4C4E50]">
            <SelectItem value="all" className="text-white hover:bg-[#3C4144] focus:bg-[#3C4144]">Todos os pilares</SelectItem>
            {pillars.filter(p => p !== 'all').map(pillar => (
              <SelectItem key={pillar} value={pillar} className="text-white hover:bg-[#3C4144] focus:bg-[#3C4144]">
                {pillar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-[#3C4144]">
              <th className="text-left text-sm font-manrope font-semibold text-gray-300 pb-3 px-2 w-10"></th>
              <th className="text-left text-sm font-manrope font-semibold text-gray-300 pb-3 px-2">Cliente / Loja</th>
              <th className="text-center text-sm font-manrope font-semibold text-gray-300 pb-3 px-2">Período</th>
              <th className="text-center text-sm font-manrope font-semibold text-gray-300 pb-3 px-2 cursor-pointer hover:text-[#E8B930] transition-colors" onClick={() => setSortBy('nota')}>
                Nota {sortBy === 'nota' && '↓'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rankingData.length > 0 ? (
              rankingData.map((row, idx) => (
                <React.Fragment key={idx}>
                  <tr className="border-b border-[#3C4144] hover:bg-[#33393D] transition-colors">
                    <td className="py-3 px-2">
                      <Button variant="ghost" size="icon" onClick={() => toggleRow(idx)} className="h-6 w-6 text-gray-400 hover:text-white hover:bg-[#3C4144]">
                        {expandedRows[idx] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-sm font-manrope text-white font-medium">{row.company}</div>
                      <div className="text-xs font-manrope text-gray-400">{row.store}</div>
                    </td>
                    <td className="py-3 px-2 text-sm font-manrope text-center text-gray-300">{row.period}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`text-sm font-manrope font-bold px-2 py-1 rounded ${
                        parseFloat(row.score) >= 9 
                          ? 'bg-green-500/10 text-green-400' 
                          : parseFloat(row.score) <= 7 
                            ? 'bg-red-500/10 text-red-400' 
                            : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {row.score}
                      </span>
                    </td>
                  </tr>
                  {expandedRows[idx] && (
                    <tr>
                      <td colSpan="4" className="bg-[#1B1B1B]/50 p-0">
                        <div className="p-4 bg-[#252525] border-y border-[#3C4144]">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[#4C4E50]">
                                <th className="text-left text-xs font-manrope font-semibold text-gray-400 pb-2 px-2 w-1/3">Pergunta</th>
                                <th className="text-left text-xs font-manrope font-semibold text-gray-400 pb-2 px-2">Comentário</th>
                                <th className="text-center text-xs font-manrope font-semibold text-gray-400 pb-2 px-2 w-16">Nota</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.questions.map((q, qIdx) => (
                                <tr key={qIdx} className="border-b border-[#33393D] last:border-0 hover:bg-[#2F2F2F]">
                                  <td className="py-2 px-2 text-xs font-manrope text-gray-300">{q.question}</td>
                                  <td className="py-2 px-2 text-xs font-manrope text-gray-400 italic">
                                    {q.comment !== 'Sem comentário' ? `"${q.comment}"` : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <span className={`text-xs font-manrope font-semibold ${
                                      q.score >= 9 ? 'text-green-400' : q.score <= 7 ? 'text-red-400' : 'text-gray-300'
                                    }`}>
                                      {q.score.toFixed(1)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="py-8 text-center text-sm text-gray-500 font-manrope">
                  Nenhum dado disponível para o pilar selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default RankingCard;