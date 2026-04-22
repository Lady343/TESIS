import { useState, useEffect } from 'react';
import Header from '../layout/Header';
import { Plus, Search, Edit, Trash2, UserCheck, User, Eye, Filter, Phone, Mail } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';
import { Transportista } from '../types';
import { useUser } from '../UserContext';

export default function TransportistaView() {
    const { isDespachador } = useUser();
    const [search, setSearch] = useState('');
    const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'socio' | 'particular'>('todos');
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<Partial<Transportista>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [transportistas, setTransportistas] = useState<Transportista[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTransportistas();
    }, []);

    const fetchTransportistas = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('transportista')
            .select('*')
            .order('tra_id', { ascending: false });

        if (error) console.error('Error fetching transportistas:', error);
        else setTransportistas((data as Transportista[]) || []);

        setLoading(false);
    };

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', t?: Transportista) => {
        setFormErrors({});
        setModalMode(mode);
        if (t) setFormData(t);
        else setFormData({ tra_estado: 'activo', tra_tipo: 'socio' });
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Está seguro de eliminar este transportista?')) {
            const { error } = await supabase.from('transportista').delete().eq('tra_id', id);
            if (error) alert('Error: ' + error.message);
            else fetchTransportistas();
        }
    };

    const handleSave = async () => {
        const errors: Record<string, string> = {};

        if (!formData.tra_nombre) errors.tra_nombre = 'Este campo es obligatorio';
        if (!formData.tra_apellido) errors.tra_apellido = 'Este campo es obligatorio';
        if (!formData.tra_telefono) errors.tra_telefono = 'Este campo es obligatorio';
        if (!formData.tra_correo) errors.tra_correo = 'Este campo es obligatorio';
        if (!formData.tra_tipo) errors.tra_tipo = 'Este campo es obligatorio';
        if (!formData.tra_estado) errors.tra_estado = 'Este campo es obligatorio';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        if (modalMode === 'create') {
            const { error } = await supabase.from('transportista').insert([{
                tra_nombre: formData.tra_nombre,
                tra_apellido: formData.tra_apellido,
                tra_tipo: formData.tra_tipo,
                tra_estado: formData.tra_estado || 'activo',
                tra_telefono: formData.tra_telefono || null,
                tra_correo: formData.tra_correo || null,
            }]);

            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchTransportistas();
            }
        } else {
            const { error } = await supabase.from('transportista').update({
                tra_nombre: formData.tra_nombre,
                tra_apellido: formData.tra_apellido,
                tra_tipo: formData.tra_tipo,
                tra_estado: formData.tra_estado,
                tra_telefono: formData.tra_telefono || null,
                tra_correo: formData.tra_correo || null,
            }).eq('tra_id', formData.tra_id);

            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchTransportistas();
            }
        }
    };

    const rows = transportistas.filter(s => {
        const matchName = `${s.tra_nombre} ${s.tra_apellido}`.toLowerCase().includes(search.toLowerCase());
        const matchType = tipoFiltro === 'todos' || s.tra_tipo === tipoFiltro;
        return matchName && matchType;
    });

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Transportistas" subtitle="Gestión de socios y particulares" />

            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
                {/* Resumen */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Registros', value: transportistas.length, icon: UserCheck, bg: 'bg-gray-100', color: 'text-gray-600' },
                        { label: 'Socios', value: transportistas.filter(s => s.tra_tipo === 'socio').length, icon: UserCheck, bg: 'bg-amber-50', color: 'text-amber-600' },
                        { label: 'Particulares', value: transportistas.filter(s => s.tra_tipo === 'particular').length, icon: User, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                        { label: 'Inactivos', value: transportistas.filter(s => s.tra_estado === 'inactivo').length, icon: User, bg: 'bg-red-50', color: 'text-red-500' },
                    ].map((c) => {
                        const Icon = c.icon;
                        return (
                            <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover-card-premium">
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
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2 flex-1 max-w-md">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre…"
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
                        {['todos', 'socio', 'particular'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTipoFiltro(t as any)}
                                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all capitalize ripple-effect ${tipoFiltro === t
                                    ? t === 'todos' ? 'bg-gray-700 text-white shadow-md shadow-gray-200' :
                                        t === 'socio' ? 'bg-amber-500 text-white shadow-md shadow-amber-100' :
                                            'bg-emerald-500 text-white shadow-md shadow-emerald-100'
                                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handleOpenModal('create')}
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95 ripple-effect"
                        >
                            <Plus size={18} /> Nuevo Transportista
                        </button>
                    </div>
                </div>

                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={modalMode === 'create' ? "Registrar Nuevo Transportista" : modalMode === 'edit' ? "Editar Transportista" : "Detalles"}
                    maxWidth="md"
                >
                    <div className="space-y-6">
                        <fieldset disabled={modalMode === 'view'} className="grid grid-cols-1 sm:grid-cols-2 gap-5 group">
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Nombres</label>
                                <input
                                    value={formData.tra_nombre || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, tra_nombre: e.target.value });
                                        if (formErrors.tra_nombre) setFormErrors({});
                                    }}
                                    type="text"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.tra_nombre ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="Ej. Juan Andrés"
                                />
                                {formErrors.tra_nombre && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tra_nombre}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Apellidos</label>
                                <input
                                    value={formData.tra_apellido || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, tra_apellido: e.target.value });
                                        if (formErrors.tra_apellido) setFormErrors({ ...formErrors, tra_apellido: '' });
                                    }}
                                    type="text"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.tra_apellido ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="Ej. Pérez Armijos"
                                />
                                {formErrors.tra_apellido && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tra_apellido}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Teléfono</label>
                                <input
                                    value={formData.tra_telefono || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, tra_telefono: e.target.value });
                                        if (formErrors.tra_telefono) setFormErrors({ ...formErrors, tra_telefono: '' });
                                    }}
                                    type="text"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white group-disabled:bg-gray-100/50 group-disabled:text-gray-500 font-mono ${formErrors.tra_telefono ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="+593987654321"
                                />
                                {formErrors.tra_telefono && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tra_telefono}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Correo Electrónico</label>
                                <input
                                    value={formData.tra_correo || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, tra_correo: e.target.value });
                                        if (formErrors.tra_correo) setFormErrors({ ...formErrors, tra_correo: '' });
                                    }}
                                    type="email"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white group-disabled:bg-gray-100/50 group-disabled:text-gray-500 ${formErrors.tra_correo ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="transportista@gmail.com"
                                />
                                {formErrors.tra_correo && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tra_correo}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tipo de Transportista</label>
                                <select
                                    value={formData.tra_tipo || 'socio'}
                                    onChange={e => {
                                        setFormData({ ...formData, tra_tipo: e.target.value as any });
                                        if (formErrors.tra_tipo) setFormErrors({ ...formErrors, tra_tipo: '' });
                                    }}
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer font-bold ${formErrors.tra_tipo ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                >
                                    <option value="socio">SOCIO</option>
                                    <option value="particular">PARTICULAR</option>
                                </select>
                                {formErrors.tra_tipo && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tra_tipo}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estado</label>
                                <select
                                    value={formData.tra_estado || 'activo'}
                                    onChange={e => {
                                        setFormData({ ...formData, tra_estado: e.target.value as any });
                                        if (formErrors.tra_estado) setFormErrors({ ...formErrors, tra_estado: '' });
                                    }}
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer font-bold ${formErrors.tra_estado ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                >
                                    <option value="activo">ACTIVO</option>
                                    <option value="inactivo">INACTIVO</option>
                                </select>
                                {formErrors.tra_estado && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.tra_estado}</p>}
                            </div>
                        </fieldset>

                        <div className="flex justify-end gap-3 pt-5 border-t border-gray-100 mt-4">
                            <button
                                onClick={() => setShowForm(false)}
                                className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-all border border-gray-200"
                            >
                                {modalMode === 'view' ? 'Cerrar' : 'Cancelar'}
                            </button>
                            {modalMode !== 'view' && (
                                <button onClick={handleSave} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                    {modalMode === 'create' ? 'Guardar' : 'Guardar Cambios'}
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>

                {/* Tabla */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando transportistas...</div>
                    ) : (
                        <div className="overflow-x-auto table-responsive">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        <th className="text-left px-5 py-3 w-[25%]">Nombre</th>
                                        <th className="text-left px-4 py-3 w-[18%]">Teléfono</th>
                                        <th className="text-left px-4 py-3 w-[25%]">Correo Electrónico</th>
                                        <th className="text-left px-4 py-3 w-[12%]">Tipo</th>
                                        <th className="text-left px-4 py-3 w-[12%]">Estado</th>
                                        <th className="text-center px-2 py-3 w-[90px]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-500">No hay registros</td></tr>
                                    ) : rows.map((s, index) => {
                                        const colorPalette = [
                                            'bg-amber-100 text-amber-700',
                                            'bg-emerald-100 text-emerald-700',
                                            'bg-red-100 text-red-700'
                                        ];
                                        const avatarColors = colorPalette[index % 3];
                                        return (
                                            <tr key={s.tra_id} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full ${avatarColors} flex items-center justify-center flex-shrink-0`}>
                                                            <span className="text-xs font-bold">{s.tra_nombre.charAt(0)}</span>
                                                        </div>
                                                        <span className="font-medium text-gray-800">{s.tra_nombre} {s.tra_apellido}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {s.tra_telefono ? (
                                                        <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium font-mono">
                                                            <Phone size={13} className="text-emerald-500" />
                                                            {s.tra_telefono.split('|')[0]}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 italic">No configurado</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {s.tra_correo ? (
                                                        <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                                                            <Mail size={13} className="text-blue-500" />
                                                            {s.tra_correo}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 italic">No configurado</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${s.tra_tipo === 'socio' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                                                        {s.tra_tipo}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase ${s.tra_estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                        {s.tra_estado}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <button onClick={() => handleOpenModal('view', s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver"><Eye size={13} /></button>
                                                        <button onClick={() => handleOpenModal('edit', s)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit size={13} /></button>
                                                        {!isDespachador && <button onClick={() => handleDelete(s.tra_id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={13} /></button>}
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
