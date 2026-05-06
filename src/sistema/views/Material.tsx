import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Search } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';
import { Material } from '../types';

export default function Materiales() {
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<Partial<Material>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchMateriales();
    }, []);

    const fetchMateriales = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('material').select('*').order('mat_id', { ascending: true });
        if (error) {
            console.error('Error fetching materiales:', error);
        } else {
            setMateriales((data as Material[]) || []);
        }
        setLoading(false);
    };

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', material?: Material) => {
        setFormErrors({});
        setModalMode(mode);
        if (material) setFormData(material);
        else setFormData({ mat_unidad: 'm³', mat_categoria: 'Pétreos' });
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Está seguro de eliminar este material?')) {
            const { error } = await supabase.from('material').delete().eq('mat_id', id);
            if (error) {
                alert('Error al eliminar: ' + error.message);
            } else {
                fetchMateriales();
            }
        }
    };

    const handleSave = async () => {
        const errors: Record<string, string> = {};

        if (!formData.mat_nombre) errors.mat_nombre = 'Este campo es obligatorio';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        if (modalMode === 'create') {
            const { error } = await supabase.from('material').insert([{
                mat_nombre: formData.mat_nombre,
                mat_unidad: formData.mat_unidad || 'm³',
                mat_categoria: formData.mat_categoria || 'Pétreos'
            }]);

            if (error) alert('Error al crear: ' + error.message);
            else {
                setShowForm(false);
                fetchMateriales();
            }
        } else {
            const { error } = await supabase.from('material').update({
                mat_nombre: formData.mat_nombre,
                mat_unidad: formData.mat_unidad,
                mat_categoria: formData.mat_categoria
            }).eq('mat_id', formData.mat_id);

            if (error) alert('Error al actualizar: ' + error.message);
            else {
                setShowForm(false);
                fetchMateriales();
            }
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="space-y-5">
                {/* Herramientas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex justify-between items-center gap-4">
                    {/* Búsqueda */}
                    <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2 flex-1 max-w-md">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            className="bg-transparent text-sm text-gray-700 outline-none w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal('create')}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95 ripple-effect"
                    >
                        <Plus size={18} /> Nuevo Material
                    </button>
                </div>

                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={modalMode === 'create' ? "Registrar Nuevo Material" : modalMode === 'edit' ? "Editar Material" : "Detalles del Material"}
                    maxWidth="sm"
                >
                    <div className="space-y-6">
                        <fieldset disabled={modalMode === 'view'} className="space-y-5 group">
                            <div className="flex items-start gap-4">
                                <div className="w-[180px] space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Nombre del Material <span className="text-red-500"></span></label>
                                    <input value={formData.mat_nombre || ''} onChange={e => {
                                        setFormData({ ...formData, mat_nombre: e.target.value });
                                        if (formErrors.mat_nombre) setFormErrors({ ...formErrors, mat_nombre: '' });
                                    }} type="text" className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.mat_nombre ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`} placeholder="Ej. Arena fina, Ripio, Lastre" />
                                    {formErrors.mat_nombre && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.mat_nombre}</p>}
                                </div>
                                <div className="w-[140px] space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Unidad de Medida</label>
                                    <input value={formData.mat_unidad || 'm³'} onChange={e => setFormData({ ...formData, mat_unidad: e.target.value })} type="text" className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-gray-50/50 hover:bg-white font-bold text-indigo-600" />
                                </div>
                            </div>

                            <div className="space-y-2 sm:col-span-3">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Categoría Sugerida</label>
                                <div className="flex gap-2">
                                    {['Pétreos', 'Varios'].map(cat => (
                                        <button onClick={() => setFormData({ ...formData, mat_categoria: cat })} key={cat} className={`px-3 py-2 text-[10px] font-bold rounded-xl transition-all uppercase tracking-wider ${formData.mat_categoria === cat ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{cat}</button>
                                    ))}
                                </div>
                            </div>
                        </fieldset>

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
                                        {modalMode === 'create' ? 'Guardar Material' : 'Guardar Cambios'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </Modal>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando materiales...</div>
                    ) : (
                        <div className="overflow-x-auto table-responsive">
                            <table className="w-full text-sm table-fixed min-w-[600px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                    <th className="text-left px-4 py-3 w-[80px]">ID</th>
                                    <th className="text-left px-3 py-3">Nombre del Material</th>
                                    <th className="text-center px-3 py-3 w-[120px]">Unidad</th>
                                    <th className="text-center px-3 py-3 w-[90px]">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {materiales.filter(m => m.mat_nombre.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">No hay materiales registrados o que coincidan con la búsqueda</td></tr>
                                ) : materiales.filter(m => m.mat_nombre.toLowerCase().includes(searchTerm.toLowerCase())).map((m, idx) => {
                                    const colors = [
                                        'bg-emerald-100 text-emerald-700',
                                        'bg-red-100 text-red-700',
                                        'bg-amber-100 text-amber-700',
                                    ][idx % 3];

                                    return (
                                        <tr key={m.mat_id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${colors} font-bold text-xs`}>
                                                    {m.mat_id}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="font-bold text-gray-800 text-sm">{m.mat_nombre}</span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                                    {m.mat_unidad}
                                                </span>
                                            </td>

                                            <td className="px-3 py-3 text-center">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button
                                                        onClick={() => handleOpenModal('view', m)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Ver"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenModal('edit', m)}
                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(m.mat_id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
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
