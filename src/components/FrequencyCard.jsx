import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const FrequencyCard = ({ meetings, loading, filters, onMeetingClick }) => {
  const data = useMemo(() => {
    if (!meetings || meetings.length === 0) {
      return { 
        stores: [], 
        weeks: [], 
        matrix: {}, 
        totalMeetings: 0, 
        totalPossible: 0, 
        engagement: '0.0' 
      };
    }

    const from = new Date(filters.from);
    const to = new Date(filters.to);
    
    const stores = [...new Set(meetings.map(m => m.storeName))].filter(Boolean).sort();
    const weeks = [];
    
    let current = new Date(from);
    // Align start to start of week if needed, or just use date ranges
    while (current <= to) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weeks.push({
        start: new Date(weekStart),
        end: weekEnd > to ? new Date(to) : new Date(weekEnd),
        label: `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`
      });
      current.setDate(current.getDate() + 7);
    }

    const matrix = {};
    stores.forEach(store => {
      matrix[store] = {};
      weeks.forEach((week, idx) => {
        matrix[store][idx] = [];
      });
    });

    // Calculate Engagement based on videoCallAnsweredStatus.answered
    let answeredCount = 0;

    meetings.forEach(meeting => {
      // Check engagement
      if (meeting.videoCallAnsweredStatus && meeting.videoCallAnsweredStatus.answered === true) {
        answeredCount++;
      }

      const meetingDate = new Date(meeting.date);
      const store = meeting.storeName;
      if (!store) return;

      weeks.forEach((week, idx) => {
        // Simple date inclusion check
        if (meetingDate >= week.start && meetingDate <= week.end) { // Includes end date logic roughly
           // Note: week.end logic above might cut off if time is involved, let's just check days logic if exact comparison fails
           // But comparing Date objects directly works if times are handled or if ranges are inclusive
           if (!matrix[store][idx]) matrix[store][idx] = [];
           matrix[store][idx].push(meeting);
        }
      });
    });

    const totalMeetings = meetings.length;
    // Count meetings: Actually performed meetings / Total Possible Slots (Stores * Weeks)
    const totalPossible = stores.length * weeks.length;
    
    // Engagement: (meetings with answered=true) / (total meetings) * 100
    const engagement = totalMeetings > 0 
      ? ((answeredCount / totalMeetings) * 100).toFixed(1) 
      : '0.0';

    return { stores, weeks, matrix, totalMeetings, totalPossible, engagement };
  }, [meetings, filters]);

  if (loading) {
    return (
      <div className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 h-full">
        <Skeleton className="h-8 w-64 mb-4 bg-[#3C4144]" />
        <Skeleton className="h-4 w-48 mb-6 bg-[#3C4144]" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-12 w-full bg-[#3C4144]" />
          ))}
        </div>
      </div>
    );
  }

  if (!meetings || meetings.length === 0) {
    return (
      <div className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 h-full">
        <h2 className="text-xl font-domine font-semibold text-white mb-2">
          Frequências nas reuniões
        </h2>
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
      className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 h-full flex flex-col"
    >
      <h2 className="text-xl font-domine font-semibold text-white mb-2">
        Frequências nas reuniões
      </h2>
      <p className="text-sm text-gray-400 font-manrope mb-6">
        Contagem: {data.totalMeetings}/{data.totalPossible} | Engajamento: {data.engagement}%
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-[#3C4144]">
              <th className="text-left text-sm font-manrope font-semibold text-gray-300 pb-3 px-2 sticky left-0 bg-[#2F2F2F] z-10">
                Loja
              </th>
              {data.weeks.map((week, idx) => (
                <th key={idx} className="text-center text-sm font-manrope font-semibold text-gray-300 pb-3 px-2 min-w-[120px]">
                  {week.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.stores.map(store => (
              <tr key={store} className="border-b border-[#3C4144] hover:bg-[#33393D] transition-colors">
                <td className="py-3 px-2 text-sm font-manrope text-white sticky left-0 bg-[#2F2F2F] z-10 group-hover:bg-[#33393D]">
                  {store}
                </td>
                {data.weeks.map((week, idx) => (
                  <td key={idx} className="py-3 px-2 text-center align-top">
                    <div className="flex flex-col gap-1 items-center">
                      {data.matrix[store][idx]?.map((meeting, mIdx) => {
                        const meetingDate = new Date(meeting.date);
                        const day = meetingDate.getDate().toString().padStart(2, '0');
                        const month = (meetingDate.getMonth() + 1).toString().padStart(2, '0');
                        const hour = meetingDate.getHours().toString().padStart(2, '0');
                        const minute = meetingDate.getMinutes().toString().padStart(2, '0');
                        
                        const dateStr = `${day}/${month} – ${hour}:${minute}`;
                        
                        return (
                          <TooltipProvider key={mIdx}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  onClick={() => onMeetingClick(meeting)}
                                  className="bg-[#E8B930] hover:bg-[#FFD54F] text-[#1B1B1B] cursor-pointer transition-all text-[10px] font-manrope whitespace-nowrap px-1.5 py-0.5"
                                >
                                  {dateStr}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#33393D] border-[#4C4E50] text-white">
                                <p className="font-manrope text-xs">
                                  Auditor: {meeting.auditor?.name || 'N/A'}<br />
                                  Nota: {meeting.averageScore?.toFixed(1) || 'N/A'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default FrequencyCard;