import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Search } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';

export default function TiposEquipo() {
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<any>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [maquinas, setMaquinas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchMaquinas();
    }, []);

    const fetchMaquinas = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('maquina_cooperativa')
            .select('*')
            .eq('mac_estado', 'activa')
            .order('mac_id', { ascending: true });
        if (error) console.error('Error fetching maquinas', error);
        else setMaquinas(data || []);
        setLoading(false);
    };

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', maq?: any) => {
        setFormErrors({});
        setModalMode(mode);
        if (maq) setFormData(maq);
        else setFormData({});
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Está seguro de eliminar esta máquina de forma permanente?')) {
            const { error } = await supabase.from('maquina_cooperativa').update({ mac_estado: 'inactiva' }).eq('mac_id', id);
            if (error) alert('Error: ' + error.message);
            else fetchMaquinas();
        }
    };

    const handleSave = async () => {
        const errors: Record<string, string> = {};
        if (!formData.mac_placa) errors.mac_placa = 'El identificador/placa es obligatorio';
        if (!formData.mac_tipo) errors.mac_tipo = 'El tipo de equipo es obligatorio';
        if (!formData.mac_marca) errors.mac_marca = 'La marca es obligatoria';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        const payload = {
            mac_placa: formData.mac_placa,
            mac_tipo: formData.mac_tipo,
            mac_marca: formData.mac_marca,
            mac_modelo: formData.mac_modelo || null,
        };

        if (modalMode === 'create') {
            const { error } = await supabase.from('maquina_cooperativa').insert([payload]);
            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchMaquinas();
            }
        } else {
            const { error } = await supabase.from('maquina_cooperativa').update(payload).eq('mac_id', formData.mac_id);
            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchMaquinas();
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
                            placeholder="Buscar por placa..."
                            className="bg-transparent text-sm text-gray-700 outline-none w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal('create')}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95 ripple-effect"
                    >
                        <Plus size={18} /> Nuevo Equipo
                    </button>
                </div>

                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={modalMode === 'create' ? 'Registrar Nuevo Equipo' : modalMode === 'edit' ? 'Editar Equipo' : 'Detalles del Equipo'}
                    maxWidth="md"
                >
                    <div className="space-y-6">
                        <fieldset disabled={modalMode === 'view'} className="space-y-4 group">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2 min-w-0">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Identificador (Placa) <span className="text-red-500"></span></label>
                                    <input
                                        value={formData.mac_placa || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, mac_placa: e.target.value });
                                            if (formErrors.mac_placa) setFormErrors({ ...formErrors, mac_placa: '' });
                                        }}
                                        type="text"
                                        className={`w-full min-w-0 border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.mac_placa ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                        placeholder="Ej. EXC-001"
                                    />
                                    {formErrors.mac_placa && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.mac_placa}</p>}
                                </div>

                                <div className="space-y-2 min-w-0">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tipo de Equipo <span className="text-red-500"></span></label>
                                    <input
                                        value={formData.mac_tipo || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, mac_tipo: e.target.value });
                                            if (formErrors.mac_tipo) setFormErrors({ ...formErrors, mac_tipo: '' });
                                        }}
                                        type="text"
                                        className={`w-full min-w-0 border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.mac_tipo ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                        placeholder="Ej. Excavadora, Cargadora..."
                                    />
                                    {formErrors.mac_tipo && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.mac_tipo}</p>}
                                </div>

                                <div className="space-y-2 min-w-0">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Marca <span className="text-red-500"></span></label>
                                    <input
                                        value={formData.mac_marca || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, mac_marca: e.target.value });
                                            if (formErrors.mac_marca) setFormErrors({ ...formErrors, mac_marca: '' });
                                        }}
                                        type="text"
                                        className={`w-full min-w-0 border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.mac_marca ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                        placeholder="Ej. Caterpillar"
                                    />
                                    {formErrors.mac_marca && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.mac_marca}</p>}
                                </div>

                                <div className="space-y-2 min-w-0">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Modelo (Opcional)</label>
                                    <input
                                        value={formData.mac_modelo || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, mac_modelo: e.target.value });
                                        }}
                                        type="text"
                                        className="w-full min-w-0 border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10"
                                        placeholder="Ej. 320 GC"
                                    />
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
                                    <button
                                        onClick={handleSave}
                                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                    >
                                        {modalMode === 'create' ? 'Guardar Equipo' : 'Guardar Cambios'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </Modal>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando equipos...</div>
                    ) : (
                        <div className="overflow-x-auto table-responsive">
                            <table className="w-full text-sm table-fixed min-w-[700px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                    <th className="text-left px-4 py-3 w-[80px]">ID</th>
                                    <th className="text-left px-3 py-3 w-[250px]">Identificador</th>
                                    <th className="text-left px-3 py-3">Tipo de Equipo</th>
                                    <th className="text-left px-3 py-3">Marca / Modelo</th>
                                    <th className="text-center px-3 py-3 w-[90px]">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {maquinas.filter(m => m.mac_placa.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">No hay equipos registrados o que coincidan con la búsqueda</td></tr>
                                ) : maquinas.filter(m => m.mac_placa.toLowerCase().includes(searchTerm.toLowerCase())).map((t, idx) => {
                                    const colors = [
                                        'bg-emerald-100 text-emerald-700',
                                        'bg-red-100 text-red-700',
                                        'bg-amber-100 text-amber-700',
                                    ][idx % 3];

                                    return (
                                        <tr key={t.mac_id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${colors} font-bold text-xs`}>
                                                    {t.mac_id}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="font-bold text-gray-800 text-sm">{t.mac_placa}</span>
                                            </td>
                                            <td className="px-3 py-3 text-gray-600 font-medium">
                                                {t.mac_tipo}
                                            </td>
                                            <td className="px-3 py-3 text-gray-600">
                                                {t.mac_marca} {t.mac_modelo ? `(${t.mac_modelo})` : ''}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button
                                                        onClick={() => handleOpenModal('view', t)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Ver"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenModal('edit', t)}
                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(t.mac_id)}
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
