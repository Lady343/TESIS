import { useState, useEffect } from 'react';
import Header from '../layout/Header';
import { Plus, X, FileText, Search, DollarSign, CreditCard, Link as LinkIcon, MessageSquare, Eye, Edit, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';
import { Cliente } from '../types';
import { useUser } from '../UserContext';

export default function Pagos() {
    const { dbUserId } = useUser();
    const [pagos, setPagos] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [creandoPago, setCreandoPago] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [nuevoPago, setNuevoPago] = useState<any>({
        fecha: new Date().toISOString().split('T')[0],
        tickets: [],
        fechaDesde: '',
        fechaHasta: ''
    });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // Fetch Clientes
        const { data: clientesData } = await supabase.from('cliente').select('*').eq('cli_estado', 'activo');
        if (clientesData) setClientes(clientesData);

        // Fetch Tickets con su Pago (si existe) para saber cuáles están disponibles
        const { data: ticketsData } = await supabase
            .from('ticket')
            .select(`
                *,
                cliente:cli_id ( cli_id, cli_nombre ),
                material:mat_id ( mat_nombre ),
                pago!left ( pag_id )
            `)
            .order('tic_fecha', { ascending: false });

        if (ticketsData) {
            setTickets(ticketsData);
        }

        // Fetch Pagos y agrupar por pag_nro
        const { data: pagosData } = await supabase
            .from('pago')
            .select(`
                *,
                ticket:tic_id ( tic_numero, cli_id, cliente:cli_id ( cli_nombre ) )
            `)
            .order('pag_nro', { ascending: false });

        if (pagosData) {
            const grouped = pagosData.reduce((acc: any, curr: any) => {
                if (!acc[curr.pag_nro]) {
                    acc[curr.pag_nro] = {
                        id: curr.pag_id,
                        nro_pago: curr.pag_nro,
                        fecha: curr.pag_fecha,
                        cliente: curr.ticket?.cliente?.cli_nombre || 'Desconocido',
                        cli_id: curr.ticket?.cli_id || null,
                        total: 0,
                        observaciones: curr.pag_observaciones,
                        tickets: []
                    };
                }
                acc[curr.pag_nro].total += curr.pag_total;
                acc[curr.pag_nro].tickets.push(curr.tic_id);
                return acc;
            }, {});
            
            setPagos(Object.values(grouped).sort((a: any, b: any) => b.nro_pago.localeCompare(a.nro_pago)));
        }
        
        setLoading(false);
    };

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', pago?: any) => {
        setFormErrors({});
        setModalMode(mode);
        if (pago) {
            setNuevoPago({
                nro_pago: pago.nro_pago,
                fecha: pago.fecha,
                cli_id: pago.cli_id,
                tickets: pago.tickets,
                total: pago.total,
                observaciones: pago.observaciones,
                fechaDesde: '',
                fechaHasta: ''
            });
        } else {
            const nextNum = pagos.length + 1;
            setNuevoPago({
                nro_pago: `PAG-${String(nextNum).padStart(3, '0')}`,
                fecha: new Date().toISOString().split('T')[0],
                tickets: [],
                cli_id: '',
                total: 0,
                observaciones: '',
                fechaDesde: '',
                fechaHasta: ''
            });
        }
        setCreandoPago(true);
    };

    const handleCancelar = () => {
        setCreandoPago(false);
    };

    const handleDelete = async (nro_pago: string) => {
        if (window.confirm('¿Está seguro de eliminar este pago?')) {
            const { error } = await supabase.from('pago').delete().eq('pag_nro', nro_pago);
            if (error) alert('Error: ' + error.message);
            else fetchData();
        }
    };

    const handleToggleTicket = (ticketId: number) => {
        const ticketsActuales = nuevoPago.tickets || [];
        let newTickets;
        if (ticketsActuales.includes(ticketId)) {
            newTickets = ticketsActuales.filter((id: number) => id !== ticketId);
        } else {
            newTickets = [...ticketsActuales, ticketId];
        }
        
        const newTotal = newTickets.reduce((sum: number, id: number) => {
            const t = tickets.find(t => t.tic_id === id);
            return sum + (t ? 0.25 * t.tic_cubicaje * (t.tic_recorrido_km || 0) : 0);
        }, 0);

        setNuevoPago({
            ...nuevoPago,
            tickets: newTickets,
            total: newTotal
        });
    };

    const ticketsDisponibles = nuevoPago.cli_id 
        ? tickets.filter(t => {
            const enEstePago = nuevoPago.tickets?.includes(t.tic_id);
            if (modalMode === 'view') {
                return enEstePago;
            }

            // Está disponible si no tiene pagos asociados o la lista de pagos está vacía
            const sinPago = !t.pago || t.pago.length === 0;
            let cumpleFiltros = t.cli_id === nuevoPago.cli_id && (sinPago || enEstePago);
            
            // Filtro por rango de fechas (solo para tickets no seleccionados aún)
            if (!enEstePago) {
                if (nuevoPago.fechaDesde && t.tic_fecha < nuevoPago.fechaDesde) {
                    cumpleFiltros = false;
                }
                if (nuevoPago.fechaHasta && t.tic_fecha > nuevoPago.fechaHasta) {
                    cumpleFiltros = false;
                }
            }
            
            return cumpleFiltros;
        })
        : [];

    const handleSeleccionarTodos = () => {
        const todosLosIds = ticketsDisponibles.map(t => t.tic_id);
        const newTotal = ticketsDisponibles.reduce((sum, t) => sum + (0.25 * t.tic_cubicaje * (t.tic_recorrido_km || 0)), 0);
        
        setNuevoPago({
            ...nuevoPago,
            tickets: todosLosIds,
            total: newTotal
        });
    };

    const handleDeseleccionarTodos = () => {
        setNuevoPago({
            ...nuevoPago,
            tickets: [],
            total: 0
        });
    };

    const handleGuardar = async () => {
        const errors: Record<string, string> = {};

        if (!nuevoPago.nro_pago) errors.nro_pago = 'Este campo es obligatorio';
        if (!nuevoPago.fecha) errors.fecha = 'Este campo es obligatorio';
        if (!nuevoPago.cli_id) errors.cli_id = 'Este campo es obligatorio';
        if (nuevoPago.tickets.length === 0 && nuevoPago.cli_id) errors.tickets = 'Debe seleccionar al menos un ticket';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        if (modalMode === 'edit') {
            const { error: delError } = await supabase.from('pago').delete().eq('pag_nro', nuevoPago.nro_pago);
            if (delError) {
                alert('Error al actualizar el pago: ' + delError.message);
                return;
            }
        }

        const pagosInsert = nuevoPago.tickets.map((tic_id: number) => {
            const t = tickets.find(tic => tic.tic_id === tic_id);
            const totalLinea = t ? (0.25 * t.tic_cubicaje * (t.tic_recorrido_km || 0)) : 0;
            return {
                pag_nro: nuevoPago.nro_pago,
                pag_fecha: nuevoPago.fecha,
                tic_id: tic_id,
                pag_precio_unitario: 0.25,
                pag_total: totalLinea,
                pag_observaciones: nuevoPago.observaciones || null,
                usr_creado_por: dbUserId
            };
        });

        const { error } = await supabase.from('pago').insert(pagosInsert);
        if (error) {
            alert('Error al guardar el pago: ' + error.message);
            return;
        }

        await fetchData(); // Recargar datos
        
        setCreandoPago(false);
    };

    const totalMonto = pagos.reduce((sum, p) => sum + p.total, 0);
    const totalTicketsPagados = pagos.reduce((sum, p) => sum + p.tickets.length, 0);

    const filteredPagos = pagos.filter(p => 
        p.nro_pago.toLowerCase().includes(search.toLowerCase()) || 
        (p.cliente && p.cliente.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Pagos" subtitle="Registro de pagos de clientes" />
            
            <div className="flex flex-1 overflow-hidden">
                {/* Contenido Principal */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
                    
                    {/* Resumen */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Pagos', value: pagos.length, icon: CreditCard, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                            { label: 'Monto Total ($)', value: totalMonto.toFixed(2), icon: DollarSign, bg: 'bg-amber-50', color: 'text-amber-600' },
                            { label: 'Tickets Pagados', value: totalTicketsPagados, icon: FileText, bg: 'bg-blue-50', color: 'text-blue-500' },
                        ].map((c) => {
                            const Icon = c.icon;
                            return (
                                <div
                                    key={c.label}
                                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover-card-premium"
                                >
                                    <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <Icon size={20} className={c.color} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{c.label}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Herramientas */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2 flex-1 max-w-md">
                            <Search size={16} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por número de pago o cliente…"
                                className="bg-transparent text-sm text-gray-700 outline-none w-full"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        {!creandoPago && (
                            <button
                                onClick={() => handleOpenModal('create')}
                                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 ripple-effect"
                            >
                                <Plus size={18} />
                                Nuevo Pago
                            </button>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Cargando pagos...</div>
                        ) : (
                            <div className="overflow-x-auto table-responsive">
                                <table className="w-full text-sm table-fixed min-w-[800px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        <th className="text-left px-4 py-3 w-[120px]">N° Pago</th>
                                        <th className="text-left px-4 py-3 w-[120px]">Fecha</th>
                                        <th className="text-left px-4 py-3 w-[30%]">Cliente</th>
                                        <th className="text-center px-4 py-3 w-[100px]">Tickets</th>
                                        <th className="text-left px-4 py-3 w-[120px]">Total</th>
                                        <th className="text-left px-4 py-3">Observaciones</th>
                                        <th className="text-center px-4 py-3 w-[100px]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredPagos.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-8 text-gray-500">No se encontraron pagos registrados</td></tr>
                                    ) : filteredPagos.map(p => (
                                        <tr key={p.nro_pago} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-3 py-3 font-mono font-semibold text-gray-900 text-xs">{p.nro_pago}</td>
                                            <td className="px-2 py-3 text-gray-500 text-xs">{p.fecha}</td>
                                            <td className="px-2 py-3 text-gray-800 font-medium text-xs truncate" title={p.cliente}>{p.cliente}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                                                    <FileText size={10} />
                                                    {p.tickets.length}
                                                </span>
                                            </td>
                                            <td className="px-2 py-3 font-black text-emerald-600 text-xs">${p.total.toFixed(2)}</td>
                                            <td className="px-2 py-3 text-gray-500 text-xs truncate" title={p.observaciones}>{p.observaciones || '—'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button onClick={() => handleOpenModal('view', p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver"><Eye size={13} /></button>
                                                    <button onClick={() => handleOpenModal('edit', p)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit size={13} /></button>
                                                    <button onClick={() => handleDelete(p.nro_pago)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel Lateral Derecho */}
                {creandoPago && (
                    <div className="w-[450px] md:w-[500px] border-l border-gray-200 bg-white flex flex-col overflow-hidden shadow-xl">
                        <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                                <h3 className="text-base font-bold text-gray-800">
                                    {modalMode === 'create' ? 'Registrar nuevo pago' : modalMode === 'edit' ? 'Editar pago' : 'Detalles del pago'}
                                </h3>
                                <button
                                    onClick={handleCancelar}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <fieldset disabled={modalMode === 'view'} className="space-y-6 group">
                                {/* Información general */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText size={16} className="text-emerald-500" />
                                <h4 className="text-xs font-bold text-gray-800">Información general</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium text-gray-500">Número de pago</label>
                                    <input 
                                        value={nuevoPago.nro_pago || ''} 
                                        onChange={e => {
                                            setNuevoPago({ ...nuevoPago, nro_pago: e.target.value });
                                            if (formErrors.nro_pago) setFormErrors({ ...formErrors, nro_pago: '' });
                                        }} 
                                        type="text" 
                                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all bg-gray-50/50 hover:bg-white font-mono ${formErrors.nro_pago ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20'}`} 
                                        placeholder="PAG-000" 
                                    />
                                    {formErrors.nro_pago && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.nro_pago}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium text-gray-500">Fecha de pago</label>
                                    <input 
                                        value={nuevoPago.fecha || ''} 
                                        onChange={e => {
                                            setNuevoPago({ ...nuevoPago, fecha: e.target.value });
                                            if (formErrors.fecha) setFormErrors({ ...formErrors, fecha: '' });
                                        }} 
                                        type="date" 
                                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all bg-gray-50/50 hover:bg-white text-gray-600 ${formErrors.fecha ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20'}`} 
                                    />
                                    {formErrors.fecha && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.fecha}</p>}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium text-gray-500">Cliente</label>
                                <select 
                                    value={nuevoPago.cli_id || ''} 
                                    onChange={e => {
                                        setNuevoPago({ ...nuevoPago, cli_id: parseInt(e.target.value), tickets: [] });
                                        if (formErrors.cli_id) setFormErrors({ ...formErrors, cli_id: '' });
                                    }} 
                                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all bg-gray-50/50 hover:bg-white text-gray-600 cursor-pointer ${formErrors.cli_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20'}`}
                                >
                                    <option value="">Seleccionar cliente...</option>
                                    {clientes.map(c => <option key={c.cli_id} value={c.cli_id}>{c.cli_nombre}</option>)}
                                </select>
                                {formErrors.cli_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.cli_id}</p>}
                            </div>
                            
                            {/* Filtro de fechas de tickets */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium text-gray-500">Tickets desde (Opcional)</label>
                                    <input 
                                        value={nuevoPago.fechaDesde || ''} 
                                        onChange={e => setNuevoPago({ ...nuevoPago, fechaDesde: e.target.value })} 
                                        type="date" 
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white text-gray-600" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium text-gray-500">Tickets hasta (Opcional)</label>
                                    <input 
                                        value={nuevoPago.fechaHasta || ''} 
                                        onChange={e => setNuevoPago({ ...nuevoPago, fechaHasta: e.target.value })} 
                                        type="date" 
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white text-gray-600" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Tickets asociados */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <LinkIcon size={16} className={formErrors.tickets ? "text-red-500" : "text-emerald-500"} />
                                <h4 className={`text-xs font-bold ${formErrors.tickets ? "text-red-600" : "text-gray-800"}`}>
                                    Tickets asociados ({nuevoPago.tickets?.length || 0})
                                </h4>
                                {formErrors.tickets && <span className="ml-auto text-xs text-red-500 font-medium">{formErrors.tickets}</span>}
                            </div>
                            
                            {nuevoPago.cli_id ? (
                                <>
                                    <div className="flex justify-end gap-2 mb-3">
                                        {modalMode !== 'view' && ticketsDisponibles.length > 0 && (
                                            <>
                                                {nuevoPago.tickets?.length === ticketsDisponibles.length ? (
                                                    <button onClick={handleDeseleccionarTodos} className="text-[10px] font-bold text-gray-500 hover:text-gray-700 transition-colors">Deseleccionar todos</button>
                                                ) : (
                                                    <button onClick={handleSeleccionarTodos} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors">Seleccionar todos</button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    
                                    <div className="max-h-60 overflow-y-auto mb-4 scrollbar-hide border border-gray-100 rounded-xl">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-gray-50 text-gray-500 sticky top-0 border-b border-gray-100">
                                                <tr>
                                                    <th className="px-3 py-2.5 font-medium">Ticket</th>
                                                    <th className="px-3 py-2.5 font-medium">Fecha</th>
                                                    <th className="px-3 py-2.5 font-medium">Ruta / Destino</th>
                                                    <th className="px-3 py-2.5 font-medium text-right">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {ticketsDisponibles.length === 0 ? (
                                                    <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No hay tickets disponibles</td></tr>
                                                ) : (
                                                    ticketsDisponibles.map(ticket => {
                                                        const isSelected = nuevoPago.tickets?.includes(ticket.tic_id);
                                                        const monto = (0.25 * ticket.tic_cubicaje * (ticket.tic_recorrido_km || 0));
                                                        return (
                                                            <tr key={ticket.tic_id} className={`cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/20' : 'hover:bg-gray-50'}`} onClick={() => handleToggleTicket(ticket.tic_id)}>
                                                                <td className="px-3 py-3">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <input type="checkbox" checked={isSelected} readOnly className="rounded text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5" />
                                                                        <span className="font-mono font-bold text-gray-700">{ticket.tic_numero}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-3 text-gray-500">{ticket.tic_fecha}</td>
                                                                <td className="px-3 py-3 text-gray-500 truncate max-w-[120px]" title={ticket.material?.mat_nombre || 'S/R'}>{ticket.material?.mat_nombre || 'S/R'}</td>
                                                                <td className="px-3 py-3 text-right font-semibold text-gray-700">${monto.toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="space-y-2 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500 font-medium text-xs">Subtotal</span>
                                            <span className="font-bold text-gray-700 text-xs">${(nuevoPago.total || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="h-px bg-gray-200 w-full my-1"></div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-black text-emerald-600">Total</span>
                                            <span className="font-black text-emerald-600">${(nuevoPago.total || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-6 text-xs text-gray-400">Seleccione un cliente para ver sus tickets disponibles</div>
                            )}
                        </div>

                        {/* Observaciones */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <MessageSquare size={16} className="text-emerald-500" />
                                <h4 className="text-xs font-bold text-gray-800">Observaciones</h4>
                            </div>
                            <textarea
                                value={nuevoPago.observaciones || ''}
                                onChange={e => setNuevoPago({ ...nuevoPago, observaciones: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white resize-none text-gray-600"
                                placeholder="Detalles del pago..."
                                rows={2}
                                maxLength={250}
                            />
                            <div className="text-right text-[10px] text-gray-400 mt-1 font-medium">
                                {(nuevoPago.observaciones || '').length} / 250
                            </div>
                        </div>
                        </fieldset>

                        <div className="flex justify-end gap-3 pt-5 border-t border-gray-100 mt-2">
                            {modalMode === 'view' ? (
                                <button
                                    onClick={() => setCreandoPago(false)}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-bold transition-all w-full"
                                >
                                    Cerrar Detalles
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleCancelar}
                                        className="w-full bg-white hover:bg-gray-50 text-gray-600 py-3 rounded-xl text-sm font-bold transition-all border border-gray-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleGuardar}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                    >
                                        {modalMode === 'create' ? 'Registrar Pago' : 'Guardar Cambios'}
                                    </button>
                                </>
                            )}
                        </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
