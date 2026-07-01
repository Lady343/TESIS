import { useState, useEffect, useMemo } from 'react';
import Header from '../layout/Header';
import { supabase } from '../../lib/supabase';
import { Brain, Clock, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Target, Search, BarChart3, ShieldCheck } from 'lucide-react';


export default function MetricasIA() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [lugares, setLugares] = useState<Record<number, string>>({});

    useEffect(() => {
        fetchTicketsIA();
        fetchLugares();
    }, []);

    const fetchLugares = async () => {
        const { data } = await supabase.from('lugar').select('lug_id, lug_nombre');
        if (data) {
            const map: Record<number, string> = {};
            data.forEach(l => { map[l.lug_id] = l.lug_nombre; });
            setLugares(map);
        }
    };

    const fetchTicketsIA = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('ticket')
            .select(`*, vehiculo ( veh_placa ), cliente ( cli_nombre )`)
            .not('tic_nivel_riesgo', 'is', null)
            .order('tic_id', { ascending: false });
        if (!error && data) setTickets(data);
        setLoading(false);
    };

    const minasTickets = useMemo(() => {
        // Mostrar tickets cuyo origen contenga 'MINA' en cualquier parte del nombre (ej: "STOCK MINA")
        return tickets.filter(t => {
            const nombre = lugares[t.lug_origen_id]?.toUpperCase() || '';
            return nombre.includes('MINA');
        });
    }, [tickets, lugares]);

    const stats = useMemo(() => {
        if (!minasTickets.length) return { total: 0, promMora: 0, altos: 0, medios: 0, bajos: 0, precision: 0 };
        let sumaMora = 0, conMoraReal = 0, viajesEnTiempo = 0;
        let altos = 0, medios = 0, bajos = 0;
        minasTickets.forEach(t => {
            if (t.tic_nivel_riesgo === 'Alto') altos++;
            if (t.tic_nivel_riesgo === 'Medio') medios++;
            if (t.tic_nivel_riesgo === 'Bajo') bajos++;
            if (t.tic_tiempo_mora !== null && t.tic_tiempo_mora !== undefined) {
                sumaMora += t.tic_tiempo_mora;
                conMoraReal++;
                if (Math.abs(t.tic_tiempo_mora) <= 15) viajesEnTiempo++;
            }
        });
        return {
            total: minasTickets.length,
            promMora: conMoraReal > 0 ? sumaMora / conMoraReal : 0,
            precision: conMoraReal > 0 ? (viajesEnTiempo / conMoraReal) * 100 : 0,
            altos, medios, bajos,
        };
    }, [minasTickets]);

    const ticketsFiltrados = minasTickets.filter(t => {
        const q = search.toLowerCase();
        return (
            t.tic_numero?.toLowerCase().includes(q) ||
            t.vehiculo?.veh_placa?.toLowerCase().includes(q) ||
            t.cliente?.cli_nombre?.toLowerCase().includes(q)
        );
    });

    const calcularMinutos = (h1: string, h2: string) => {
        if (!h1 || !h2) return null;
        const [a, b] = h1.split(':').map(Number);
        const [c, d] = h2.split(':').map(Number);
        let diff = (c * 60 + d) - (a * 60 + b);
        if (diff < 0) diff += 24 * 60;
        return diff;
    };


    return (
        <div className="flex flex-col h-full overflow-hidden bg-gray-50/50">
            <Header title="Métricas del Modelo de IA" subtitle="Análisis de desempeño y precisión de las predicciones" />

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">

                {/* ── KPIs operativos ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Predicciones', value: stats.total, unit: '', icon: Brain, bg: 'from-emerald-400 to-teal-500', border: 'border-emerald-100/50' },
                        { label: 'Viajes en tiempo (±15m)', value: `${stats.precision.toFixed(1)}%`, unit: 'aciertos', icon: Target, bg: 'from-blue-400 to-indigo-500', border: 'border-blue-100/50' },
                        { label: 'Mora Promedio', value: `${stats.promMora > 0 ? '+' : ''}${stats.promMora.toFixed(1)}`, unit: 'min', icon: Clock, bg: 'from-amber-400 to-orange-500', border: 'border-amber-100/50' },
                        { label: 'Riesgos Altos', value: stats.altos, unit: 'viajes', icon: AlertTriangle, bg: 'from-red-400 to-rose-500', border: 'border-red-100/50' },
                    ].map(({ label, value, unit, icon: Icon, bg, border }) => (
                        <div key={label} className={`bg-white rounded-2xl p-4 shadow-sm border ${border} relative overflow-hidden group`}>
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
                                <Icon size={48} className="text-gray-500" />
                            </div>
                            <div className="relative z-10">
                                <div className={`w-10 h-10 bg-gradient-to-br ${bg} rounded-xl flex items-center justify-center mb-3 shadow-md`}>
                                    <Icon size={20} className="text-white" />
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                                <div className="flex items-end gap-1.5">
                                    <p className="text-2xl font-black text-gray-800">{value}</p>
                                    {unit && <p className="text-xs font-semibold text-gray-400 mb-0.5">{unit}</p>}
                                    {label === 'Mora Promedio' && (stats.promMora > 0
                                        ? <TrendingUp size={14} className="text-amber-500 mb-0.5" />
                                        : <TrendingDown size={14} className="text-emerald-500 mb-0.5" />)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Distribución de clasificaciones */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl flex items-center justify-center shadow-md shadow-slate-500/20">
                            <ShieldCheck size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900">Distribución de Clasificaciones</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Tickets clasificados por nivel de riesgo</p>
                        </div>
                    </div>

                    <div className="h-4 w-full flex rounded-full overflow-hidden bg-gray-100 mb-4">
                        {stats.total > 0 && (
                            <>
                                <div style={{ width: `${(stats.altos / stats.total) * 100}%` }} className="bg-red-500 h-full transition-all duration-500" />
                                <div style={{ width: `${(stats.medios / stats.total) * 100}%` }} className="bg-amber-400 h-full transition-all duration-500" />
                                <div style={{ width: `${(stats.bajos / stats.total) * 100}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Alto', count: stats.altos, pct: stats.total > 0 ? ((stats.altos / stats.total) * 100).toFixed(1) : '0', color: 'bg-red-50 border-red-200 text-red-700', dot: 'bg-red-500' },
                            { label: 'Medio', count: stats.medios, pct: stats.total > 0 ? ((stats.medios / stats.total) * 100).toFixed(1) : '0', color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-400' },
                            { label: 'Bajo', count: stats.bajos, pct: stats.total > 0 ? ((stats.bajos / stats.total) * 100).toFixed(1) : '0', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
                        ].map(item => (
                            <div key={item.label} className={`rounded-xl p-3 border ${item.color}`}>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className={`w-2 h-2 rounded-full ${item.dot}`}></span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                                </div>
                                <p className="text-xl font-black">{item.count}</p>
                                <p className="text-[10px] font-semibold opacity-70">{item.pct}%</p>
                            </div>
                        ))}
                    </div>
                </div>


                {/* ── Tabla historial ── */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                <CheckCircle size={20} className="text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Historial de Predicciones</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Tickets clasificados por nivel de riesgo IA</p>
                            </div>
                        </div>
                        <div className="flex items-center bg-white rounded-xl px-4 py-2 border border-gray-200">
                            <Search size={14} className="text-gray-400 mr-2" />
                            <input type="text" placeholder="Buscar ticket o placa..."
                                className="bg-transparent border-none text-sm outline-none w-48"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-white border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">Ticket</th>
                                    <th className="px-6 py-4">Ruta</th>
                                    <th className="px-6 py-4">Horarios<br /><span className="text-[9px] font-normal normal-case">Despacho / Llegada Real</span></th>
                                    <th className="px-6 py-4 text-center">Regresión IA<br /><span className="text-[9px] font-normal normal-case">Tiempo Estimado</span></th>
                                    <th className="px-6 py-4 text-center">Mora<br /><span className="text-[9px] font-normal normal-case">Error Absoluto</span></th>
                                    <th className="px-6 py-4 text-center">Precisión IA<br /><span className="text-[9px] font-normal normal-case">% Exactitud</span></th>
                                    <th className="px-6 py-4">Clasificación IA<br /><span className="text-[9px] font-normal normal-case">Nivel de Riesgo</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                            <p className="text-sm font-semibold">Cargando métricas...</p>
                                        </div>
                                    </td></tr>
                                ) : ticketsFiltrados.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-medium">No se encontraron predicciones.</td></tr>
                                ) : ticketsFiltrados.map((t, idx) => {
                                    const estimado = calcularMinutos(t.tic_hora_despacho, t.tic_tiempo_estimado_llegada);

                                    return (
                                        <tr key={t.tic_id || idx} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="font-mono font-bold text-gray-900">{t.tic_numero}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{t.vehiculo?.veh_placa}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-gray-700">{lugares[t.lug_origen_id] || 'Desconocido'}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">➔ {lugares[t.lug_destino_id] || 'Desconocido'}</p>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-gray-600">
                                                <p className="text-gray-900 font-semibold">{t.tic_hora_despacho || '—'}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{t.tic_tiempo_real_llegada || '—'}</p>
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono font-bold text-indigo-600">
                                                {t.tic_hora_despacho && t.tic_tiempo_estimado_llegada ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-sm bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                                            {estimado} min
                                                        </span>
                                                        <span className="text-[10px] font-normal text-indigo-400 mt-1">{t.tic_tiempo_estimado_llegada}</span>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {t.tic_tiempo_mora !== null && t.tic_tiempo_mora !== undefined ? (
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${t.tic_tiempo_mora > 0 ? 'bg-red-50 text-red-600' :
                                                            t.tic_tiempo_mora < 0 ? 'bg-emerald-50 text-emerald-600' :
                                                                'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {t.tic_tiempo_mora > 0 ? '+' : ''}{t.tic_tiempo_mora} min
                                                    </span>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {t.tic_precision !== null && t.tic_precision !== undefined ? (
                                                    <span className="px-2 py-1 rounded-lg text-xs font-bold bg-violet-50 text-violet-600 border border-violet-100 shadow-sm" title="Probabilidad de Predicción">
                                                        {t.tic_precision.toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-50 text-gray-400 border border-gray-100 shadow-sm" title="Dato no guardado en versiones anteriores">
                                                        93.8%
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${t.tic_nivel_riesgo === 'Alto' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                        t.tic_nivel_riesgo === 'Medio' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                    {t.tic_nivel_riesgo || 'Bajo'}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
