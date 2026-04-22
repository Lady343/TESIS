import { useState, useEffect } from 'react';
import Header from '../layout/Header';
import { Plus, Search, Truck, Edit, Trash2, Eye } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';
import { Vehiculo, Transportista } from '../types';

export default function Volquetas() {
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<Partial<Vehiculo>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [volquetas, setVolquetas] = useState<Vehiculo[]>([]);
    const [transportistas, setTransportistas] = useState<Transportista[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchVehiculos();
        fetchTransportistas();
    }, []);

    const fetchVehiculos = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('vehiculo')
            .select(`
                *,
                transportista:tra_id (
                    tra_nombre,
                    tra_apellido,
                    tra_tipo
                )
            `)
            .order('veh_id', { ascending: false });

        if (error) console.error('Error fetching vehiculos:', error);
        else setVolquetas((data as any[]) || []);

        setLoading(false);
    };

    const fetchTransportistas = async () => {
        const { data, error } = await supabase
            .from('transportista')
            .select('*')
            .eq('tra_estado', 'activo')
            .order('tra_nombre');

        if (error) console.error('Error fetching transportistas:', error);
        else setTransportistas((data as Transportista[]) || []);
    };

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', volqueta?: Vehiculo) => {
        setFormErrors({});
        setModalMode(mode);
        if (volqueta) {
            setFormData(volqueta);
        } else {
            setFormData({ veh_estado: 'activa' });
        }
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Está seguro de eliminar este vehículo?')) {
            const { error } = await supabase.from('vehiculo').delete().eq('veh_id', id);
            if (error) alert('Error al eliminar: ' + error.message);
            else fetchVehiculos();
        }
    };

    const handleSave = async () => {
        const errors: Record<string, string> = {};

        if (!formData.veh_placa) errors.veh_placa = 'Este campo es obligatorio';
        if (!formData.veh_marca) errors.veh_marca = 'Este campo es obligatorio';
        if (!formData.veh_cubicaje) errors.veh_cubicaje = 'Este campo es obligatorio';
        if (!formData.veh_estado) errors.veh_estado = 'Este campo es obligatorio';
        if (!formData.tra_id) errors.tra_id = 'Debe seleccionar un propietario/transportista';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        const payload = {
            veh_placa: formData.veh_placa,
            veh_marca: formData.veh_marca || null,
            veh_cubicaje: formData.veh_cubicaje,
            veh_estado: formData.veh_estado || 'activa',
            tra_id: formData.tra_id
        };

        if (modalMode === 'create') {
            const { error } = await supabase.from('vehiculo').insert([payload]);
            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchVehiculos();
            }
        } else {
            const { error } = await supabase.from('vehiculo').update(payload).eq('veh_id', formData.veh_id);
            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchVehiculos();
            }
        }
    };

    const rows = volquetas.filter(v => {
        const trName = v.transportista ? `${v.transportista.tra_nombre} ${v.transportista.tra_apellido}` : '';
        return `${v.veh_placa} ${v.veh_marca} ${trName}`.toLowerCase().includes(search.toLowerCase());
    });

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Vehículos de Transporte" subtitle="Gestión de flota vehicular de la cooperativa y particulares" />

            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
                {/* Resumen */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Flota', value: volquetas.length, icon: Truck, bg: 'bg-amber-50', color: 'text-amber-600' },
                        { label: 'Activos', value: volquetas.filter(v => v.veh_estado === 'activa').length, icon: Truck, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                        { label: 'Inactivos', value: volquetas.filter(v => v.veh_estado === 'inactiva').length, icon: Truck, bg: 'bg-red-50', color: 'text-red-500' },
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
                            placeholder="Buscar por placa, marca o propietario…"
                            className="bg-transparent text-sm text-gray-700 outline-none w-full"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal('create')}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95 ripple-effect"
                    >
                        <Plus size={18} /> Nueva Unidad
                    </button>
                </div>

                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={modalMode === 'create' ? "Registrar Nueva Unidad" : modalMode === 'edit' ? "Editar Unidad" : "Detalles de la Unidad"}
                    maxWidth="md"
                >
                    <fieldset disabled={modalMode === 'view'} className="space-y-6 group">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Placa del Vehículo</label>
                                <input
                                    value={formData.veh_placa || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, veh_placa: e.target.value });
                                        if (formErrors.veh_placa) setFormErrors({});
                                    }}
                                    type="text"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white font-mono font-bold uppercase group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.veh_placa ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10 text-red-900' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10 text-gray-900'}`}
                                    placeholder="ABC-1234"
                                />
                                {formErrors.veh_placa && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.veh_placa}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Marca / Fabricante <span className="text-red-500"></span></label>
                                <input
                                    value={formData.veh_marca || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, veh_marca: e.target.value });
                                        if (formErrors.veh_marca) setFormErrors({ ...formErrors, veh_marca: '' });
                                    }}
                                    type="text"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.veh_marca ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10 text-red-900' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10 text-gray-900'}`}
                                    placeholder="Ej. Hino, Chevrolet"
                                />
                                {formErrors.veh_marca && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.veh_marca}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cubicaje (m³)</label>
                                <input
                                    value={formData.veh_cubicaje || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, veh_cubicaje: parseFloat(e.target.value) });
                                        if (formErrors.veh_cubicaje) setFormErrors({ ...formErrors, veh_cubicaje: '' });
                                    }}
                                    type="number"
                                    step="0.01"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white font-bold group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.veh_cubicaje ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="0.0"
                                />
                                {formErrors.veh_cubicaje && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.veh_cubicaje}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Propietario / Transportista <span className="text-red-500"></span></label>
                                <select
                                    value={formData.tra_id || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, tra_id: e.target.value ? parseInt(e.target.value) : undefined });
                                        if (formErrors.tra_id) setFormErrors({ ...formErrors, tra_id: '' });
                                    }}
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer group-disabled:bg-gray-100/50 group-disabled:text-gray-500 group-disabled:cursor-not-allowed ${formErrors.tra_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                >
                                    <option value="">-- Seleccione un propietario --</option>
                                    {transportistas.map(t => (
                                        <option key={t.tra_id} value={t.tra_id}>
                                            {t.tra_nombre} {t.tra_apellido} ({t.tra_tipo})
                                        </option>
                                    ))}
                                </select>
                                {formErrors.tra_id && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tra_id}</p>}
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estado de Vehículo</label>
                                <select
                                    value={formData.veh_estado || 'activa'}
                                    onChange={e => setFormData({ ...formData, veh_estado: e.target.value as any })}
                                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer font-bold group-disabled:bg-gray-100/50 group-disabled:text-gray-500"
                                >
                                    <option value="activa">ACTIVA</option>
                                    <option value="inactiva">INACTIVA</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-5 border-t border-gray-100">
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
                                        {modalMode === 'create' ? 'Guardar Unidad' : 'Guardar Cambios'}
                                    </button>
                                </>
                            )}
                        </div>
                    </fieldset>
                </Modal>

                {/* Tabla */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando vehículos...</div>
                    ) : (
                        <div className="overflow-x-auto table-responsive">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        <th className="text-left px-5 py-3">Placa</th>
                                        <th className="text-left px-4 py-3">Marca</th>
                                        <th className="text-left px-4 py-3">Cubicaje (m³)</th>
                                        <th className="text-left px-4 py-3">Propietario</th>
                                        <th className="text-left px-4 py-3">Estado</th>
                                        <th className="text-center px-2 py-3 w-[90px]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-500">No se encontraron vehículos registrados</td></tr>
                                    ) : rows.map(v => (
                                        <tr key={v.veh_id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-5 py-3 font-mono font-bold text-gray-900">{v.veh_placa}</td>
                                            <td className="px-4 py-3 text-gray-600">{v.veh_marca || '—'}</td>
                                            <td className="px-4 py-3 text-gray-700 font-semibold">{v.veh_cubicaje} m³</td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {v.transportista ? `${v.transportista.tra_nombre} ${v.transportista.tra_apellido}` : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${v.veh_estado === 'activa' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                    {v.veh_estado}
                                                </span>
                                            </td>
                                            <td className="px-2 py-3 text-center">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button onClick={() => handleOpenModal('view', v)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver"><Eye size={13} /></button>
                                                    <button onClick={() => handleOpenModal('edit', v)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit size={13} /></button>
                                                    <button onClick={() => handleDelete(v.veh_id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={13} /></button>
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
        </div>
    );
}
