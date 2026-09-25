'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

type Action = { id: string; description: string; rawAssignee: string | null; status: string };

export default function MeetingActionsReview() {
  const { id: meetingId } = useParams();
  const [actions, setActions] = useState<Action[]>([
    { id: '1', description: 'Validar contrato de fornecedores', rawAssignee: 'Marcos', status: 'PENDING' },
  ]);
  const [resolvedUsers, setResolvedUsers] = useState<Record<string, string>>({});

  const handleAuthorize = async (actionId: string) => {
    const orgId = (typeof window !== 'undefined' ? sessionStorage.getItem('orgId') : '') || '';
    const userId = (typeof window !== 'undefined' ? sessionStorage.getItem('userId') : '') || '';
    const resolvedUserId = resolvedUsers[actionId] || '';

    if (!resolvedUserId) {
      alert('Selecione um usuário antes de autorizar.');
      return;
    }

    try {
      const res = await fetch(
        `/api/meetings/actions/${actionId}/authorize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-org-id': orgId,
            'x-user-id': userId,
          },
          body: JSON.stringify({ resolvedUserId, projectId: '' }),
        }
      );
      if (!res.ok) throw new Error('Erro ao autorizar ação.');
      setActions(actions.map(a => (a.id === actionId ? { ...a, status: 'AUTHORIZED' } : a)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#1B5E20] mb-6">Ações da Ata (IA) — Reunião</h1>
      <div className="space-y-4 max-w-4xl">
        {actions.map(action => (
          <div key={action.id} className="bg-white p-5 rounded border flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{action.description}</h3>
              <p className="text-sm text-gray-500">Mencionado pela IA: {action.rawAssignee}</p>
            </div>
            {action.status === 'PENDING' ? (
              <div className="flex gap-2">
                <select
                  className="border rounded px-2 text-sm"
                  onChange={e => setResolvedUsers(prev => ({ ...prev, [action.id]: e.target.value }))}
                >
                  <option value="">Resolver usuário...</option>
                  <option value="id-1">Marcos Silva</option>
                </select>
                <button
                  onClick={() => handleAuthorize(action.id)}
                  className="bg-[#1565C0] text-white px-4 py-1 rounded text-sm hover:bg-blue-800 transition-colors"
                >
                  Autorizar
                </button>
              </div>
            ) : (
              <span className="text-[#1B5E20] font-bold">✅ Autorizado</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
