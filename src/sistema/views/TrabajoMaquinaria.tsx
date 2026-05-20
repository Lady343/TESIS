import { useState, useEffect } from 'react';
import Header from '../layout/Header';
import { Plus, Search, CheckCircle, AlertCircle, Edit, Trash2, Wrench, Eye, Filter } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';
import { Cliente } from '../types';
import { useUser } from '../UserContext';

const BADGE: Record<string, string> = {
    facturado: 'bg-emerald-100 text-emerald-700',
    pendiente: 'bg-amber-100 text-amber-700',
    anulado: 'bg-red-100 text-red-700',
};
const ICON: Record<string, React.ElementType> = {
    facturado: CheckCircle, pendiente: AlertCircle, anulado: AlertCircle,
};

export default function Maquinaria() {
    const { dbUserId } = useUser();
    const [search, setSearch] = useState('');
    const [estado, setEstado] = useState('todos');
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<any>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [trabajos, setTrabajos] = useState<any[]>([]);
    const [selectedTrabajos, setSelectedTrabajos] = useState<number[]>([]);
    const [maquinas, setMaquinas] = useState<any[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrabajos();
        fetchDropdowns();
    }, []);

    const fetchTrabajos = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('trabajo_maquinaria')
            .select(`
                *,
                maquina_cooperativa ( mac_placa, mac_tipo ),
                cliente ( cli_nombre )
            `)
            .order('trm_id', { ascending: false });
        if (error) console.error('Error fetching trabajos', error);
        else setTrabajos(data || []);
        setLoading(false);
    };

    const fetchDropdowns = async () => {
        const [mRes, cRes] = await Promise.all([
            supabase.from('maquina_cooperativa').select('*').eq('mac_estado', 'activa'),
            supabase.from('cliente').select('*').eq('cli_estado', 'activo')
        ]);
        if (mRes.data) setMaquinas(mRes.data);
        if (cRes.data) setClientes(cRes.data);
    };

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', trabajo?: any) => {
        setFormErrors({});
        setModalMode(mode);
        if (trabajo) {
            setFormData(trabajo);
        } else {
            setFormData({
                trm_nro_registro: `MT-${String(trabajos.length + 1).padStart(4, '0')}`,
                trm_fecha: new Date().toISOString().split('T')[0],
                trm_estado: 'pendiente'
            });
        }
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Está seguro de eliminar este registro de forma permanente?')) {
            const { error } = await supabase.from('trabajo_maquinaria').delete().eq('trm_id', id);
            if (error) alert('Error: ' + error.message);
            else {
                fetchTrabajos();
                setSelectedTrabajos(selectedTrabajos.filter(mId => mId !== id));
            }
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedTrabajos(rows.map(m => m.trm_id));
        } else {
            setSelectedTrabajos([]);
        }
    };

    const handleSelectTrabajo = (id: number) => {
        if (selectedTrabajos.includes(id)) {
            setSelectedTrabajos(selectedTrabajos.filter(mId => mId !== id));
        } else {
            setSelectedTrabajos([...selectedTrabajos, id]);
        }
    };

    const handleMassDelete = async () => {
        if (selectedTrabajos.length === 0) return;
        if (window.confirm(`¿Está seguro de eliminar de forma permanente los ${selectedTrabajos.length} registros seleccionados?`)) {
            const { error } = await supabase.from('trabajo_maquinaria').delete().in('trm_id', selectedTrabajos);
            if (error) alert('Error: ' + error.message);
            else {
                fetchTrabajos();
                setSelectedTrabajos([]);
            }
        }
    };

    const handleSave = async () => {
        const errors: Record<string, string> = {};

        if (!formData.trm_nro_registro) errors.trm_nro_registro = 'Este campo es obligatorio';
        if (!formData.trm_fecha) errors.trm_fecha = 'Este campo es obligatorio';
        if (!formData.mac_id) errors.mac_id = 'Este campo es obligatorio';
        // cli_id is optional in schema
        if (!formData.trm_hora_inicial) errors.trm_hora_inicial = 'Este campo es obligatorio';
        if (!formData.trm_hora_final) errors.trm_hora_final = 'Este campo es obligatorio';
        if (!formData.trm_valor_hora) errors.trm_valor_hora = 'Este campo es obligatorio';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        const vHora = parseFloat(formData.trm_valor_hora) || 0;

        const payload = {
            trm_nro_registro: formData.trm_nro_registro,
            trm_fecha: formData.trm_fecha,
            mac_id: formData.mac_id,
            cli_id: formData.cli_id || null,
            trm_hora_inicial: formData.trm_hora_inicial,
            trm_hora_final: formData.trm_hora_final,
            trm_valor_hora: vHora,
            trm_valor_facturar: formData.trm_valor_facturar || null,
            trm_estado: formData.trm_estado || 'pendiente',
            usr_creado_por: dbUserId
        };
        // NOTE: trm_total_horas is GENERATED ALWAYS AS ... STORED so we do not include it in payload

        if (modalMode === 'create') {
            const { error } = await supabase.from('trabajo_maquinaria').insert([payload]);
            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchTrabajos();
            }
        } else if (modalMode === 'edit') {
            const { error } = await supabase.from('trabajo_maquinaria').update(payload).eq('trm_id', formData.trm_id);
            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchTrabajos();
            }
        }
    };

    const rows = trabajos.filter(m => {
        const q = search.toLowerCase();
        const num = m.trm_nro_registro?.toLowerCase() || '';
        const maq = m.maquina_cooperativa?.mac_placa?.toLowerCase() || '';
        const cli = m.cliente?.cli_nombre?.toLowerCase() || '';

        return (
            (num.includes(q) || maq.includes(q) || cli.includes(q)) &&
            (estado === 'todos' || m.trm_estado === estado)
        );
    });

    const totalHoras = trabajos.reduce((sum, curr) => sum + (curr.trm_total_horas || 0), 0);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Maquinaria – Trabajos" subtitle="Registro de trabajos realizados con maquinaria de la cooperativa" />

            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
                {/* Resumen */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Trabajos', value: trabajos.length, bg: 'bg-gray-100', color: 'text-gray-600' },
                        { label: 'Facturados', value: trabajos.filter(m => m.trm_estado === 'facturado').length, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                        { label: 'Pendientes', value: trabajos.filter(m => m.trm_estado === 'pendiente').length, bg: 'bg-amber-50', color: 'text-amber-600' },
                        { label: 'Total Horas', value: totalHoras.toFixed(2) + ' h', bg: 'bg-red-50', color: 'text-red-500' },
                    ].map(c => (
                        <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover-card-premium">
                            <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                <Wrench size={20} className={c.color} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{c.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2 flex-1 max-w-md">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por registro, máquina o cliente…"
                            className="bg-transparent text-sm text-gray-700 outline-none w-full"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap ml-auto">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 mr-2">
                            <Filter size={13} className="text-gray-400" />
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Filtrar:</span>
                        </div>
                        {['todos', 'pendiente', 'facturado', 'anulado'].map(e => (
                            <button
                                key={e}
                                onClick={() => setEstado(e)}
                                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all capitalize ripple-effect ${estado === e
                                    ? e === 'todos' ? 'bg-gray-700 text-white shadow-md shadow-gray-200' :
                                        e === 'facturado' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' :
                                            e === 'pendiente' ? 'bg-amber-500 text-white shadow-md shadow-amber-100' :
                                                'bg-red-500 text-white shadow-md shadow-red-100'
                                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                                    }`}
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        {selectedTrabajos.length > 0 && (
                            <button
                                onClick={handleMassDelete}
                                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-red-200 active:scale-95"
                            >
                                <Trash2 size={16} />
                                Eliminar ({selectedTrabajos.length})
                            </button>
                        )}
                        <button
                            onClick={() => handleOpenModal('create')}
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 ripple-effect"
                        >
                            <Plus size={18} /> Nuevo Trabajo
                        </button>
                    </div>
                </div>

                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={
                        modalMode === 'create' ? "Registrar Trabajo de Maquinaria" :
                            modalMode === 'edit' ? "Editar Trabajo de Maquinaria" : "Detalles del Trabajo"
                    }
                    maxWidth="lg"
                >
                    <div className="space-y-4">
                        <fieldset disabled={modalMode === 'view'} className="grid grid-cols-1 sm:grid-cols-2 gap-4 group">
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Número de Registro</label>
                                <input
                                    value={formData.trm_nro_registro || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, trm_nro_registro: e.target.value });
                                        if (formErrors.trm_nro_registro) setFormErrors({ ...formErrors, trm_nro_registro: '' });
                                    }}
                                    type="text"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white font-mono font-bold text-gray-900 group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.trm_nro_registro ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="MT-0000"
                                />
                                {formErrors.trm_nro_registro && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.trm_nro_registro}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Fecha del Servicio</label>
                                <input
                                    value={formData.trm_fecha || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, trm_fecha: e.target.value });
                                        if (formErrors.trm_fecha) setFormErrors({ ...formErrors, trm_fecha: '' });
                                    }}
                                    type="date"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.trm_fecha ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                />
                                {formErrors.trm_fecha && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.trm_fecha}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Maquinaria / Equipo</label>
                                <select
                                    value={formData.mac_id || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, mac_id: parseInt(e.target.value) });
                                        if (formErrors.mac_id) setFormErrors({ ...formErrors, mac_id: '' });
                                    }}
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed ${formErrors.mac_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                >
                                    <option value="">Seleccione...</option>
                                    {maquinas.map(m => (
                                        <option key={m.mac_id} value={m.mac_id}>{m.mac_placa} ({m.mac_tipo})</option>
                                    ))}
                                </select>
                                {formErrors.mac_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.mac_id}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cliente (Opcional)</label>
                                <select
                                    value={formData.cli_id || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, cli_id: e.target.value ? parseInt(e.target.value) : undefined });
                                    }}
                                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed"
                                >
                                    <option value="">Sin Cliente Asignado</option>
                                    {clientes.map(c => (
                                        <option key={c.cli_id} value={c.cli_id}>{c.cli_nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Hora Inicio</label>
                                    <input
                                        value={formData.trm_hora_inicial || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, trm_hora_inicial: e.target.value });
                                            if (formErrors.trm_hora_inicial) setFormErrors({ ...formErrors, trm_hora_inicial: '' });
                                        }}
                                        type="time" step="60"
                                        className={`w-full border rounded-2xl px-3 py-3 text-sm focus:outline-none transition-all bg-gray-50/50 focus:ring-4 group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.trm_hora_inicial ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    />
                                    {formErrors.trm_hora_inicial && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.trm_hora_inicial}</p>}
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Hora Fin</label>
                                    <input
                                        value={formData.trm_hora_final || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, trm_hora_final: e.target.value });
                                            if (formErrors.trm_hora_final) setFormErrors({ ...formErrors, trm_hora_final: '' });
                                        }}
                                        type="time" step="60"
                                        className={`w-full border rounded-2xl px-3 py-3 text-sm focus:outline-none transition-all bg-gray-50/50 focus:ring-4 group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.trm_hora_final ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    />
                                    {formErrors.trm_hora_final && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.trm_hora_final}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Valor Hora ($)</label>
                                    <input
                                        value={formData.trm_valor_hora || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, trm_valor_hora: parseFloat(e.target.value) });
                                            if (formErrors.trm_valor_hora) setFormErrors({ ...formErrors, trm_valor_hora: '' });
                                        }}
                                        type="number" step="0.5"
                                        className={`w-full border rounded-2xl px-3 py-3 text-sm focus:outline-none transition-all bg-gray-50/50 font-bold focus:ring-4 group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.trm_valor_hora ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                        placeholder="0.00"
                                    />
                                    {formErrors.trm_valor_hora && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.trm_valor_hora}</p>}
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total ($)</label>
                                    <input
                                        value={formData.trm_valor_facturar || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, trm_valor_facturar: parseFloat(e.target.value) });
                                        }}
                                        type="number" step="0.5"
                                        className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm focus:outline-none transition-all bg-gray-50/50 font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 group-disabled:bg-gray-100/50 group-disabled:text-gray-500"
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>

                            {modalMode !== 'create' && (
                                <div className="space-y-2 sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estado Trabajo</label>
                                    <select value={formData.trm_estado || 'pendiente'} onChange={e => setFormData({ ...formData, trm_estado: e.target.value })} className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm focus:outline-none transition-all bg-gray-50/50 appearance-none cursor-pointer font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed">
                                        <option value="pendiente">PENDIENTE</option>
                                        <option value="facturado">FACTURADO</option>
                                        <option value="anulado">ANULADO</option>
                                    </select>
                                </div>
                            )}
                        </fieldset>

                        <div className="flex justify-end gap-3 pt-5 border-t border-gray-100 mt-2">
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
                                        className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-all border border-gray-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button onClick={handleSave} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                        {modalMode === 'create' ? 'Guardar Registro' : 'Guardar Cambios'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </Modal>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando trabajos...</div>
                    ) : (
                        <div className="overflow-x-auto table-responsive">
                            <table className="w-[1050px] lg:w-full text-sm table-fixed">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        <th className="px-3 py-3 w-[45px] text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                onChange={handleSelectAll}
                                                checked={rows.length > 0 && selectedTrabajos.length === rows.length}
                                            />
                                        </th>
                                        <th className="text-left px-5 py-3 w-[120px]">N° Registro</th>
                                        <th className="text-left px-4 py-3 w-[90px]">Fecha</th>
                                        <th className="text-left px-4 py-3 w-[200px]">Máquina</th>
                                        <th className="text-left px-4 py-3 w-[150px]">Cliente</th>
                                        <th className="text-left px-4 py-3 w-[110px]">Horario</th>
                                        <th className="text-left px-4 py-3 w-[70px]">Horas</th>
                                        <th className="text-left px-4 py-3 w-[90px]">Val. Fac.</th>
                                        <th className="text-left px-4 py-3 w-[110px]">Estado</th>
                                        <th className="text-center px-2 py-3 w-[90px]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={10} className="text-center py-8 text-gray-500">No se encontraron trabajos de maquinaria</td></tr>
                                    ) : rows.map(m => {
                                        const StatusIcon = ICON[m.trm_estado] || CheckCircle;
                                        return (
                                            <tr key={m.trm_id} className={`transition-colors ${selectedTrabajos.includes(m.trm_id) ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'}`}>
                                                <td className="px-3 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        checked={selectedTrabajos.includes(m.trm_id)}
                                                        onChange={() => handleSelectTrabajo(m.trm_id)}
                                                    />
                                                </td>
                                                <td className="px-5 py-3 font-mono font-semibold text-gray-900">{m.trm_nro_registro}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{m.trm_fecha}</td>
                                                <td className="px-4 py-3 text-gray-800 font-medium">{m.maquina_cooperativa?.mac_placa}</td>
                                                <td className="px-4 py-3 text-gray-600">{m.cliente?.cli_nombre || '—'}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{m.trm_hora_inicial} – {m.trm_hora_final}</td>
                                                <td className="px-4 py-3 text-gray-700 font-semibold">{Number(m.trm_total_horas || 0).toFixed(2)} h</td>
                                                <td className="px-4 py-3 text-gray-800 font-bold">{m.trm_valor_facturar !== null ? `$${m.trm_valor_facturar}` : '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${BADGE[m.trm_estado] || 'bg-gray-100 text-gray-700'}`}>
                                                        <StatusIcon size={11} /><span className="capitalize">{m.trm_estado}</span>
                                                    </span>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <button onClick={() => handleOpenModal('view', m)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver"><Eye size={13} /></button>
                                                        <button onClick={() => handleOpenModal('edit', m)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit size={13} /></button>
                                                        <button onClick={() => handleDelete(m.trm_id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={13} /></button>
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
