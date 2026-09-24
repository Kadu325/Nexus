'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

type Task = { id: string; title: string; status: string; assignee: { username: string } | null };
const COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export default function KanbanBoard() {
  const { id: projectId } = useParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orgId = (typeof window !== 'undefined' ? sessionStorage.getItem('orgId') : '') || '';
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/tasks`, {
      headers: { 'x-org-id': orgId },
    })
      .then(res => res.json())
      .then(data => { setTasks(Array.isArray(data) ? data : []); setLoading(false); });
  }, [projectId]);

  if (loading) return <div className="p-8 text-[#1B5E20]">Carregando quadro...</div>;

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[#1B5E20]">Sprint Board</h1>
        <p className="text-sm text-gray-600">Arraste os cards para atualizar o progresso.</p>
      </header>

      <div className="flex space-x-4 overflow-x-auto pb-4">
        {COLUMNS.map(column => (
          <div key={column} className="w-80 flex-shrink-0 bg-gray-100 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{column.replace(/_/g, ' ')}</h2>
            <div className="space-y-3">
              {tasks.filter(t => t.status === column).map(task => (
                <div key={task.id} className="bg-white p-4 rounded shadow-sm border border-gray-200">
                  <p className="text-sm font-medium text-gray-800">{task.title}</p>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {task.assignee ? task.assignee.username : 'Não atribuído'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}