import { useState, useEffect } from 'react';
import Header from '../layout/Header';
import { Plus, Search, Filter, CheckCircle, AlertCircle, Eye, Edit, Trash2, Hammer } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';
import { Extra, Lugar, Material } from '../types';
import { useUser } from '../UserContext';

const BADGE: Record<string, string> = {
    completado: 'bg-emerald-100 text-emerald-700',
    anulado: 'bg-red-100 text-red-700',
};
const ICON: Record<string, React.ElementType> = {
    completado: CheckCircle, anulado: AlertCircle,
};

export default function Cachuelos() {
    const { isDespachador, dbUserId } = useUser();
    const [search, setSearch] = useState('');
    const [estado, setEstado] = useState('todos');
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<Partial<Extra>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [extras, setExtras] = useState<any[]>([]);
    const [selectedExtras, setSelectedExtras] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    // Dropdown Data
    const [vehiculos, setVehiculos] = useState<any[]>([]);
    const [lugares, setLugares] = useState<Lugar[]>([]);
    const [materiales, setMateriales] = useState<Material[]>([]);

    useEffect(() => {
        fetchExtras();
        fetchDropdownData();
    }, []);

    const fetchExtras = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('extra')
            .select(`
                *,
                vehiculo:veh_id ( veh_placa, veh_cubicaje, transportista:tra_id ( tra_nombre, tra_apellido, tra_tipo ) ),
                material:mat_id ( mat_nombre ),
                origen:lug_origen_id ( lug_nombre )
            `)
            .order('ext_id', { ascending: false });

        if (error) console.error('Error fetching extras:', error);
        else setExtras(data || []);
        setLoading(false);
    };

    const fetchDropdownData = async () => {
        const [v, l, m] = await Promise.all([
            supabase.from('vehiculo').select('veh_id, veh_placa, veh_cubicaje, transportista:tra_id(tra_nombre, tra_apellido, tra_tipo)').eq('veh_estado', 'activa'),
            supabase.from('lugar').select('*').eq('lug_estado', 'activo'),
            supabase.from('material').select('*')
        ]);

        if (v.data) setVehiculos(v.data);
        if (l.data) setLugares(l.data);
        if (m.data) setMateriales(m.data);
    };

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', extra?: any) => {
        setFormErrors({});
        setModalMode(mode);
        if (extra) setFormData(extra);
        else setFormData({
            ext_numero: `CAC-${String(extras.length + 1).padStart(3, '0')}`,
            ext_fecha: new Date().toISOString().split('T')[0],
            ext_estado: 'completado'
        });
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Está seguro de eliminar este registro de forma permanente?')) {
            const { error } = await supabase.from('extra').delete().eq('ext_id', id);
            if (error) alert('Error: ' + error.message);
            else {
                fetchExtras();
                setSelectedExtras(selectedExtras.filter(eId => eId !== id));
            }
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedExtras(rows.map(c => c.ext_id));
        } else {
            setSelectedExtras([]);
        }
    };

    const handleSelectExtra = (id: number) => {
        if (selectedExtras.includes(id)) {
            setSelectedExtras(selectedExtras.filter(eId => eId !== id));
        } else {
            setSelectedExtras([...selectedExtras, id]);
        }
    };

    const handleMassDelete = async () => {
        if (selectedExtras.length === 0) return;
        if (window.confirm(`¿Está seguro de eliminar de forma permanente los ${selectedExtras.length} extras seleccionados?`)) {
            const { error } = await supabase.from('extra').delete().in('ext_id', selectedExtras);
            if (error) alert('Error: ' + error.message);
            else {
                fetchExtras();
                setSelectedExtras([]);
            }
        }
    };

    const handleSave = async () => {
        const errors: Record<string, string> = {};

        if (!formData.ext_numero) errors.ext_numero = 'Este campo es obligatorio';
        if (!formData.ext_fecha) errors.ext_fecha = 'Este campo es obligatorio';
        if (!formData.veh_id) errors.veh_id = 'Este campo es obligatorio';
        if (!formData.ext_cubicaje) errors.ext_cubicaje = 'Este campo es obligatorio';
        if (!formData.mat_id) errors.mat_id = 'Este campo es obligatorio';
        if (!formData.lug_origen_id) errors.lug_origen_id = 'Este campo es obligatorio';
        if (!formData.ext_precio) errors.ext_precio = 'Este campo es obligatorio';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        const payload = {
            ext_numero: formData.ext_numero,
            ext_fecha: formData.ext_fecha,
            veh_id: formData.veh_id,
            ext_cubicaje: formData.ext_cubicaje,
            mat_id: formData.mat_id,
            ext_detalle: formData.ext_detalle || null,
            lug_origen_id: formData.lug_origen_id || null,
            ext_precio: formData.ext_precio,
            ext_estado: formData.ext_estado || 'completado',
            usr_creado_por: dbUserId
        };

        if (modalMode === 'create') {
            const { error } = await supabase.from('extra').insert([payload]);
            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchExtras();
            }
        } else if (modalMode === 'edit') {
            const { error } = await supabase.from('extra').update(payload).eq('ext_id', formData.ext_id);
            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchExtras();
            }
        }
    };

    const rows = extras.filter(c => {
        const q = search.toLowerCase();
        const num = c.ext_numero?.toLowerCase() || '';
        const placa = c.vehiculo?.veh_placa?.toLowerCase() || '';
        const propietario = c.vehiculo?.transportista ? `${c.vehiculo.transportista.tra_nombre} ${c.vehiculo.transportista.tra_apellido}`.toLowerCase() : '';
        const material = c.material?.mat_nombre?.toLowerCase() || '';

        return (
            (num.includes(q) || propietario.includes(q) || material.includes(q) || placa.includes(q)) &&
            (estado === 'todos' || c.ext_estado === estado)
        );
    });

    const getSocioInfo = (veh_id?: number) => {
        if (!veh_id) return { nombre: '', tipo: '' };
        const v = vehiculos.find(v => v.veh_id === veh_id);
        if (v?.transportista) {
            return {
                nombre: `${v.transportista.tra_nombre} ${v.transportista.tra_apellido}`,
                tipo: v.transportista.tra_tipo
            };
        }
        return { nombre: 'Sin Asignar', tipo: '' };
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Extras" subtitle="Trabajos adicionales realizados fuera del esquema de tickets" />

            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
                {/* Resumen */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Extras', value: extras.length, icon: Hammer, bg: 'bg-amber-50', color: 'text-amber-600' },
                        { label: 'Completados', value: extras.filter(c => c.ext_estado === 'completado').length, icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                        { label: 'Anulados', value: extras.filter(c => c.ext_estado === 'anulado').length, icon: AlertCircle, bg: 'bg-red-50', color: 'text-red-500' },
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

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center">
                    {/* Búsqueda */}
                    <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2 flex-1 max-w-md">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar extra, propietario o material…"
                            className="bg-transparent text-sm text-gray-700 outline-none w-full"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Filtros */}
                    <div className="flex items-center gap-2 flex-wrap ml-auto">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 mr-2">
                            <Filter size={13} className="text-gray-400" />
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Filtrar:</span>
                        </div>
                        {['todos', 'completado', 'anulado'].map(e => (
                            <button
                                key={e}
                                onClick={() => setEstado(e)}
                                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all capitalize ripple-effect ${estado === e
                                    ? e === 'todos' ? 'bg-gray-600 text-white shadow-md shadow-gray-200' :
                                        e === 'completado' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' :
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
                        {selectedExtras.length > 0 && !isDespachador && (
                            <button
                                onClick={handleMassDelete}
                                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-red-200 active:scale-95"
                            >
                                <Trash2 size={16} />
                                Eliminar ({selectedExtras.length})
                            </button>
                        )}
                        <button
                            onClick={() => handleOpenModal('create')}
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 ripple-effect"
                        >
                            <Plus size={18} />
                            Nuevo Extra
                        </button>
                    </div>
                </div>

                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={
                        modalMode === 'create' ? "Registrar Trabajo Extra" :
                            modalMode === 'edit' ? "Editar Registro de Extra" : "Detalles del Extra"
                    }
                    maxWidth="lg"
                >
                    <div className="space-y-4">
                        <fieldset disabled={modalMode === 'view'} className="grid grid-cols-1 sm:grid-cols-2 gap-4 group">
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Número de Extra (Nro)</label>
                                <input
                                    value={formData.ext_numero || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, ext_numero: e.target.value });
                                        if (formErrors.ext_numero) setFormErrors({});
                                    }}
                                    type="text"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white font-mono font-bold text-gray-900 group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.ext_numero ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="CAC-000"
                                />
                                {formErrors.ext_numero && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.ext_numero}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Fecha del Registro</label>
                                <input
                                    value={formData.ext_fecha || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, ext_fecha: e.target.value });
                                        if (formErrors.ext_fecha) setFormErrors({ ...formErrors, ext_fecha: '' });
                                    }}
                                    type="date"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.ext_fecha ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                />
                                {formErrors.ext_fecha && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.ext_fecha}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Vehículo / Placa</label>
                                <select value={formData.veh_id || ''} onChange={e => {
                                    const v_id = e.target.value ? parseInt(e.target.value) : undefined;
                                    const v = vehiculos.find(veh => veh.veh_id === v_id);
                                    setFormData(prev => ({ ...prev, veh_id: v_id, ext_cubicaje: v?.veh_cubicaje || prev.ext_cubicaje }));
                                    if (formErrors.veh_id) setFormErrors({ ...formErrors, veh_id: '' });
                                }} className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed ${formErrors.veh_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}>
                                    <option value="">Seleccionar Placa...</option>
                                    {vehiculos.map(v => <option key={v.veh_id} value={v.veh_id}>{v.veh_placa}</option>)}
                                </select>
                                {formErrors.veh_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.veh_id}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Responsable / Propietario</label>
                                <div className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-100/50 text-gray-600 flex justify-between items-center">
                                    <span>{getSocioInfo(formData.veh_id).nombre}</span>
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">{getSocioInfo(formData.veh_id).tipo}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cubicaje (m³)</label>
                                <input
                                    value={formData.ext_cubicaje || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, ext_cubicaje: parseFloat(e.target.value) });
                                        if (formErrors.ext_cubicaje) setFormErrors({ ...formErrors, ext_cubicaje: '' });
                                    }}
                                    type="number" step="0.5"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white font-bold group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.ext_cubicaje ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="0.00"
                                />
                                {formErrors.ext_cubicaje && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.ext_cubicaje}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Material Transportado</label>
                                <select
                                    value={formData.mat_id || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, mat_id: parseInt(e.target.value) });
                                        if (formErrors.mat_id) setFormErrors({ ...formErrors, mat_id: '' });
                                    }}
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed ${formErrors.mat_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                >
                                    <option value="">Seleccione...</option>
                                    {materiales.map(m => (
                                        <option key={m.mat_id} value={m.mat_id}>{m.mat_nombre}</option>
                                    ))}
                                </select>
                                {formErrors.mat_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.mat_id}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Origen del Material <span className="text-red-500"></span></label>
                                <select
                                    value={formData.lug_origen_id || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, lug_origen_id: parseInt(e.target.value) });
                                        if (formErrors.lug_origen_id) setFormErrors({ ...formErrors, lug_origen_id: '' });
                                    }}
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed ${formErrors.lug_origen_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                >
                                    <option value="">Seleccione origen...</option>
                                    {lugares.map(l => (
                                        <option key={l.lug_id} value={l.lug_id}>{l.lug_nombre}</option>
                                    ))}
                                </select>
                                {formErrors.lug_origen_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.lug_origen_id}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Precio Acordado ($)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input
                                        value={formData.ext_precio || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, ext_precio: parseFloat(e.target.value) });
                                            if (formErrors.ext_precio) setFormErrors({ ...formErrors, ext_precio: '' });
                                        }}
                                        type="number" step="0.01"
                                        className={`w-full border rounded-2xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white font-bold group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.ext_precio ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                        placeholder="0.00"
                                    />
                                </div>
                                {formErrors.ext_precio && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.ext_precio}</p>}
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Detalle</label>
                                <textarea
                                    value={formData.ext_detalle || ''}
                                    onChange={e => setFormData({ ...formData, ext_detalle: e.target.value })}
                                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white resize-none group-disabled:bg-gray-100/50 group-disabled:text-gray-500"
                                    placeholder="Trabajo urgente, movilización de equipo..."
                                    rows={2}
                                />
                            </div>
                            {modalMode !== 'create' && (
                                <div className="space-y-2 sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estado del Extra</label>
                                    <select value={formData.ext_estado || 'completado'} onChange={e => setFormData({ ...formData, ext_estado: e.target.value as any })} className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed">
                                        <option value="completado">Completado</option>
                                        <option value="anulado">Anulado</option>
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
                                    <button
                                        onClick={handleSave}
                                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                    >
                                        {modalMode === 'create' ? 'Registrar Extra' : 'Guardar Cambios'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </Modal>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando extras...</div>
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
                                                checked={rows.length > 0 && selectedExtras.length === rows.length}
                                            />
                                        </th>
                                        <th className="text-left px-3 py-3 w-[90px]">N° Extra</th>
                                        <th className="text-left px-2 py-3 w-[80px]">Fecha</th>
                                        <th className="text-left px-2 py-3 w-[80px]">Máquina</th>
                                        <th className="text-left px-2 py-3 w-[120px]">Propietario</th>
                                        <th className="text-left px-2 py-3 w-[50px]">m³</th>
                                        <th className="text-left px-2 py-3 w-[110px]">Material</th>
                                        <th className="text-left px-2 py-3 w-[100px]">Detalle</th>
                                        <th className="text-left px-2 py-3 w-[90px]">Origen</th>
                                        <th className="text-left px-2 py-3 w-[70px]">Precio</th>
                                        <th className="text-left px-2 py-3 w-[100px]">Estado</th>
                                        <th className="text-center px-2 py-3 w-[90px]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={12} className="text-center py-8 text-gray-500">No se encontraron extras registrados</td></tr>
                                    ) : rows.map(c => {
                                        const StatusIcon = ICON[c.ext_estado] || CheckCircle;
                                        const propietario = c.vehiculo?.transportista ? `${c.vehiculo.transportista.tra_nombre} ${c.vehiculo.transportista.tra_apellido}` : '—';
                                        return (
                                            <tr key={c.ext_id} className={`transition-colors ${selectedExtras.includes(c.ext_id) ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'}`}>
                                                <td className="px-3 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        checked={selectedExtras.includes(c.ext_id)}
                                                        onChange={() => handleSelectExtra(c.ext_id)}
                                                    />
                                                </td>
                                                <td className="px-3 py-3 font-mono font-semibold text-gray-900 text-xs">{c.ext_numero}</td>
                                                <td className="px-2 py-3 text-gray-500 text-xs">{c.ext_fecha}</td>
                                                <td className="px-2 py-3 font-mono text-gray-500 text-xs">{c.vehiculo?.veh_placa || '—'}</td>
                                                <td className="px-2 py-3 text-gray-800 font-medium text-xs truncate" title={propietario}>{propietario}</td>
                                                <td className="px-2 py-3 text-gray-700 font-semibold text-xs">{c.ext_cubicaje}</td>
                                                <td className="px-2 py-3 text-gray-600 text-xs truncate" title={c.material?.mat_nombre}>{c.material?.mat_nombre || '—'}</td>
                                                <td className="px-2 py-3 text-gray-500 text-xs truncate" title={c.ext_detalle}>{c.ext_detalle || '—'}</td>
                                                <td className="px-2 py-3 text-gray-500 text-xs truncate" title={c.origen?.lug_nombre}>{c.origen?.lug_nombre || '—'}</td>
                                                <td className="px-2 py-3 text-gray-700 font-semibold text-xs">${c.ext_precio.toFixed(2)}</td>
                                                <td className="px-2 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${BADGE[c.ext_estado] || 'bg-gray-100 text-gray-700'}`}>
                                                        <StatusIcon size={10} /><span className="capitalize">{c.ext_estado}</span>
                                                    </span>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <button onClick={() => handleOpenModal('view', c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver"><Eye size={13} /></button>
                                                        <button onClick={() => handleOpenModal('edit', c)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit size={13} /></button>
                                                        {!isDespachador && <button onClick={() => handleDelete(c.ext_id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={13} /></button>}
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
