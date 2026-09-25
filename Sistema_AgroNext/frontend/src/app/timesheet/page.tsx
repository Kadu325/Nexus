'use client';

import { useState } from 'react';

// NOTA: O endpoint POST /timesheets ainda não existe no backend.
// Este formulário está preparado para quando for implementado.
export default function TimesheetEntry() {
  const [hours, setHours] = useState('');
  const [date, setDate] = useState('');
  const [taskId, setTaskId] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = (typeof window !== 'undefined' ? sessionStorage.getItem('orgId') : '') || '';
    const userId = (typeof window !== 'undefined' ? sessionStorage.getItem('userId') : '') || '';

    try {
      const res = await fetch('/api/timesheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
          'x-user-id': userId,
        },
        body: JSON.stringify({ date, hours: parseFloat(hours), taskId }),
      });
      if (!res.ok) throw new Error('Erro ao lançar horas.');
      setIsError(false);
      setMessage('Horas enviadas para aprovação!');
    } catch (err: any) {
      setIsError(true);
      setMessage(err.message);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-lg bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-xl font-bold text-[#1B5E20] mb-4">Apontamento de Horas</h2>
        {message && (
          <div className={`p-3 mb-4 rounded text-sm ${isError ? 'bg-red-100 text-red-700' : 'bg-[#e8f5e9] text-[#1B5E20]'}`}>
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ID da Tarefa</label>
            <input
              type="text"
              required
              placeholder="Ex: uuid-da-tarefa"
              className="mt-1 w-full px-3 py-2 border rounded"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Data</label>
            <input type="date" required className="mt-1 w-full px-3 py-2 border rounded" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Horas</label>
            <input type="number" step="0.5" min="0" max="24" required className="mt-1 w-full px-3 py-2 border rounded" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <button type="submit" className="w-full bg-[#4CAF50] text-white py-2 px-4 rounded hover:bg-[#1B5E20] transition-colors">
            Lançar Horas
          </button>
        </form>
      </div>
    </div>
  );
}
