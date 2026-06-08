import { useState, useEffect, useMemo } from 'react';
import Header from '../layout/Header';
import { Truck, DollarSign, FileText, Download, Filter, FileSpreadsheet, Briefcase, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { LOGO_B64 } from '../assets/logo_b64';
import { supabase } from '../../lib/supabase';

const TIPOS_REPORTE = [
    { id: 'tickets',    nombre: 'Reporte de Tickets',    icon: FileText },
    { id: 'pagos',      nombre: 'Reporte de Pagos',      icon: DollarSign },
    { id: 'cachuelos',  nombre: 'Reporte de Cachuelos',  icon: Briefcase },
    { id: 'maquinaria', nombre: 'Reporte de Maquinaria', icon: Truck },
];

const COLS = ['Código', 'Fecha', 'Placa / Máquina', 'Cliente / Entidad', 'Detalle', 'Monto (USD)'];

type Fila = { nro: string; fecha: string; placa: string; cliente: string; detalle: string; monto: number };
type Filtros = { desde: string; hasta: string; placa: string; cliente: string };

function exportarPDF(tipo: string, datos: Fila[], filtros: Filtros) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const titulo = TIPOS_REPORTE.find(t => t.id === tipo)?.nombre ?? tipo;
    const ahora  = new Date().toLocaleString('es-EC');
    const total  = datos.reduce((s, r) => s + r.monto, 0);
    const pageW  = doc.internal.pageSize.getWidth();

    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setFillColor(67, 56, 202);
    doc.rect(pageW - 60, 0, 60, 38, 'F');

    try {
        doc.addImage(LOGO_B64, 'PNG', 8, 4, 28, 28);
    } catch (_) {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('COOPERATIVA DE TRANSPORTE', 40, 14);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(196, 181, 253);
    doc.text(titulo.toUpperCase(), 40, 21);

    doc.setFontSize(7.5);
    doc.setTextColor(167, 139, 250);
    doc.text(`Generado: ${ahora}`, 40, 27);

    const metaLines: string[] = [];
    if (filtros.desde)   metaLines.push(`Desde: ${filtros.desde}`);
    if (filtros.hasta)   metaLines.push(`Hasta: ${filtros.hasta}`);
    if (filtros.placa)   metaLines.push(`Placa: ${filtros.placa}`);
    if (filtros.cliente) metaLines.push(`Empresa: ${filtros.cliente}`);
    if (metaLines.length) {
        doc.setFontSize(7);
        doc.setTextColor(196, 181, 253);
        doc.text(metaLines, pageW - 58, 10, { align: 'left' });
    }

    autoTable(doc, {
        startY: 44,
        head:   [COLS],
        body:   datos.map(f => [f.nro, f.fecha, f.placa, f.cliente, f.detalle, `$${f.monto.toFixed(2)}`]),
        styles: {
            fontSize: 9,
            cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: [67, 56, 202],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left',
        },
        alternateRowStyles: { fillColor: [245, 243, 255] },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: [55, 48, 163] },
            5: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
        },
        foot: [[
            {
                content: `TOTAL GENERAL — ${datos.length} registro${datos.length !== 1 ? 's' : ''}`,
                colSpan: 5,
                styles: { fontStyle: 'bold', fillColor: [30, 27, 75], textColor: [196, 181, 253], fontSize: 9 },
            },
            {
                content: `$${total.toFixed(2)}`,
                styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 27, 75], textColor: [52, 211, 153], fontSize: 10 },
            },
        ]],
        footStyles: { fillColor: [30, 27, 75] },
        didDrawPage: (data) => {
            const pageCount = (doc as any).internal.getNumberOfPages();
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(
                `Página ${data.pageNumber} de ${pageCount}  |  Documento generado automáticamente`,
                pageW / 2, doc.internal.pageSize.getHeight() - 6,
                { align: 'center' }
            );
        },
    });

    doc.save(`${tipo}_reporte_${Date.now()}.pdf`);
}

