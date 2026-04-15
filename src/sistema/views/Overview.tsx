import { useState, useEffect, useMemo } from 'react';
import Header from '../layout/Header';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const PERIODS = ['7 días', '1 mes', '3 meses', '1 año'] as const;
type Period = typeof PERIODS[number];

function Sparkline({ data, color }: { data: number[]; color: string }) {
    if (!data || data.length === 0) return null;
    const w = 80, h = 28;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function LineChart({ labels, values }: { labels: string[]; values: number[] }) {
    if (!values || values.length === 0) return <div className="h-[175px] flex items-center justify-center text-gray-400 text-sm">No hay datos suficientes</div>;

    const W = 560, H = 175, PL = 40, PR = 20, PT = 16, PB = 28;
    const cW = W - PL - PR, cH = H - PT - PB;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const pts = values.map((v, i) => {
        const x = PL + (i / (values.length - 1)) * cW;
        const y = PT + cH - ((v - min) / range) * cH;
        return { x, y, v };
    });

    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `${pathD} L ${pts[pts.length - 1].x} ${PT + cH} L ${pts[0].x} ${PT + cH} Z`;

    const yTicks = 4;
    const peak = pts.reduce((a, b) => b.v > a.v ? b : a, pts[0]);

    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
            </defs>
            {Array.from({ length: yTicks + 1 }).map((_, i) => {
                const y = PT + (i / yTicks) * cH;
                const val = Math.round(max - (i / yTicks) * range);
                return (
                    <g key={i}>
                        <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                        <text x={PL - 6} y={y + 4} fontSize="9" fill="#94a3b8" textAnchor="end">{val}</text>
                    </g>
                );
            })}
            <path d={areaD} fill="url(#lineGrad)" />
            <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={peak.x} cy={peak.y} r="5" fill="#6366f1" />
            <circle cx={peak.x} cy={peak.y} r="8" fill="#6366f1" fillOpacity="0.2" />
            <rect x={peak.x - 26} y={peak.y - 30} width="52" height="22" rx="6" fill="#6366f1" />
            <text x={peak.x} y={peak.y - 16} fontSize="10" fill="white" textAnchor="middle" fontWeight="700">{peak.v} tck</text>
            {pts.map((p, i) => (
                <text key={i} x={p.x} y={H - 6} fontSize="9" fill="#94a3b8" textAnchor="middle">{labels[i]}</text>
            ))}
            {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke="#6366f1" strokeWidth="2" />
            ))}
        </svg>
    );
}

function DonutChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <div className="w-[140px] h-[140px] flex items-center justify-center text-gray-400 text-xs text-center border-4 border-gray-100 rounded-full">Sin<br/>Datos</div>;
    
    const r = 54, cx = 70, cy = 70, stroke = 22;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    
    const sorted = [...data].sort((a,b) => b.pct - a.pct);
    const highlighted = sorted[0];

    return (
        <svg width="140" height="140" viewBox="0 0 140 140">
            {sorted.map((d, i) => {
                const dash = (d.pct / 100) * circ;
                const gap = circ - dash;
                const seg = (
                    <circle
                        key={i}
                        cx={cx} cy={cy} r={r}
                        fill="none"
                        stroke={d.color}
                        strokeWidth={stroke}
                        strokeDasharray={`${dash} ${gap}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 70 70)"
                    />
                );
                offset += dash;
                return seg;
            })}
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="16" fontWeight="700" fill="#1e293b">{highlighted?.pct?.toFixed(0)}%</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7.5" fill="#94a3b8">Principal</text>
        </svg>
    );
}

export default function Overview() {
    const [period, setPeriod] = useState<Period>('1 mes');
    const [tickets, setTickets] = useState<any[]>([]);
    const [counts, setCounts] = useState({
        socios: 0,
        volquetas: 0,
        facturacion: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            const [tRes, sRes, vRes, pRes] = await Promise.all([
                supabase.from('ticket').select('tic_fecha, tic_recorrido_km, tic_cubicaje, cliente:cli_id(cli_nombre), material:mat_id(mat_nombre)'),
                supabase.from('transportista').select('*', { count: 'exact', head: true }).eq('tra_tipo', 'socio').eq('tra_estado', 'activo'),
                supabase.from('vehiculo').select('*', { count: 'exact', head: true }).eq('veh_estado', 'activa'),
                supabase.from('pago').select('pag_total')
            ]);
            
            if (tRes.data) setTickets(tRes.data);
            
            const totalPagos = (pRes.data || []).reduce((sum, p) => sum + p.pag_total, 0);
            
            setCounts({
                socios: sRes.count || 0,
                volquetas: vRes.count || 0,
                facturacion: totalPagos
            });
            setLoading(false);
        };
        fetchDashboardData();
    }, []);

    const dashboardData = useMemo(() => {
        // Función para obtener fecha LOCAL en formato YYYY-MM-DD (evita desfase UTC-5)
        const toLocalDateStr = (d: Date): string => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        // Line chart data
        const dateCounts: Record<string, number> = {};
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let daysToLookBack = 30;
        if (period === '7 días') daysToLookBack = 7;
        else if (period === '3 meses') daysToLookBack = 90;
        else if (period === '1 año') daysToLookBack = 365;

        // Generar claves de fechas en hora LOCAL (no UTC)
        // +1 día extra hacia adelante para capturar tickets guardados con fecha UTC (un día más)
        for (let i = daysToLookBack - 1; i >= -1; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dateCounts[toLocalDateStr(d)] = 0;
        }

        tickets.forEach(t => {
            if (!t.tic_fecha) return;
            // Tomar siempre los primeros 10 caracteres: YYYY-MM-DD
            const fechaKey = String(t.tic_fecha).substring(0, 10);
            if (dateCounts[fechaKey] !== undefined) {
                dateCounts[fechaKey]++;
            } else {
                // Si la fecha no está en el rango, ignorar silenciosamente
            }
        });

        // Agrupar por días o semanas/meses
        let labels: string[] = [];
        let values: number[] = [];

        if (period === '7 días' || period === '1 mes') {
            const keys = Object.keys(dateCounts).sort();
            if (period === '7 días') {
                labels = keys.map(k => {
                    const d = new Date(k + 'T12:00:00Z');
                    return ['D','L','M','X','J','V','S'][d.getDay()];
                });
                values = keys.map(k => dateCounts[k]);
            } else {
                // 1 mes - simplificamos a días o semanas
                // Reduciremos a ~7-10 puntos para que no se vea sobrecargado
                const chunkSize = Math.ceil(keys.length / 8);
                for(let i=0; i<keys.length; i+=chunkSize) {
                    const chunk = keys.slice(i, i+chunkSize);
                    labels.push(`D${i+1}`);
                    values.push(chunk.reduce((sum, k) => sum + dateCounts[k], 0));
                }
            }
        } else {
            // Meses
            const monthlyCounts: Record<string, number> = {};
            Object.keys(dateCounts).forEach(k => {
                const mes = k.substring(0, 7);
                monthlyCounts[mes] = (monthlyCounts[mes] || 0) + dateCounts[k];
            });
            const mKeys = Object.keys(monthlyCounts).sort();
            labels = mKeys.map(k => {
                const [, m] = k.split('-');
                return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1];
            });
            values = mKeys.map(k => monthlyCounts[k]);
        }

        const lineData = { labels, values };

        // Dona materiales
        const matCounts: Record<string, number> = {};
        tickets.forEach(t => {
            const name = t.material?.mat_nombre || 'Desconocido';
            matCounts[name] = (matCounts[name] || 0) + 1;
        });
        
        const COLORS = ['#6366f1', '#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#94a3b8'];
        const totalMat = tickets.length || 1;
        const donutData = Object.entries(matCounts)
            .sort((a,b) => b[1] - a[1])
            .map(([nombre, count], idx) => ({
                nombre,
                pct: (count / totalMat) * 100,
                color: COLORS[idx % COLORS.length]
            }));

        // Clientes top
        const cliCounts: Record<string, number> = {};
        tickets.forEach(t => {
            const name = t.cliente?.cli_nombre || 'Desconocido';
            cliCounts[name] = (cliCounts[name] || 0) + 1;
        });

        const cliTable = Object.entries(cliCounts)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5)
            .map(([nombre, count]) => ({
                nombre,
                tickets: count,
                pct: ((count / totalMat) * 100).toFixed(1) + '%',
                cambio: '+0.0'
            }));

        return { lineData, donutData, cliTable };
    }, [tickets, period]);

    const totalKm = tickets.reduce((sum, t) => sum + (parseFloat(t.tic_recorrido_km) || 0), 0);
    const totalCubicaje = tickets.reduce((sum, t) => sum + (parseFloat(t.tic_cubicaje) || 0), 0);
    const kmLabel = totalKm > 0 ? `${totalKm.toFixed(0)} km` : `${totalCubicaje.toFixed(1)} m³`;
    const kmSub = totalKm > 0 ? 'KM recorridos' : 'Cubicaje total';
    const kmSpark = totalKm > 0
        ? [totalKm * 0.1, totalKm * 0.2, totalKm * 0.3, totalKm * 0.4, totalKm * 0.5, totalKm * 0.6, totalKm * 0.7, totalKm * 0.85, totalKm * 0.95, totalKm]
        : [totalCubicaje * 0.2, totalCubicaje * 0.4, totalCubicaje * 0.5, totalCubicaje * 0.6, totalCubicaje * 0.7, totalCubicaje * 0.8, totalCubicaje * 0.9, totalCubicaje];

    const MINI_CARDS = [
        { label: 'Tickets totales', value: tickets.length.toString(), sub: 'Total viajes', change: '—', up: true, color: '#6366f1', spark: [5, 12, 8, 15, 10, 18, 14, 21, 17, tickets.length || 24] },
        { label: 'Socios activos', value: counts.socios.toString(), sub: 'Colaboradores', change: '—', up: true, color: '#0ea5e9', spark: [78, 79, 80, 81, 82, 83, 83, 84, 85, counts.socios || 87] },
        { label: 'Volquetas', value: counts.volquetas.toString(), sub: 'Unidades activas', change: '—', up: true, color: '#ef4444', spark: [60, 61, 62, 60, 61, 63, 62, 63, 62, counts.volquetas || 63] },
        { label: 'Operativo', value: kmLabel, sub: kmSub, change: '—', up: true, color: '#10b981', spark: kmSpark },
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Estadísticas Operativas" subtitle="Vista general del sistema de transporte de la cooperativa" />

            <div className="flex-1 overflow-y-auto bg-gray-50/60 relative scrollbar-hide">
                <div className="absolute top-0 left-0 w-full h-[320px] overflow-hidden pointer-events-none opacity-40">
                    <svg className="absolute w-[200%] h-full animate-wave-slow outline-none" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M0,0 C150,0 200,100 400,100 C600,100 800,0 1200,0 L1200,120 L0,120 Z" fill="url(#waveGrad1)" />
                        <defs>
                            <linearGradient id="waveGrad1" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <svg className="absolute w-[200%] h-full animate-wave-fast top-4 opacity-50 outline-none" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M0,0 C150,0 300,80 600,80 C900,80 1050,0 1200,0 L1200,120 L0,120 Z" fill="url(#waveGrad2)" />
                        <defs>
                            <linearGradient id="waveGrad2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
                                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>

                <div className="relative z-10 p-5 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-64 text-gray-500 font-medium bg-white/50 rounded-2xl backdrop-blur-sm">
                            Cargando métricas...
                        </div>
                    ) : (
                        <>
                            {/* ── Fila 1: gráfico grande + 4 mini tarjetas ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
                                        <div>
                                            <h2 className="font-bold text-gray-900 text-base">Tickets por Período</h2>
                                            <p className="text-xs text-gray-400 mt-0.5 font-medium">Volumen de despachos registrados</p>
                                        </div>
                                        <div className="flex gap-1 bg-gray-50 p-1 rounded-xl overflow-x-auto flex-shrink-0">
                                            {PERIODS.map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setPeriod(p)}
                                                    className={`px-2.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap ${period === p
                                                        ? 'bg-white text-indigo-600 shadow-sm'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="w-full">
                                        <LineChart labels={dashboardData.lineData.labels} values={dashboardData.lineData.values} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {MINI_CARDS.map((c) => (
                                        <div
                                            key={c.label}
                                            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col justify-between"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.color + '15' }}>
                                                    <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: c.color }} />
                                                </div>
                                                <Sparkline data={c.spark} color={c.color} />
                                            </div>
                                            <div>
                                                <p className="text-xl font-black text-gray-900 leading-none">{c.value}</p>
                                                <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-wider">{c.sub}</p>
                                            </div>
                                            <div className={`flex items-center gap-1 mt-3 text-xs font-bold px-2 py-1 rounded-lg w-fit ${c.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                {c.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                {c.change}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Fila 2: dona + tabla clientes ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 backdrop-blur-sm bg-white/90">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="font-bold text-gray-900 text-base">Distribución Materiales</h2>
                                            <p className="text-xs text-gray-400 mt-0.5 font-medium">Uso por tipo de carga</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8 px-2">
                                        <div className="flex-shrink-0 transform hover:scale-105 transition-transform duration-500">
                                            <DonutChart data={dashboardData.donutData} />
                                        </div>
                                        <div className="flex-1 space-y-3 max-h-36 overflow-y-auto pr-2">
                                            {dashboardData.donutData.length === 0 ? (
                                                <p className="text-xs text-gray-500">No hay datos</p>
                                            ) : dashboardData.donutData.map((m) => (
                                                <div key={m.nombre} className="flex items-center gap-3 group">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform" style={{ background: m.color }} />
                                                        <span className="text-xs font-medium text-gray-600 truncate group-hover:text-gray-900 transition-colors" title={m.nombre}>{m.nombre}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-1000 animate-shimmer" style={{ width: `${m.pct}%`, background: m.color }} />
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-500 w-8 text-right">{m.pct.toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 backdrop-blur-sm bg-white/90">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="font-bold text-gray-900 text-base">Top Clientes</h2>
                                            <p className="text-xs text-gray-400 mt-0.5 font-medium">Mayor volumen de tickets</p>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto table-responsive">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                                    <th className="text-left pb-4">Cliente</th>
                                                    <th className="text-right pb-4">Tickets</th>
                                                    <th className="text-right pb-4">Del total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {dashboardData.cliTable.length === 0 ? (
                                                    <tr><td colSpan={3} className="py-4 text-center text-xs text-gray-500">No hay datos</td></tr>
                                                ) : dashboardData.cliTable.map((c) => {
                                                    return (
                                                        <tr key={c.nombre} className="hover:bg-gray-50/50 transition-colors group">
                                                            <td className="py-3 text-gray-700 font-bold text-xs group-hover:text-indigo-600 transition-colors truncate max-w-[150px]" title={c.nombre}>{c.nombre}</td>
                                                            <td className="py-3 text-gray-600 text-xs text-right font-mono font-bold">{c.tickets.toLocaleString()}</td>
                                                            <td className="py-3 text-gray-500 text-xs text-right font-medium">{c.pct}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
