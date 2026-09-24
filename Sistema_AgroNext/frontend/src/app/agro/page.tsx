'use client';

export default function AgroDashboard() {
  const indicators = [
    { id: '1', name: 'Eficiência de Irrigação', value: 92.5, unit: '%', source: 'Telemetria IoT' },
    { id: '2', name: 'Energia Solar', value: 450, unit: 'kWh', source: 'Inversor Weg' }
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#1B5E20] mb-6">Painel AgroTech</h1>
      <div className="bg-gray-200 w-full h-64 rounded-lg mb-8 flex items-center justify-center border shadow-inner">
        <span className="text-gray-500">Integração GIS e Mapa de Fazendas</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {indicators.map(ind => (
          <div key={ind.id} className="bg-white p-5 rounded border">
            <h3 className="font-bold text-[#1565C0] text-lg">{ind.name}</h3>
            <p className="text-xs text-gray-500">Fonte: {ind.source}</p>
            <div className="mt-2">
              <span className="text-2xl font-bold text-[#4CAF50]">{ind.value}</span>
              <span className="ml-1 text-sm">{ind.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}