'use client';

import Link from 'next/link';

// Página de listagem de projetos (placeholder - será conectada ao backend futuramente)
const MOCK_PROJECTS = [
  { id: 'proj-1', name: 'Projeto Fazenda Norte', status: 'IN_PROGRESS' },
  { id: 'proj-2', name: 'Expansão Soja Q4', status: 'PLANNING' },
];

export default function ProjectsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#1B5E20] mb-6">Meus Projetos</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_PROJECTS.map(project => (
          <div key={project.id} className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">{project.name}</h2>
            <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
              {project.status.replace(/_/g, ' ')}
            </span>
            <div className="mt-4 flex gap-3">
              <Link href={`/projects/${project.id}/board`} className="text-sm text-[#1565C0] hover:underline">
                Board
              </Link>
              <Link href={`/projects/${project.id}/dashboard`} className="text-sm text-[#1565C0] hover:underline">
                Dashboard PMO
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
