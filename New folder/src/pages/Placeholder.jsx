import React from 'react';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

const Placeholder = ({ title }) => {
  return (
    <div className="p-8 min-h-full flex flex-col">
      <header className="mb-10">
        <h1 className="text-3xl font-domine font-bold text-white mb-2">{title}</h1>
        <p className="text-gray-400 font-manrope">Visão geral do painel {title}</p>
      </header>
      
      <div className="flex-1 flex flex-col items-center justify-center bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-12 text-center min-h-[400px]">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-[#33393D] p-6 rounded-full mb-6"
        >
          <Construction className="w-12 h-12 text-[#E8B930]" />
        </motion.div>
        
        <h2 className="text-xl font-domine font-semibold text-white mb-2">
          Em Desenvolvimento
        </h2>
        <p className="text-gray-400 font-manrope max-w-md">
          A seção <strong>{title}</strong> está sendo construída. Em breve você terá acesso a todas as métricas e indicadores.
        </p>
      </div>
    </div>
  );
};

export default Placeholder;