import { useState, useEffect } from 'react';
import Header from '../layout/Header';
import { Plus, Search, Filter, CheckCircle, Clock, AlertCircle, Eye, Edit, Trash2, Ticket as TicketIcon, Brain, Loader2, ShieldAlert, ShieldCheck, ShieldX, X, ClipboardList, Thermometer, Wrench, Phone, Wind, BellRing, BellOff } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';
import { Ticket, Cliente, Lugar, Material, ClienteCubicaje } from '../types';
import { useUser } from '../UserContext';
import { predecirTiempoViaje, type DatosPrediccion, enviarNotificacion } from '../../lib/prediccion';

const BADGE: Record<string, string> = {
    recibido: 'bg-emerald-100 text-emerald-700',
    despachado: 'bg-amber-100 text-amber-700',
    anulado: 'bg-red-100 text-red-700',
};
const ICON: Record<string, React.ElementType> = {
    recibido: CheckCircle,
    despachado: Clock,
    anulado: AlertCircle,
};

export default function Tickets() {
    const { isDespachador, dbUserId } = useUser();
    const [search, setSearch] = useState('');
    const [estado, setEstado] = useState('todos');
    const [tickets, setTickets] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<Partial<Ticket>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [prediciendo, setPrediciendo] = useState(false);
    const [errorPrediccion, setErrorPrediccion] = useState<string | null>(null);
    const [tiempoPredichoMin, setTiempoPredichoMin] = useState<number | null>(null);
    const [horaLlegadaIA, setHoraLlegadaIA] = useState<string | null>(null);
    const [nivelCriticidadIA, setNivelCriticidadIA] = useState<string | null>(null);
    const [avisoIA, setAvisoIA] = useState<string | null>(null);
    const [showRecomModal, setShowRecomModal] = useState(false);
    const [recomPendiente, setRecomPendiente] = useState(false); // si el usuario ya vio el modal
    const [enviandoNotif, setEnviandoNotif] = useState(false);  // loading del botón de notificación
    const [resultadoNotif, setResultadoNotif] = useState<{ ok: boolean; mensaje: string } | null>(null);

    // Dropdown Data
    const [vehiculos, setVehiculos] = useState<any[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [lugares, setLugares] = useState<Lugar[]>([]);
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [cubicajes, setCubicajes] = useState<ClienteCubicaje[]>([]);

    useEffect(() => {
        fetchTickets();
        fetchDropdownData();
    }, []);

    const fetchTickets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('ticket')
            .select(`
                *,
                vehiculo ( veh_placa, transportista ( tra_nombre, tra_apellido ) ),
                material ( mat_nombre ),
                cliente ( cli_nombre )
            `)
            .order('tic_id', { ascending: false });

        if (error) console.error('Error fetching tickets:', error);
        else setTickets(data || []);
        setLoading(false);
    };

    const fetchDropdownData = async () => {
        const [v, c, l, m, cu] = await Promise.all([
            supabase.from('vehiculo').select('veh_id, veh_placa, veh_cubicaje, tra_id, transportista:tra_id(tra_nombre, tra_apellido)').eq('veh_estado', 'activa'),
            supabase.from('cliente').select('*').eq('cli_estado', 'activo'),
            supabase.from('lugar').select('*').eq('lug_estado', 'activo'),
            supabase.from('material').select('*'),
            supabase.from('cliente_cubicaje').select('*')
        ]);

        if (v.data) setVehiculos(v.data);
        if (c.data) setClientes(c.data);
        if (l.data) setLugares(l.data);
        if (m.data) setMateriales(m.data);
        if (cu.data) setCubicajes(cu.data);
    };

    const rows = tickets.filter(t => {
        const q = search.toLowerCase();
        const num = t.tic_numero?.toLowerCase() || '';
        const placa = t.vehiculo?.veh_placa?.toLowerCase() || '';
        const socio = t.vehiculo?.transportista ? `${t.vehiculo.transportista.tra_nombre} ${t.vehiculo.transportista.tra_apellido}`.toLowerCase() : '';

        return (
            (num.includes(q) || socio.includes(q) || placa.includes(q)) &&
            (estado === 'todos' || t.tic_estado === estado)
        );
    });

    // Llama al modelo en tiempo real cuando cambia la hora de despacho
    const triggerPrediccion = async (hora: string, data: Partial<Ticket>) => {
        if (!hora || !data.lug_origen_id || !data.lug_destino_id || !data.mat_id || !data.cli_id || !data.tic_cubicaje || !data.veh_id) {
            setTiempoPredichoMin(null);
            setHoraLlegadaIA(null);
            setNivelCriticidadIA(null);
            setAvisoIA(null);
            return;
        }

        // Resolver nombres desde los arrays de estado
        const origenNombre = lugares.find(l => l.lug_id === data.lug_origen_id)?.lug_nombre || '';
        const destinoNombre = lugares.find(l => l.lug_id === data.lug_destino_id)?.lug_nombre || '';
        const materialNombre = materiales.find(m => m.mat_id === data.mat_id)?.mat_nombre || '';
        const clienteNombre = clientes.find(c => c.cli_id === data.cli_id)?.cli_nombre || '';
        const vehiculo = vehiculos.find(v => v.veh_id === data.veh_id);
        const placaNombre = vehiculo?.veh_placa || '';

        if (!origenNombre || !destinoNombre || !materialNombre || !clienteNombre || !placaNombre) {
            setTiempoPredichoMin(null);
            setHoraLlegadaIA(null);
            setNivelCriticidadIA(null);
            setAvisoIA(null);
            return;
        }

        setPrediciendo(true);
        setErrorPrediccion(null);
        try {
            const datosML: DatosPrediccion = {
                origen: origenNombre,
                destino: destinoNombre,
                material: materialNombre,
                empresa: clienteNombre,
                placa: placaNombre,
                cubicaje: data.tic_cubicaje,
                hora_despacho: hora,
            };
            const resultado = await predecirTiempoViaje(datosML);
            setTiempoPredichoMin(resultado.tiempo_estimado_minutos);
            setHoraLlegadaIA(resultado.hora_estimada_llegada);
            setNivelCriticidadIA(resultado.nivel_criticidad);
            setAvisoIA(resultado.aviso);

            // Auto-seleccionar el nivel de riesgo en el formulario
            let riesgoMapeado: 'Bajo' | 'Medio' | 'Alto' = 'Bajo';
            if (resultado.nivel_criticidad === 'ALTO') riesgoMapeado = 'Alto';
            else if (resultado.nivel_criticidad === 'MEDIO') riesgoMapeado = 'Medio';
            setFormData(prev => ({ 
                ...prev, 
                tic_nivel_riesgo: riesgoMapeado,
                tic_precision: resultado.precision_ia
            }));

            // Disparar modal de recomendaciones preventivas si hay riesgo significativo
            if (resultado.nivel_criticidad === 'ALTO' || resultado.nivel_criticidad === 'MEDIO') {
                setRecomPendiente(false);
                setShowRecomModal(true);
            } else {
                setRecomPendiente(true); // riesgo bajo, no requiere modal
            }

        } catch (err) {
            setErrorPrediccion(err instanceof Error ? err.message : 'Error al conectar con la API');
            setTiempoPredichoMin(null);
            setHoraLlegadaIA(null);
            setNivelCriticidadIA(null);
            setAvisoIA(null);
        } finally {
            setPrediciendo(false);
        }
    };

    const handleCreate = () => {
        setFormErrors({});
        setErrorPrediccion(null);
        setTiempoPredichoMin(null);
        setHoraLlegadaIA(null);
        setNivelCriticidadIA(null);
        setAvisoIA(null);
        setShowRecomModal(false);
        setRecomPendiente(false);
        setResultadoNotif(null);
        setEnviandoNotif(false);
        setFormData({
            tic_numero: `T-${String(tickets.length + 1).padStart(4, '0')}`,
            tic_fecha: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
            tic_estado: 'despachado',
            tic_nivel_riesgo: 'Bajo'
        });
        setModalMode('create');
        setShowForm(true);
    };

    const handleView = (ticket: any) => {
        setFormErrors({});
        setFormData(ticket);
        setModalMode('view');
        setShowForm(true);
    };

    const handleEdit = (ticket: any) => {
        setFormErrors({});
        setFormData(ticket);
        setModalMode('edit');
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Está seguro de eliminar este ticket de forma permanente?')) {
            const { error } = await supabase.from('ticket').delete().eq('tic_id', id);
            if (error) alert('Error: ' + error.message);
            else {
                fetchTickets();
                setSelectedTickets(selectedTickets.filter(tId => tId !== id));
            }
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedTickets(rows.map(t => t.tic_id));
        } else {
            setSelectedTickets([]);
        }
    };

    const handleSelectTicket = (id: number) => {
        if (selectedTickets.includes(id)) {
            setSelectedTickets(selectedTickets.filter(tId => tId !== id));
        } else {
            setSelectedTickets([...selectedTickets, id]);
        }
    };

    const handleMassDelete = async () => {
        if (selectedTickets.length === 0) return;
        if (window.confirm(`¿Está seguro de eliminar de forma permanente los ${selectedTickets.length} tickets seleccionados?`)) {
            const { error } = await supabase.from('ticket').delete().in('tic_id', selectedTickets);
            if (error) alert('Error: ' + error.message);
            else {
                fetchTickets();
                setSelectedTickets([]);
            }
        }
    };

    /**
     * Guarda el ticket. En modo 'create' retorna el tic_id recién insertado
     * para evitar una segunda query. Retorna null si hay error o validación falla.
     */
    const handleSave = async (): Promise<number | null> => {
        const errors: Record<string, string> = {};

        if (!formData.tic_numero) errors.tic_numero = 'Este campo es obligatorio';
        if (!formData.tic_fecha) errors.tic_fecha = 'Este campo es obligatorio';
        if (!formData.veh_id) errors.veh_id = 'Este campo es obligatorio';
        if (!formData.tic_cubicaje) errors.tic_cubicaje = 'Este campo es obligatorio';
        if (!formData.mat_id) errors.mat_id = 'Este campo es obligatorio';
        if (!formData.cli_id) errors.cli_id = 'Este campo es obligatorio';
        if (!formData.lug_origen_id) errors.lug_origen_id = 'Este campo es obligatorio';
        if (!formData.lug_destino_id) errors.lug_destino_id = 'Este campo es obligatorio';
        if (!formData.tic_recorrido_km) errors.tic_recorrido_km = 'Este campo es obligatorio';
        if (formData.lug_origen_id && formData.lug_destino_id && formData.lug_origen_id === formData.lug_destino_id) {
            errors.lug_destino_id = 'El destino no puede ser igual al origen';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return null;
        }

        // Calcular mora automáticamente si hay hora real y hora estimada
        let moraCalculada: number | null = null;
        const horaEstimada = modalMode === 'create' ? horaLlegadaIA : (formData.tic_tiempo_estimado_llegada || null);
        if (horaEstimada && formData.tic_tiempo_real_llegada) {
            const [hE, mE] = horaEstimada.split(':').map(Number);
            const [hR, mR] = formData.tic_tiempo_real_llegada.split(':').map(Number);
            moraCalculada = (hR * 60 + mR) - (hE * 60 + mE);
        }

        const payload = {
            tic_numero: formData.tic_numero,
            tic_fecha: formData.tic_fecha,
            veh_id: formData.veh_id,
            mat_id: formData.mat_id,
            tic_cubicaje: formData.tic_cubicaje,
            lug_origen_id: formData.lug_origen_id,
            lug_destino_id: formData.lug_destino_id,
            tic_recorrido_km: formData.tic_recorrido_km || null,
            cli_id: formData.cli_id,
            tic_estado: formData.tic_estado || 'despachado',
            tic_observaciones: formData.tic_observaciones || null,
            tic_nivel_riesgo: formData.tic_nivel_riesgo || 'Bajo',
            tic_hora_despacho: formData.tic_hora_despacho || null,
            tic_tiempo_estimado_llegada: modalMode === 'create' ? horaLlegadaIA : (formData.tic_tiempo_estimado_llegada || null),
            tic_tiempo_real_llegada: formData.tic_tiempo_real_llegada || null,
            tic_tiempo_mora: moraCalculada,
            tic_precision: formData.tic_precision || null,
            usr_creado_por: dbUserId,
        };

        if (modalMode === 'create') {
            // select('tic_id') para obtener el ID insertado sin una segunda query
            const { data, error } = await supabase.from('ticket').insert([payload]).select('tic_id').single();
            if (error) { alert('Error: ' + error.message); return null; }
            setShowForm(false);
            fetchTickets();
            return data?.tic_id ?? null;
        } else if (modalMode === 'edit') {
            const { error } = await supabase.from('ticket').update(payload).eq('tic_id', formData.tic_id);
            if (error) { alert('Error: ' + error.message); return null; }
            setShowForm(false);
            fetchTickets();
        }
        return null;
    };

    /**
     * FLUJO 1: El despachador decide despachar a pesar de la alerta.
     * → Guarda el ticket de inmediato y cierra el modal.
     *   La notificación al dueño se envía en segundo plano (fire-and-forget).
     */
    const handleNotificarYDespachar = async () => {
        setEnviandoNotif(true);

        // Obtener datos básicos del vehículo desde el estado local (sin query)
        const vehiculo = vehiculos.find(v => v.veh_id === formData.veh_id);
        const placa = vehiculo?.veh_placa || '—';
        const nombreCompleto = vehiculo?.transportista
            ? `${vehiculo.transportista.tra_nombre} ${vehiculo.transportista.tra_apellido}`
            : 'Propietario';

        // Fetch contacto del transportista Y guardado del ticket en PARALELO
        const contactoPromise = vehiculo?.tra_id
            ? supabase.from('transportista').select('tra_telefono, tra_correo').eq('tra_id', vehiculo.tra_id).single()
            : Promise.resolve({ data: null });

        const [contactoResult, ticId] = await Promise.all([
            contactoPromise,
            handleSave(),   // retorna el tic_id directamente del insert
        ]);

        // ✅ Cerrar el modal inmediatamente — el ticket ya fue guardado
        setEnviandoNotif(false);
        setRecomPendiente(true);
        setShowRecomModal(false);

        // Enviar la notificación en segundo plano sin bloquear la UI
        const telefono = contactoResult.data?.tra_telefono || '';
        const correo = contactoResult.data?.tra_correo || '';
        enviarNotificacion({
            tipo: 'despachado_con_alerta',
            tic_id: ticId || 0,
            tic_numero: formData.tic_numero || '—',
            tic_hora_despacho: formData.tic_hora_despacho || '',
            nivel_riesgo: nivelCriticidadIA || 'Medio',
            aviso_ia: avisoIA || '',
            veh_placa: placa,
            tra_nombre_completo: nombreCompleto,
            tra_telefono: telefono,
            tra_correo: correo,
        }).catch(() => { /* notificación en background — errores se ignoran silenciosamente */ });
    };

    /**
     * FLUJO 2: El despachador decide NO despachar y deja el ticket pendiente.
     * → Cierra el modal de inmediato.
     *   La notificación al dueño se envía en segundo plano (fire-and-forget).
     */
    const handleDejarPendiente = async () => {
        setEnviandoNotif(true);

        // Obtener datos básicos del vehículo desde el estado local (sin query)
        const vehiculo = vehiculos.find(v => v.veh_id === formData.veh_id);
        const placa = vehiculo?.veh_placa || '—';
        const nombreCompleto = vehiculo?.transportista
            ? `${vehiculo.transportista.tra_nombre} ${vehiculo.transportista.tra_apellido}`
            : 'Propietario';

        // Fetch contacto en paralelo con la preparación
        const contactoPromise = vehiculo?.tra_id
            ? supabase.from('transportista').select('tra_telefono, tra_correo').eq('tra_id', vehiculo.tra_id).single()
            : Promise.resolve({ data: null });

        const contactoResult = await contactoPromise;
        const telefono = contactoResult.data?.tra_telefono || '';
        const correo = contactoResult.data?.tra_correo || '';

        // ✅ Cerrar el modal inmediatamente
        setEnviandoNotif(false);
        setRecomPendiente(true);
        setShowRecomModal(false);

        // Enviar notificación de posposición en segundo plano (fire-and-forget)
        // NO SE GUARDA EL TICKET (para no perder la secuencia)
        enviarNotificacion({
            tipo: 'pendiente',
            tic_id: 0,
            tic_numero: '',
            tic_hora_despacho: formData.tic_hora_despacho || '',
            nivel_riesgo: nivelCriticidadIA || 'Medio',
            aviso_ia: avisoIA || '',
            veh_placa: placa,
            tra_nombre_completo: nombreCompleto,
            tra_telefono: telefono,
            tra_correo: correo,
            horas_espera: 24,
        }).catch(() => { /* notificación en background — errores se ignoran silenciosamente */ });
    };

    const updateCubicaje = (cli_id?: number, veh_id?: number) => {
        if (!veh_id) return;
        const custom = cubicajes.find(c => c.cli_id === cli_id && c.veh_id === veh_id);
        if (custom) {
            setFormData(prev => ({ ...prev, tic_cubicaje: custom.ccu_cubicaje }));
        } else {
            const v = vehiculos.find(v => v.veh_id === veh_id);
            if (v) {
                setFormData(prev => ({ ...prev, tic_cubicaje: v.veh_cubicaje }));
            }
        }
    };

    const getSocioName = (veh_id?: number) => {
        if (!veh_id) return '';
        const v = vehiculos.find(v => v.veh_id === veh_id);
        if (v?.transportista) return `${v.transportista.tra_nombre} ${v.transportista.tra_apellido}`;
        return 'Sin Asignar';
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Tickets de Despacho" subtitle="Registro y seguimiento de tickets de transporte de materiales" />

            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
                {/* Resumen */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Tickets', value: tickets.length, icon: TicketIcon, bg: 'bg-gray-100', color: 'text-gray-600' },
                        { label: 'Despachados', value: tickets.filter(t => t.tic_estado === 'despachado').length, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600' },
                        { label: 'Recibidos', value: tickets.filter(t => t.tic_estado === 'recibido').length, icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                        { label: 'Anulados', value: tickets.filter(t => t.tic_estado === 'anulado').length, icon: AlertCircle, bg: 'bg-red-50', color: 'text-red-500' },
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

                {/* Herramientas (Búsqueda + Filtros + Acción) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center">
                    {/* Búsqueda */}
                    <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2 flex-1 max-w-md">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por ticket, socio o placa…"
                            className="bg-transparent text-sm text-gray-700 outline-none w-full"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Filtros de Estado */}
                    <div className="flex items-center gap-2 flex-wrap ml-auto">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 mr-1">
                            <Filter size={13} className="text-gray-400" />
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Filtrar:</span>
                        </div>
                        {['todos', 'despachado', 'recibido', 'anulado'].map(e => (
                            <button
                                key={e}
                                onClick={() => setEstado(e)}
                                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all capitalize ripple-effect ${estado === e
                                    ? e === 'todos' ? 'bg-gray-700 text-white shadow-md shadow-gray-200' :
                                        e === 'despachado' ? 'bg-amber-500 text-white shadow-md shadow-amber-100' :
                                            e === 'recibido' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' :
                                                'bg-red-500 text-white shadow-md shadow-red-100'
                                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                                    }`}
                            >
                                {e}
                            </button>
                        ))}
                    </div>

                    {/* Acción Principal */}
                    <div className="flex items-center gap-3">
                        {selectedTickets.length > 0 && !isDespachador && (
                            <button
                                onClick={handleMassDelete}
                                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-red-200 active:scale-95"
                            >
                                <Trash2 size={16} />
                                Eliminar ({selectedTickets.length})
                            </button>
                        )}
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 ripple-effect"
                        >
                            <Plus size={18} />
                            Nuevo Ticket
                        </button>
                    </div>
                </div>

                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    maxWidth="3xl"
                    title={
                        modalMode === 'create' ? "Registrar Nuevo Ticket de Despacho" :
                            modalMode === 'edit' ? "Editar Registro de Ticket" : "Detalles del Ticket"
                    }
                >
                    <div className="space-y-3">
                        <fieldset disabled={modalMode === 'view'} className="grid grid-cols-1 sm:grid-cols-3 gap-3 group">
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Número de Ticket (N°)</label>
                                <input
                                    value={formData.tic_numero || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, tic_numero: e.target.value });
                                        if (formErrors.tic_numero) setFormErrors({});
                                    }}
                                    type="text"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white font-mono font-bold text-gray-900 group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.tic_numero ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="T-0000"
                                />
                                {formErrors.tic_numero && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tic_numero}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Fecha de Emisión</label>
                                <input
                                    value={formData.tic_fecha || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, tic_fecha: e.target.value });
                                        if (formErrors.tic_fecha) setFormErrors({ ...formErrors, tic_fecha: '' });
                                    }}
                                    type="date"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.tic_fecha ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                />
                                {formErrors.tic_fecha && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tic_fecha}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estado del Ticket</label>
                                <select value={formData.tic_estado || 'despachado'} onChange={e => setFormData({ ...formData, tic_estado: e.target.value as any })} className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white cursor-pointer font-bold group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed">
                                    <option value="despachado">Despachado</option>
                                    <option value="recibido">Recibido</option>
                                    <option value="anulado">Anulado</option>
                                </select>
                            </div>
                            {/* === 1. EMPRESA / CLIENTE — primero para determinar cubicaje === */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Empresa / Cliente <span className="text-red-500"></span></label>
                                <select value={formData.cli_id || ''} onChange={e => {
                                    const c = e.target.value ? parseInt(e.target.value) : undefined;
                                    // Al cambiar empresa, resetear vehículo y cubicaje
                                    setFormData(prev => ({ ...prev, cli_id: c, veh_id: undefined, tic_cubicaje: undefined }));
                                    if (formErrors.cli_id) setFormErrors({ ...formErrors, cli_id: '' });
                                }} className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed ${formErrors.cli_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}>
                                    <option value="">Seleccionar Cliente...</option>
                                    {clientes.map(c => <option key={c.cli_id} value={c.cli_id}>{c.cli_nombre}</option>)}
                                </select>
                                {formErrors.cli_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.cli_id}</p>}
                            </div>
                            {/* === 2. PLACA — habilitada sólo después de elegir empresa === */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Vehículo / Placa <span className="text-red-500"></span>
                                    {!formData.cli_id && <span className="ml-1 text-[9px] text-amber-500 font-semibold normal-case"> Seleccione empresa</span>}
                                </label>
                                <select
                                    value={formData.veh_id || ''}
                                    disabled={!formData.cli_id}
                                    onChange={e => {
                                        const v = e.target.value ? parseInt(e.target.value) : undefined;
                                        setFormData(prev => ({ ...prev, veh_id: v }));
                                        updateCubicaje(formData.cli_id, v);
                                        if (formErrors.veh_id) setFormErrors({ ...formErrors, veh_id: '' });
                                    }}
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all font-mono cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 ${formErrors.veh_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10 bg-gray-50/50 hover:bg-white'}`}
                                >
                                    <option value="">Seleccionar Placa...</option>
                                    {vehiculos.map(v => <option key={v.veh_id} value={v.veh_id}>{v.veh_placa}</option>)}
                                </select>
                                {formErrors.veh_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.veh_id}</p>}
                            </div>
                            {/* === 3. SOCIO — automático === */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Propietario / Socio</label>
                                <input value={getSocioName(formData.veh_id)} readOnly className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none transition-all bg-gray-100/50 text-gray-600 cursor-not-allowed" placeholder="Se asigna automáticamente" />
                            </div>
                            {/* === 4. CUBICAJE — autocompleta según empresa+vehículo === */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    Cubicaje (m³)
                                    {formData.cli_id && formData.veh_id && cubicajes.find(c => c.cli_id === formData.cli_id && c.veh_id === formData.veh_id) && (
                                        <span className="text-[9px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold uppercase">Config. empresa</span>
                                    )}
                                </label>
                                <input
                                    value={formData.tic_cubicaje || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, tic_cubicaje: parseFloat(e.target.value) });
                                        if (formErrors.tic_cubicaje) setFormErrors({ ...formErrors, tic_cubicaje: '' });
                                    }}
                                    type="number" step="0.5"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all font-bold group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.tic_cubicaje ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30' :
                                        (formData.cli_id && formData.veh_id && cubicajes.find(c => c.cli_id === formData.cli_id && c.veh_id === formData.veh_id))
                                            ? 'border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-amber-500/10 hover:bg-amber-50'
                                            : 'border-gray-200 bg-gray-50/50 hover:bg-white focus:border-emerald-500 focus:ring-emerald-500/10'
                                        }`}
                                    placeholder="0.00"
                                />
                                {formErrors.tic_cubicaje && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tic_cubicaje}</p>}
                            </div>
                            {/* === 5. MATERIAL === */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Material</label>
                                <select value={formData.mat_id || ''} onChange={e => { setFormData({ ...formData, mat_id: parseInt(e.target.value) }); if (formErrors.mat_id) setFormErrors({ ...formErrors, mat_id: '' }); }} className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed ${formErrors.mat_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}>
                                    <option value="">Seleccionar Material...</option>
                                    {materiales.map(m => <option key={m.mat_id} value={m.mat_id}>{m.mat_nombre}</option>)}
                                </select>
                                {formErrors.mat_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.mat_id}</p>}
                            </div>
                            {/* === 6. ORIGEN === */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Origen <span className="text-red-500"></span></label>
                                <select value={formData.lug_origen_id || ''} onChange={e => {
                                    const v = e.target.value ? parseInt(e.target.value) : undefined;
                                    setFormData({ ...formData, lug_origen_id: v, lug_destino_id: undefined });
                                    if (formErrors.lug_origen_id) setFormErrors({ ...formErrors, lug_origen_id: '' });
                                }} className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed ${formErrors.lug_origen_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}>
                                    <option value="">Seleccionar Origen...</option>
                                    {lugares.map(l => <option key={l.lug_id} value={l.lug_id}>{l.lug_nombre}</option>)}
                                </select>
                                {formErrors.lug_origen_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.lug_origen_id}</p>}
                            </div>
                            {/* === 7. DESTINO — excluye el origen === */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Destino <span className="text-red-500"></span></label>
                                <select value={formData.lug_destino_id || ''} onChange={e => {
                                    const v = e.target.value ? parseInt(e.target.value) : undefined;
                                    setFormData({ ...formData, lug_destino_id: v });
                                    if (formErrors.lug_destino_id) setFormErrors({ ...formErrors, lug_destino_id: '' });
                                }} className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed ${formErrors.lug_destino_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}>
                                    <option value="">Seleccionar Destino...</option>
                                    {lugares
                                        .filter(l => l.lug_id !== formData.lug_origen_id)
                                        .map(l => <option key={l.lug_id} value={l.lug_id}>{l.lug_nombre}</option>)}
                                </select>
                                {formErrors.lug_destino_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.lug_destino_id}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Recorrido (km) <span className="text-red-500">*</span></label>
                                <input
                                    value={formData.tic_recorrido_km || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, tic_recorrido_km: parseFloat(e.target.value) });
                                        if (formErrors.tic_recorrido_km) setFormErrors({ ...formErrors, tic_recorrido_km: '' });
                                    }}
                                    type="number" step="0.1"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white font-bold group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.tic_recorrido_km ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="0.0"
                                />
                                {formErrors.tic_recorrido_km && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tic_recorrido_km}</p>}
                            </div>

                            {/* ── CAMPOS DEL MODELO PREDICTIVO ── */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Hora Despacho</label>
                                <input
                                    value={formData.tic_hora_despacho || ''}
                                    onChange={e => {
                                        const hora = e.target.value;
                                        setFormData(prev => ({ ...prev, tic_hora_despacho: hora }));
                                        if (modalMode === 'create') triggerPrediccion(hora, { ...formData, tic_hora_despacho: hora });
                                    }}
                                    type="time"
                                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all hover:bg-emerald-50 group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:border-gray-200 border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/10 bg-emerald-50/30"
                                />
                            </div>

                            {/* Tarjeta de predicción en tiempo real */}
                            {modalMode === 'create' && (
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <Brain size={11} className="text-emerald-500" />
                                        Predicción IA
                                    </label>
                                    {prediciendo ? (
                                        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                            <Loader2 size={16} className="text-emerald-500 animate-spin flex-shrink-0" />
                                            <span className="text-sm text-emerald-700 font-medium">Consultando modelo Random Forest...</span>
                                        </div>
                                    ) : horaLlegadaIA ? (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Llegada estimada por el modelo</p>
                                                    <p className="text-2xl font-black text-emerald-700 mt-0.5">{horaLlegadaIA}</p>
                                                    <p className="text-xs text-emerald-500 mt-0.5">≈ {tiempoPredichoMin} minutos de viaje</p>
                                                </div>
                                                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                                                    <Brain size={22} className="text-emerald-600" />
                                                </div>
                                            </div>
                                            {nivelCriticidadIA && (
                                                <div className={`mt-2 p-3 rounded-xl border ${nivelCriticidadIA === 'ALTO' ? 'bg-red-50 border-red-200' : nivelCriticidadIA === 'MEDIO' ? 'bg-amber-50 border-amber-200' : nivelCriticidadIA === 'SIN NOVEDAD' ? 'bg-gray-50 border-gray-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <AlertCircle size={14} className={nivelCriticidadIA === 'ALTO' ? 'text-red-500' : nivelCriticidadIA === 'MEDIO' ? 'text-amber-500' : nivelCriticidadIA === 'SIN NOVEDAD' ? 'text-gray-400' : 'text-emerald-500'} />
                                                        <span className={`text-xs font-bold uppercase ${nivelCriticidadIA === 'ALTO' ? 'text-red-700' : nivelCriticidadIA === 'MEDIO' ? 'text-amber-700' : nivelCriticidadIA === 'SIN NOVEDAD' ? 'text-gray-500' : 'text-emerald-700'}`}>
                                                            Riesgo: {nivelCriticidadIA}
                                                        </span>
                                                    </div>
                                                    {avisoIA && <p className={`text-[11px] leading-relaxed ${nivelCriticidadIA === 'ALTO' ? 'text-red-600' : nivelCriticidadIA === 'MEDIO' ? 'text-amber-600' : nivelCriticidadIA === 'SIN NOVEDAD' ? 'text-gray-500' : 'text-emerald-600'}`}>{avisoIA}</p>}
                                                </div>
                                            )}
                                        </div>
                                    ) : errorPrediccion ? (
                                        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                                            <p className="text-xs text-amber-700 font-medium">⚠️ {errorPrediccion}</p>
                                            <p className="text-[10px] text-amber-500 mt-0.5">Asegúrate que la API esté corriendo en puerto 8000</p>
                                        </div>
                                    ) : (
                                        <div className="px-4 py-3 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                                            <p className="text-xs text-gray-400 font-medium">Llena los campos requeridos y pon la hora de despacho para ver la predicción</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Mostrar alerta de riesgo en modo edición/vista si ya está guardado */}
                            {modalMode !== 'create' && formData.tic_nivel_riesgo && (
                                <div className="sm:col-span-3">
                                    <div className={`px-4 py-3 rounded-2xl border flex gap-3 ${formData.tic_nivel_riesgo === 'Alto' ? 'bg-red-50 border-red-200' : formData.tic_nivel_riesgo === 'Medio' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                        <AlertCircle size={18} className={`mt-0.5 flex-shrink-0 ${formData.tic_nivel_riesgo === 'Alto' ? 'text-red-500' : formData.tic_nivel_riesgo === 'Medio' ? 'text-amber-500' : 'text-emerald-500'}`} />
                                        <div>
                                            <p className={`text-xs font-bold uppercase tracking-wider ${formData.tic_nivel_riesgo === 'Alto' ? 'text-red-700' : formData.tic_nivel_riesgo === 'Medio' ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                Nivel de Riesgo del Viaje: {formData.tic_nivel_riesgo}
                                            </p>
                                            <p className={`text-[11px] mt-1 leading-relaxed ${formData.tic_nivel_riesgo === 'Alto' ? 'text-red-600' : formData.tic_nivel_riesgo === 'Medio' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {formData.tic_nivel_riesgo === 'Alto' ? 'Riesgo de incidentes graves. Tome precauciones adicionales y verifique la unidad.' :
                                                    formData.tic_nivel_riesgo === 'Medio' ? 'Posibles incidentes moderados. Revise el estado del vehículo antes de despachar.' :
                                                        'Viaje sin novedad esperada. Despacho normal.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Hora estimada en modo edición/vista */}
                            {modalMode !== 'create' && (
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <Brain size={11} className="text-emerald-500" />
                                        Hora Est. Llegada (IA)
                                    </label>
                                    <input
                                        value={formData.tic_tiempo_estimado_llegada || ''}
                                        onChange={e => setFormData({ ...formData, tic_tiempo_estimado_llegada: e.target.value })}
                                        type="time"
                                        className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:border-gray-200 border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/10 bg-emerald-50/30 font-bold text-emerald-700"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Nivel de Riesgo</label>
                                <select
                                    value={formData.tic_nivel_riesgo || 'Bajo'}
                                    onChange={e => setFormData({ ...formData, tic_nivel_riesgo: e.target.value as any })}
                                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all hover:bg-emerald-50 cursor-pointer font-bold group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:border-gray-200 group-disabled:cursor-not-allowed border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/10 bg-emerald-50/30 text-emerald-700"
                                >
                                    <option value="Bajo">Bajo</option>
                                    <option value="Medio">Medio</option>
                                    <option value="Alto">Alto</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Hora Llegada Real</label>
                                <input
                                    value={formData.tic_tiempo_real_llegada || ''}
                                    onChange={e => setFormData({ ...formData, tic_tiempo_real_llegada: e.target.value })}
                                    type="time"
                                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all hover:bg-emerald-50 group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:border-gray-200 border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/10 bg-emerald-50/30"
                                />
                            </div>

                            <div className="space-y-1.5 sm:col-span-3">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Observaciones</label>
                                <textarea
                                    value={formData.tic_observaciones || ''}
                                    onChange={e => setFormData({ ...formData, tic_observaciones: e.target.value })}
                                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white resize-none group-disabled:bg-gray-100/50 group-disabled:text-gray-500"
                                    placeholder="Detalles adicionales, novedades en ruta..."
                                    rows={1}
                                />
                            </div>
                        </fieldset>

                        {/* Mensaje de mora automático cuando se registra hora real */}
                        {(() => {
                            const estimada = modalMode === 'create' ? horaLlegadaIA : formData.tic_tiempo_estimado_llegada;
                            const real = formData.tic_tiempo_real_llegada;
                            if (!estimada || !real) return null;
                            const [hE, mE] = estimada.split(':').map(Number);
                            const [hR, mR] = real.split(':').map(Number);
                            const mora = (hR * 60 + mR) - (hE * 60 + mE);
                            if (mora > 0) return (
                                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
                                    <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-red-700">Mora de {mora} minutos</p>
                                        <p className="text-xs text-red-500">El vehículo llegó {mora} min después de lo estimado por el modelo</p>
                                    </div>
                                </div>
                            );
                            if (mora < 0) return (
                                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-emerald-700">Llegó {Math.abs(mora)} minutos antes</p>
                                        <p className="text-xs text-emerald-500">El vehículo llegó antes del tiempo estimado por el modelo</p>
                                    </div>
                                </div>
                            );
                            return (
                                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl">
                                    <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
                                    <p className="text-sm font-bold text-blue-700">Llegó exactamente a tiempo ✓</p>
                                </div>
                            );
                        })()}

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            {modalMode === 'view' ? (
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-bold transition-all"
                                >
                                    Cerrar Detalles
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        disabled={prediciendo}
                                        className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-all border border-gray-200 disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => {
                                            // Si hay riesgo alto/medio y aún no se revisaron las recomendaciones, mostrar modal primero
                                            if (modalMode === 'create' && (nivelCriticidadIA === 'ALTO' || nivelCriticidadIA === 'MEDIO') && !recomPendiente) {
                                                setShowRecomModal(true);
                                            } else {
                                                handleSave();
                                            }
                                        }}
                                        disabled={prediciendo}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {prediciendo ? <Loader2 size={15} className="animate-spin" /> : <Brain size={15} />}
                                        {modalMode === 'create' ? 'Crear Ticket' : 'Guardar Cambios'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </Modal>

                {/* ══════════════════════════════════════════════════
                    MODAL DE RECOMENDACIONES PREVENTIVAS
                    Se dispara automáticamente cuando la IA detecta
                    riesgo MEDIO o ALTO en el viaje a registrar.
                ══════════════════════════════════════════════════ */}
                {showRecomModal && nivelCriticidadIA && (nivelCriticidadIA === 'ALTO' || nivelCriticidadIA === 'MEDIO') && (
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                        style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.55)' }}
                    >
                        <div
                            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                            style={{ animation: 'slideUpModal 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}
                        >
                            {/* Cabecera según nivel */}
                            <div className={`px-6 pt-6 pb-4 ${nivelCriticidadIA === 'ALTO'
                                ? 'bg-gradient-to-br from-red-600 to-rose-700'
                                : 'bg-gradient-to-br from-amber-500 to-orange-600'
                                }`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            {nivelCriticidadIA === 'ALTO'
                                                ? <ShieldAlert size={26} className="text-white" />
                                                : <ShieldX size={26} className="text-white" />}
                                        </div>
                                        <div>
                                            <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Alerta Preventiva — IA</p>
                                            <h2 className="text-white font-black text-lg leading-tight">
                                                {nivelCriticidadIA === 'ALTO' ? 'Riesgo ALTO Detectado' : 'Riesgo MEDIO Detectado'}
                                            </h2>
                                            <p className="text-white/75 text-xs mt-0.5">Revise las recomendaciones antes de despachar</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowRecomModal(false)}
                                        className="text-white/70 hover:text-white transition-colors mt-0.5"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Resumen rápido */}
                                <div className="mt-4 flex gap-3">
                                    <div className="bg-white/15 rounded-xl px-3 py-2 flex-1 text-center">
                                        <p className="text-white/70 text-[9px] uppercase font-bold">Llegada estimada</p>
                                        <p className="text-white font-black text-base">{horaLlegadaIA || '—'}</p>
                                    </div>
                                    <div className="bg-white/15 rounded-xl px-3 py-2 flex-1 text-center">
                                        <p className="text-white/70 text-[9px] uppercase font-bold">Duración</p>
                                        <p className="text-white font-black text-base">{tiempoPredichoMin} min</p>
                                    </div>
                                    <div className={`rounded-xl px-3 py-2 flex-1 text-center ${nivelCriticidadIA === 'ALTO' ? 'bg-red-900/40' : 'bg-orange-900/30'
                                        }`}>
                                        <p className="text-white/70 text-[9px] uppercase font-bold">Nivel riesgo</p>
                                        <p className="text-white font-black text-base">{nivelCriticidadIA}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Cuerpo con recomendaciones */}
                            <div className="px-6 py-5 space-y-3 max-h-72 overflow-y-auto">
                                <div className="flex items-center gap-2 mb-1">
                                    <ClipboardList size={14} className="text-gray-400" />
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Acciones preventivas recomendadas</p>
                                </div>

                                {/* Aviso principal de la IA */}
                                {avisoIA && (
                                    <div className={`flex gap-3 p-3 rounded-xl border ${nivelCriticidadIA === 'ALTO' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                                        }`}>
                                        <ShieldAlert size={15} className={`flex-shrink-0 mt-0.5 ${nivelCriticidadIA === 'ALTO' ? 'text-red-500' : 'text-amber-500'
                                            }`} />
                                        <p className={`text-xs leading-relaxed font-medium ${nivelCriticidadIA === 'ALTO' ? 'text-red-700' : 'text-amber-700'
                                            }`}>{avisoIA}</p>
                                    </div>
                                )}

                                {/* Checklist de acciones concretas */}
                                {nivelCriticidadIA === 'ALTO' ? (
                                    <div className="space-y-2">
                                        {[
                                            { icon: <ShieldX size={13} className="text-red-500 flex-shrink-0" />, text: 'Evaluar suspensión temporal: Posponer el despacho hasta que las condiciones mejoren.', bold: true },
                                            { icon: <Wrench size={13} className="text-red-400 flex-shrink-0" />, text: 'Inspección técnica rigurosa: Verificar tracción del vehículo y presión de neumáticos.' },
                                            { icon: <Thermometer size={13} className="text-red-400 flex-shrink-0" />, text: 'Alerta de terreno: Riesgo inminente de atascamiento en mina por humedad reciente.' },
                                            { icon: <Phone size={13} className="text-red-400 flex-shrink-0" />, text: 'Escalamiento inmediato: Notificar al supervisor de turno y registrar alerta en bitácora.' },
                                            { icon: <Wind size={13} className="text-red-400 flex-shrink-0" />, text: 'Asignación estratégica: Garantizar vehículo con alta capacidad de tracción si se procede.' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-start gap-2.5 p-2.5 bg-red-50/60 rounded-xl border border-red-100">
                                                {item.icon}
                                                <p className={`text-xs text-red-800 leading-snug ${item.bold ? 'font-bold' : 'font-medium'}`}>{item.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {[
                                            { icon: <Wrench size={13} className="text-amber-500 flex-shrink-0" />, text: 'Control preventivo: Revisar estado de neumáticos, fluidos y reducir velocidad.' },
                                            { icon: <Thermometer size={13} className="text-amber-400 flex-shrink-0" />, text: 'Precaución de terreno: Posibilidad de terreno blando por humedad reciente en mina.' },
                                            { icon: <ShieldCheck size={13} className="text-amber-400 flex-shrink-0" />, text: 'Validación del operador: Confirmar que el conductor esté capacitado para estas condiciones.' },
                                            { icon: <Phone size={13} className="text-amber-400 flex-shrink-0" />, text: 'Monitoreo constante: Mantener comunicación activa y extremar cuidados en zona no asfaltada.' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-start gap-2.5 p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                                                {item.icon}
                                                <p className="text-xs text-amber-800 leading-snug font-medium">{item.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pie con botones de decisión + notificación */}
                            <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-3">

                                {/* Resultado de la notificación */}
                                {resultadoNotif && (
                                    <div className={`flex items-start gap-2.5 p-3 rounded-xl text-sm font-medium ${resultadoNotif.ok
                                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                                        : 'bg-amber-50 border border-amber-200 text-amber-800'
                                        }`}>
                                        {resultadoNotif.ok
                                            ? <BellRing size={15} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                                            : <BellOff size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />}
                                        <span>{resultadoNotif.mensaje}</span>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    {/* Botón 1 — Cancelar */}
                                    <button
                                        disabled={enviandoNotif}
                                        onClick={() => {
                                            setShowRecomModal(false);
                                            setShowForm(false);
                                        }}
                                        className="flex-1 h-10 flex items-center justify-center px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 whitespace-nowrap"
                                    >
                                        Cancelar
                                    </button>

                                    {/* Botón 2 — Dejar pendiente (24h) */}
                                    <button
                                        disabled={enviandoNotif}
                                        onClick={handleDejarPendiente}
                                        className="flex-1 h-10 flex items-center justify-center gap-2 px-5 bg-slate-600 hover:bg-slate-700 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-slate-500/20 active:scale-95 disabled:opacity-60 whitespace-nowrap"
                                    >
                                        {enviandoNotif
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <BellOff size={14} />}
                                        <span>Pendiente 24h</span>
                                    </button>

                                    {/* Botón 3 — Despachar y notificar ya */}
                                    <button
                                        disabled={enviandoNotif}
                                        onClick={handleNotificarYDespachar}
                                        className={`flex-1 h-10 flex items-center justify-center gap-2 px-5 text-white rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-60 whitespace-nowrap ${nivelCriticidadIA === 'ALTO'
                                            ? 'bg-red-600 hover:bg-red-700 shadow-red-500/25'
                                            : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25'
                                            }`}
                                    >
                                        {enviandoNotif
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <BellRing size={14} />}
                                        <span>Despachar y notificar</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <style>{`
                            @keyframes slideUpModal {
                                from { opacity: 0; transform: translateY(24px) scale(0.96); }
                                to   { opacity: 1; transform: translateY(0) scale(1); }
                            }
                        `}</style>
                    </div>
                )}

                {/* Tabla */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando tickets...</div>
                    ) : (
                        <div className="overflow-x-auto table-responsive">
                            <table className="w-[1250px] lg:w-full text-sm table-fixed">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        <th className="px-3 py-3 w-[45px] text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                onChange={handleSelectAll}
                                                checked={rows.length > 0 && selectedTickets.length === rows.length}
                                            />
                                        </th>
                                        <th className="text-left px-3 py-3 w-[90px]">N° Ticket</th>
                                        <th className="text-left px-2 py-3 w-[85px]">Fecha</th>
                                        <th className="text-left px-2 py-3 w-[110px]">Estado</th>
                                        <th className="text-left px-2 py-3 w-[90px]">Placa</th>
                                        <th className="text-left px-2 py-3 w-[110px]">Socio</th>
                                        <th className="text-left px-2 py-3 w-[50px]">m³</th>
                                        <th className="text-left px-2 py-3 w-[120px]">Material</th>
                                        <th className="text-left px-2 py-3 w-[130px]">Cliente</th>
                                        <th className="text-left px-2 py-3 w-[100px]">Origen</th>
                                        <th className="text-left px-2 py-3 w-[100px]">Destino</th>
                                        <th className="text-left px-2 py-3 w-[70px]">km</th>
                                        <th className="text-center px-2 py-3 w-[90px]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={13} className="text-center py-8 text-gray-500">No se encontraron tickets registrados</td></tr>
                                    ) : rows.map(t => {
                                        const StatusIcon = ICON[t.tic_estado] || CheckCircle;
                                        const socio = t.vehiculo?.transportista ? `${t.vehiculo.transportista.tra_nombre} ${t.vehiculo.transportista.tra_apellido}` : '—';

                                        return (
                                            <tr key={t.tic_id} className={`transition-colors ${selectedTickets.includes(t.tic_id) ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'}`}>
                                                <td className="px-3 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        checked={selectedTickets.includes(t.tic_id)}
                                                        onChange={() => handleSelectTicket(t.tic_id)}
                                                    />
                                                </td>
                                                <td className="px-3 py-3 font-mono font-semibold text-gray-900 text-xs">{t.tic_numero}</td>
                                                <td className="px-2 py-3 text-gray-500 text-xs">{t.tic_fecha}</td>
                                                <td className="px-2 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${BADGE[t.tic_estado] || 'bg-gray-100 text-gray-700'}`}>
                                                        <StatusIcon size={10} />
                                                        <span className="capitalize">{t.tic_estado}</span>
                                                    </span>
                                                </td>
                                                <td className="px-2 py-3 font-mono text-gray-600 text-xs">{t.vehiculo?.veh_placa || '—'}</td>
                                                <td className="px-2 py-3 text-gray-800 font-medium text-xs truncate" title={socio}>{socio}</td>
                                                <td className="px-2 py-3 font-semibold text-gray-700 text-xs">{t.tic_cubicaje}</td>
                                                <td className="px-2 py-3 text-gray-600 text-xs truncate" title={t.material?.mat_nombre}>{t.material?.mat_nombre || '—'}</td>
                                                <td className="px-2 py-3 text-gray-600 text-xs truncate" title={t.cliente?.cli_nombre}>{t.cliente?.cli_nombre || '—'}</td>
                                                <td className="px-2 py-3 text-gray-500 text-xs truncate" title={lugares.find(l => l.lug_id === t.lug_origen_id)?.lug_nombre}>{lugares.find(l => l.lug_id === t.lug_origen_id)?.lug_nombre || '—'}</td>
                                                <td className="px-2 py-3 text-gray-500 text-xs truncate" title={lugares.find(l => l.lug_id === t.lug_destino_id)?.lug_nombre}>{lugares.find(l => l.lug_id === t.lug_destino_id)?.lug_nombre || '—'}</td>
                                                <td className="px-2 py-3 font-semibold text-gray-700 text-xs">{t.tic_recorrido_km || 0} km</td>
                                                <td className="px-2 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <button onClick={() => handleView(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver"><Eye size={13} /></button>
                                                        <button onClick={() => handleEdit(t)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit size={13} /></button>
                                                        {!isDespachador && <button onClick={() => handleDelete(t.tic_id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={13} /></button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