function exportarExcel(tipo: string, datos: Fila[], filtros: Filtros) {
    const titulo  = TIPOS_REPORTE.find(t => t.id === tipo)?.nombre ?? tipo;
    const total   = datos.reduce((s, r) => s + r.monto, 0);
    const ahora   = new Date().toLocaleString('es-EC');
    const wb      = XLSX.utils.book_new();

    const headerRows: (string | number | null)[][] = [
        ['COOPERATIVA DE TRANSPORTE', null, null, null, null, null],
        [titulo.toUpperCase(),         null, null, null, null, null],
        [`Generado: ${ahora}`,         null, null, null, null, null],
        [],
    ];
    if (filtros.desde)   headerRows.push([`Desde: ${filtros.desde}`,    null, null, null, null, null]);
    if (filtros.hasta)   headerRows.push([`Hasta: ${filtros.hasta}`,    null, null, null, null, null]);
    if (filtros.placa)   headerRows.push([`Placa: ${filtros.placa}`,    null, null, null, null, null]);
    if (filtros.cliente) headerRows.push([`Empresa: ${filtros.cliente}`,null, null, null, null, null]);
    headerRows.push([]);

    const dataStartRow = headerRows.length + 1;
    const bodyRows = datos.map(f => [f.nro, f.fecha, f.placa, f.cliente, f.detalle, f.monto]);

    const allRows: (string | number | null)[][] = [
        ...headerRows,
        COLS,
        ...bodyRows,
        [],
        [null, null, null, null, 'TOTAL GENERAL:', total],
    ];

    const ws = XLSX.utils.aoa_to_sheet(allRows);
    ws['!cols'] = [
        { wch: 13 }, { wch: 13 }, { wch: 13 },
        { wch: 34 }, { wch: 38 }, { wch: 15 },
    ];
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
    ];

    const totalRowIdx = dataStartRow + datos.length + 1;
    const totalCell   = XLSX.utils.encode_cell({ r: totalRowIdx, c: 5 });
    if (ws[totalCell]) ws[totalCell].z = '"$"#,##0.00';

    for (let i = 0; i < datos.length; i++) {
        const cell = XLSX.utils.encode_cell({ r: dataStartRow + i, c: 5 });
        if (ws[cell]) ws[cell].z = '"$"#,##0.00';
    }

    XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31));
    XLSX.writeFile(wb, `${tipo}_reporte_${Date.now()}.xlsx`);
}

