'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function PMODashboard() {
  const { id: projectId } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const orgId = (typeof window !== 'undefined' ? sessionStorage.getItem('orgId') : '') || '';
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/financial/projects/${projectId}/indicators`, {
      headers: { 'x-org-id': orgId },
    })
      .then(res => {
        if (!res.ok) throw new Error('Erro ao carregar indicadores.');
        return res.json();
      })
      .then(result => setData(result))
      .catch(err => setError(err.message));
  }, [projectId]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return <div className="p-8">Carregando indicadores...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#1B5E20] mb-6">Dashboard PMO - Desempenho</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Earned Value (EV)</h3>
          <p className="text-3xl font-bold text-[#1565C0]">R$ {data.EV}</p>
        </div>
        <div className="bg-white p-6 rounded shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Actual Cost (AC)</h3>
          <p className="text-3xl font-bold text-gray-800">R$ {data.AC}</p>
        </div>
        <div className="bg-white p-6 rounded shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-1">CPI (Custo)</h3>
          {data.CPI.value ? <p className="text-3xl font-bold text-[#4CAF50]">{data.CPI.value}</p> : <p className="text-xs text-orange-600">{data.CPI.reason}</p>}
        </div>
        <div className="bg-white p-6 rounded shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-1">SPI (Prazo)</h3>
          {data.SPI.value ? <p className="text-3xl font-bold text-[#4CAF50]">{data.SPI.value}</p> : <p className="text-xs text-orange-600">{data.SPI.reason}</p>}
        </div>
      </div>
    </div>
  );
}