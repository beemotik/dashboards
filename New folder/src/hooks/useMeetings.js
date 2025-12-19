import { useState, useEffect } from 'react';

export const useMeetings = (filters) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only fetch if required filters are present
    const hasRequiredFilters = filters.companyName && filters.from && filters.to;

    if (!hasRequiredFilters) {
      setMeetings([]);
      setLoading(false);
      return;
    }

    const fetchMeetings = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        
        // Add query parameters required by the new endpoint
        if (filters.tenantId) params.append('tenantId', filters.tenantId);
        if (filters.companyName) params.append('companyName', filters.companyName);
        if (filters.from) params.append('from', filters.from);
        if (filters.to) params.append('to', filters.to);

        // Updated endpoint to n8n webhook
        const url = `https://n8n.beemotik.com/webhook/reunioesdatameet?${params.toString()}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Handle empty results or non-array responses safely
        let filteredData = Array.isArray(data) ? data : [];

        // Client-side filtering for parameters not supported by the API endpoint

        if (filters.storeName && filters.storeName !== 'ALL') {
          filteredData = filteredData.filter(m => m.storeName === filters.storeName);
        }

        if (filters.auditor && filters.auditor !== 'ALL') {
          filteredData = filteredData.filter(m => m.auditor?.name === filters.auditor);
        }

        // Status filtering handling 'answered' property if present, with fallbacks
        if (filters.status !== 'Todas') {
          if (filters.status === 'Finalizada') {
            filteredData = filteredData.filter(m => 
              m.answered === true || 
              (m.answered !== false && (m.status === 'completed' || (m.averageScore !== null && m.averageScore !== undefined)))
            );
          } else if (filters.status === 'Não respondida') {
            filteredData = filteredData.filter(m => 
              m.answered === false || 
              (m.answered !== true && (!m.status || m.status === 'pending'))
            );
          }
        }

        setMeetings(filteredData);
      } catch (err) {
        console.error('Error fetching meetings:', err);
        setError(err.message);
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, [filters]); // React to changes in the full filters object passed to the hook

  return { meetings, loading, error };
};