export default function Reportes() {
    const [tipoReporte, setTipoReporte] = useState('tickets');
    const [fechaDesde,  setFechaDesde]  = useState('');
    const [fechaHasta,  setFechaHasta]  = useState('');
    const [placa,       setPlaca]       = useState('');
    const [cliente,     setCliente]     = useState('');
    
    const [rawTickets, setRawTickets] = useState<any[]>([]);
    const [rawPagos, setRawPagos] = useState<any[]>([]);
    const [rawExtras, setRawExtras] = useState<any[]>([]);
    const [rawMaquinaria, setRawMaquinaria] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        const [ticRes, pagRes, extRes, maqRes] = await Promise.all([
            supabase.from('ticket').select(`*, vehiculo:veh_id(veh_placa), cliente:cli_id(cli_nombre), material:mat_id(mat_nombre)`),
            supabase.from('pago').select(`*, ticket:tic_id(vehiculo:veh_id(veh_placa), cliente:cli_id(cli_nombre))`),
            supabase.from('extra').select(`*, vehiculo:veh_id(veh_placa, transportista:tra_id(tra_nombre, tra_apellido))`),
            supabase.from('trabajo_maquinaria').select(`*, maquina_cooperativa ( mac_placa, mac_tipo ), cliente ( cli_nombre )`)
        ]);
        if (ticRes.data) setRawTickets(ticRes.data);
        if (pagRes.data) setRawPagos(pagRes.data);
        if (extRes.data) setRawExtras(extRes.data);
        if (maqRes.data) setRawMaquinaria(maqRes.data);
        setLoading(false);
    };

    const datasets: Record<string, Fila[]> = useMemo(() => {
        const tickets: Fila[] = rawTickets.map(t => ({
            nro: t.tic_numero,
            fecha: t.tic_fecha,
            placa: t.vehiculo?.veh_placa || '—',
            cliente: t.cliente?.cli_nombre || '—',
            detalle: `${t.material?.mat_nombre || 'Material'} (${t.tic_cubicaje} m³)`,
            monto: 0.25 * t.tic_cubicaje * (t.tic_recorrido_km || 0)
        }));

        // Agrupar pagos por pag_nro
        const groupedPagos = rawPagos.reduce((acc: any, p: any) => {
            if (!acc[p.pag_nro]) {
                acc[p.pag_nro] = {
                    nro: p.pag_nro,
                    fecha: p.pag_fecha,
                    placa: p.ticket?.vehiculo?.veh_placa || '—',
                    cliente: p.ticket?.cliente?.cli_nombre || '—',
                    detalle: p.pag_observaciones || 'Pago registrado',
                    monto: 0
                };
            }
            acc[p.pag_nro].monto += p.pag_total;
            // Podríamos acumular las placas o clientes, pero tomamos el del primer ticket asociado al pago
            return acc;
        }, {});
        const pagos: Fila[] = Object.values(groupedPagos);

        const extras: Fila[] = rawExtras.map(e => {
            const prop = e.vehiculo?.transportista ? `${e.vehiculo.transportista.tra_nombre} ${e.vehiculo.transportista.tra_apellido}` : '—';
            return {
                nro: e.ext_numero,
                fecha: e.ext_fecha,
                placa: e.vehiculo?.veh_placa || '—',
                cliente: prop,
                detalle: e.ext_detalle || 'Trabajo extra',
                monto: e.ext_precio
            };
        });

        const maquinaria: Fila[] = rawMaquinaria.map(m => ({
            nro: m.trm_nro_registro || `TRM-${m.trm_id}`,
            fecha: m.trm_fecha,
            placa: m.maquina_cooperativa?.mac_placa || m.maquina_cooperativa?.mac_tipo || '—',
            cliente: m.cliente?.cli_nombre || '—',
            detalle: `Servicio maquinaria (${m.trm_total_horas ?? 0} h)`,
            monto: m.trm_valor_facturar || (m.trm_total_horas || 0) * (m.trm_valor_hora || 0)
        }));

        return { tickets, pagos, cachuelos: extras, maquinaria };
    }, [rawTickets, rawPagos, rawExtras, rawMaquinaria]);

    const datosFiltrados = useMemo(() => {
        return (datasets[tipoReporte] || []).filter(r => {
            if (placa && r.placa !== placa) return false;
            if (cliente && r.cliente !== cliente) return false;
            if (fechaDesde && r.fecha < fechaDesde) return false;
            if (fechaHasta && r.fecha > fechaHasta) return false;
            return true;
        });
    }, [datasets, tipoReporte, placa, cliente, fechaDesde, fechaHasta]);

    const opcionesPlacas = useMemo(() => {
        const all = Object.values(datasets).flat().map(r => r.placa).filter(p => p !== '—');
        return [...new Set(all)].sort();
    }, [datasets]);

    const opcionesClientes = useMemo(() => {
        const all = Object.values(datasets).flat().map(r => r.cliente).filter(c => c !== '—');
        return [...new Set(all)].sort();
    }, [datasets]);

    const totalMonto = datosFiltrados.reduce((s, r) => s + r.monto, 0);
    const filtros: Filtros = { desde: fechaDesde, hasta: fechaHasta, placa, cliente };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Reportes y Estadísticas" subtitle="Generación y exportación de información operativa" />

            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
                <>
                        {/* ── Tarjetas de resumen ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Registros',   value: datosFiltrados.length.toString(), icon: FileText,  bg: 'bg-gray-100', color: 'text-gray-600' },
                                { label: 'Placas en reporte', value: [...new Set(datosFiltrados.map(r => r.placa))].length.toString(), icon: Truck, bg: 'bg-amber-50', color: 'text-amber-600' },
                                { label: 'Empresas',          value: [...new Set(datosFiltrados.map(r => r.cliente).filter(c => c !== '—'))].length.toString(), icon: Briefcase, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                                { label: 'Monto Total',       value: `$${totalMonto.toFixed(2)}`, icon: DollarSign, bg: 'bg-red-50', color: 'text-red-500' },
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

                        {/* ── Panel de filtros ── */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <Filter size={18} className="text-gray-400" />
                                    <h2 className="font-bold text-gray-800 text-sm">Filtros de Reporte</h2>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => exportarExcel(tipoReporte, datosFiltrados, filtros)}
                                        className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-emerald-200 active:scale-95"
                                    >
                                        <FileSpreadsheet size={14} /> Excel
                                    </button>
                                    <button
                                        onClick={() => exportarPDF(tipoReporte, datosFiltrados, filtros)}
                                        className="flex items-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-red-200 active:scale-95"
                                    >
                                        <Download size={14} /> PDF
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo de Reporte</label>
                                    <select value={tipoReporte} onChange={e => {setTipoReporte(e.target.value); setPlaca(''); setCliente('');}}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500">
                                        {TIPOS_REPORTE.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Desde</label>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hasta</label>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Placa (Opcional)</label>
                                    <select value={placa} onChange={e => setPlaca(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500">
                                        <option value="">Todas las Placas</option>
                                        {opcionesPlacas.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Empresa (Opcional)</label>
                                    <select value={cliente} onChange={e => setCliente(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500">
                                        <option value="">Todas las Empresas</option>
                                        {opcionesClientes.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* ── Tabla de previsualización ── */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Previsualización — {TIPOS_REPORTE.find(t => t.id === tipoReporte)?.nombre}
                                </h3>
                                <span className="text-xs text-gray-400 font-medium">{datosFiltrados.length} registro{datosFiltrados.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="overflow-x-auto table-responsive">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[11px] font-bold text-gray-400 uppercase border-b border-gray-100 bg-white">
                                        <tr>
                                            {COLS.map(c => (
                                                <th key={c} className={`px-5 py-3 ${c === 'Monto (USD)' ? 'text-right' : ''}`}>{c}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                        Cargando datos...
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : datosFiltrados.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                                                    No hay registros que coincidan con los filtros aplicados.
                                                </td>
                                            </tr>
                                        ) : datosFiltrados.map(r => (
                                            <tr key={r.nro} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="px-5 py-3 font-mono font-bold text-gray-900">{r.nro}</td>
                                                <td className="px-4 py-3 text-gray-500">{r.fecha}</td>
                                                <td className="px-4 py-3 font-mono text-gray-600">{r.placa}</td>
                                                <td className="px-4 py-3 text-gray-800">{r.cliente}</td>
                                                <td className="px-4 py-3 text-gray-500">{r.detalle}</td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-600">${r.monto.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {datosFiltrados.length > 0 && (
                                        <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                                            <tr>
                                                <td colSpan={5} className="px-5 py-3 text-xs font-bold text-gray-900 uppercase">
                                                    Total General ({datosFiltrados.length} registros)
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">
                                                    ${totalMonto.toFixed(2)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </>
            </div>
        </div>
    );
}
