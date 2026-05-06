import { useState, useEffect } from 'react';
import Header from '../layout/Header';
import { Package, MapPin, Wrench } from 'lucide-react';
import Material from './Material';
import Lugar from './Lugar';
import MaquinaCooperativa from './MaquinaCooperativa';
import { supabase } from '../../lib/supabase';

type TabType = 'materiales' | 'lugares' | 'maquina_cooperativa';

export default function Catalogos() {
    const [activeTab, setActiveTab] = useState<TabType>('materiales');
    const [stats, setStats] = useState({ materiales: 0, lugaresTotal: 0, lugaresActivos: 0, equipos: 0 });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        const [matRes, lugRes, lugActRes, maqRes] = await Promise.all([
            supabase.from('material').select('*', { count: 'exact', head: true }),
            supabase.from('lugar').select('*', { count: 'exact', head: true }),
            supabase.from('lugar').select('*', { count: 'exact', head: true }).eq('lug_estado', 'activo'),
            supabase.from('maquina_cooperativa').select('*', { count: 'exact', head: true }).eq('mac_estado', 'activa')
        ]);

        setStats({
            materiales: matRes.count || 0,
            lugaresTotal: lugRes.count || 0,
            lugaresActivos: lugActRes.count || 0,
            equipos: maqRes.count || 0
        });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Recursos" subtitle="GESTIÓN DE MATERIALES, LUGARES Y EQUIPOS" />

            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide bg-gray-50/50">
                {/* Tarjetas de Resumen */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Materiales', value: stats.materiales, icon: Package, bg: 'bg-gray-100', color: 'text-gray-600' },
                        { label: 'Lugares Registrados', value: stats.lugaresTotal, icon: MapPin, bg: 'bg-amber-50', color: 'text-amber-600' },
                        { label: 'Lugares Activos', value: stats.lugaresActivos, icon: MapPin, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                        { label: 'Máquinas', value: stats.equipos, icon: Wrench, bg: 'bg-red-50', color: 'text-red-500' },
                    ].map((s) => {
                        const Icon = s.icon;
                        return (
                            <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover-card-premium">
                                <div className={`w-11 h-11 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                    <Icon size={20} className={s.color} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Selector de Tabs Premium */}
                <div className="flex justify-start">
                    <div className="flex bg-gray-200/60 p-1.5 rounded-2xl border border-gray-100/50 shadow-inner max-w-2xl w-full">
                        <button
                            onClick={() => setActiveTab('materiales')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 uppercase tracking-wider ${activeTab === 'materiales'
                                ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/10'
                                : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'
                                }`}
                        >
                            <Package size={14} />
                            Materiales
                        </button>
                        <button
                            onClick={() => setActiveTab('lugares')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 uppercase tracking-wider ${activeTab === 'lugares'
                                ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/10'
                                : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'
                                }`}
                        >
                            <MapPin size={14} />
                            Lugares
                        </button>
                        <button
                            onClick={() => setActiveTab('maquina_cooperativa')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 uppercase tracking-wider ${activeTab === 'maquina_cooperativa'
                                ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/10'
                                : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'
                                }`}
                        >
                            <Wrench size={14} />
                            Máquinas
                        </button>
                    </div>
                </div>

                {/* Contenido de la tab activa */}
                <div className="bg-transparent mt-4 rounded-3xl overflow-auto">
                    {activeTab === 'materiales' && <Material />}
                    {activeTab === 'lugares' && <Lugar />}
                    {activeTab === 'maquina_cooperativa' && <MaquinaCooperativa />}
                </div>
            </div>
        </div>
    );
}
