import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const CommentsCard = ({ meetings, loading }) => {
  const aggregatedData = useMemo(() => {
    if (!meetings || meetings.length === 0) return [];

    const questionMap = {};

    meetings.forEach(meeting => {
      // Support nested questions/answers structure
      const questionsList = meeting.questions || meeting.answers || [];

      questionsList.forEach(q => {
        // Use question label or text as key
        const key = q.question || q.label || 'Pergunta sem título';
        const score = parseFloat(q.score || q.value || 0);

        if (!questionMap[key]) {
          questionMap[key] = {
            question: key,
            totalOccurrences: 0,
            scores: [],
            lowScores: 0,
            recentComments: []
          };
        }

        questionMap[key].totalOccurrences += 1;
        questionMap[key].scores.push(score);
        
        // Define low score threshold
        if (score < 7) {
          questionMap[key].lowScores += 1;
        }

        // Aggregate non-empty comments
        const commentText = q.comment || q.observation;
        if (commentText && commentText.trim() !== '') {
          questionMap[key].recentComments.push({
            comment: commentText,
            date: meeting.date,
            store: meeting.storeName
          });
        }
      });
    });

    return Object.values(questionMap)
      .map(item => {
        const avg = item.scores.length > 0 
          ? (item.scores.reduce((a, b) => a + b, 0) / item.scores.length)
          : 0;
          
        return {
          ...item,
          averageScore: avg.toFixed(2),
          rawAverage: avg,
          // Sort comments by date descending
          recentComments: item.recentComments
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3)
        };
      })
      // Sort by number of low scores first (most problematic on top), then by total occurrences
      .sort((a, b) => b.lowScores - a.lowScores || b.totalOccurrences - a.totalOccurrences)
      .slice(0, 10);
  }, [meetings]);

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
      <div className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 h-full">
        <h2 className="text-xl font-domine font-semibold text-white mb-2">
          Comentários mais pontuados
        </h2>
        <p className="text-sm text-gray-400 font-manrope">
          Nenhuma reunião encontrada para os filtros selecionados
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 flex flex-col h-full"
    >
      <h2 className="text-xl font-domine font-semibold text-white mb-6">
        Comentários mais pontuados
      </h2>

      <div className="space-y-4 overflow-y-auto pr-2 flex-1 max-h-[600px] custom-scrollbar">
        {aggregatedData.length > 0 ? (
          aggregatedData.map((item, idx) => (
            <div 
              key={idx}
              className="bg-[#33393D] border border-[#4C4E50] rounded-lg p-4 hover:border-[#E8B930] transition-colors group"
            >
              <div className="flex items-start justify-between mb-3 gap-2">
                <h3 className="text-sm font-manrope font-semibold text-white flex-1 leading-snug">
                  {item.question}
                </h3>
                <Badge 
                  className={`ml-2 shrink-0 ${
                    parseFloat(item.averageScore) >= 9 
                      ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30' 
                      : parseFloat(item.averageScore) >= 7 
                      ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50 hover:bg-yellow-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30'
                  } border font-manrope transition-colors`}
                >
                  {item.averageScore}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 bg-[#252525] p-2 rounded border border-[#3C4144]">
                <div className="text-center border-r border-[#3C4144] last:border-0">
                  <div className="text-[10px] uppercase tracking-wider font-manrope text-gray-500">Ocorrências</div>
                  <div className="text-sm font-manrope font-bold text-white">{item.totalOccurrences}</div>
                </div>
                <div className="text-center border-r border-[#3C4144] last:border-0">
                  <div className="text-[10px] uppercase tracking-wider font-manrope text-gray-500">Média</div>
                  <div className="text-sm font-manrope font-bold text-gray-200">{item.averageScore}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider font-manrope text-gray-500">Notas Baixas</div>
                  <div className={`text-sm font-manrope font-bold ${item.lowScores > 0 ? 'text-red-400' : 'text-gray-200'}`}>
                    {item.lowScores}
                  </div>
                </div>
              </div>

              {item.recentComments.length > 0 ? (
                <div className="border-t border-[#4C4E50] pt-3">
                  <div className="text-xs font-manrope font-semibold text-[#E8B930] mb-2 flex items-center">
                    Comentários recentes
                  </div>
                  <div className="space-y-2">
                    {item.recentComments.map((comment, cIdx) => (
                      <div key={cIdx} className="text-xs font-manrope text-gray-300 bg-[#252525] p-2 rounded">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>{comment.store}</span>
                          <span>{new Date(comment.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <span className="italic text-gray-300">"{comment.comment}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs font-manrope text-gray-500 italic text-center pt-2">
                  Sem comentários textuais
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-gray-400 font-manrope py-8">
            Nenhum dado agregado disponível.
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CommentsCard;