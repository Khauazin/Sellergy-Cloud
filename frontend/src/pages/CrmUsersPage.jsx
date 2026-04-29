import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Shield, User, Mail, Loader2, Edit2, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';
import { useAuthStore } from '../store/auth.store';

const MODULOS_SISTEMA = [
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'catalogo', label: 'Catálogo / Produtos' },
  { id: 'crm', label: 'CRM / Leads' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'agendamentos', label: 'Agenda' },
];

const PERMISSOES_PADRAO = {
  financeiro: { visualizar: false, salvar: false, alterar: false, deletar: false, cancelar_lancamento: false },
  estoque: { visualizar: false, salvar: false, alterar: false, deletar: false },
  catalogo: { visualizar: false, salvar: false, alterar: false, deletar: false },
  crm: { visualizar: false, salvar: false, alterar: false, deletar: false },
  vendas: { visualizar: false, salvar: false, alterar: false, deletar: false },
  agendamentos: { visualizar: false, salvar: false, alterar: false, deletar: false },
};

export default function CrmUsersPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduloAtivo, setModuloAtivo] = useState('financeiro');

  const currentUser = useAuthStore(state => state.user);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '', email: '', senha: '', perfil: 'CLIENT', permissoes: { ...PERMISSOES_PADRAO }
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      const response = await api.get('/crm/usuarios');
      setUsuarios(response.data);
    } catch (error) {
      console.error('Erro ao carregar usuários', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePermission = (modulo, acao) => {
    setFormData(prev => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [modulo]: {
          ...prev.permissoes[modulo],
          [acao]: !prev.permissoes[modulo][acao]
        }
      }
    }));
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        const payload = { ...formData };
        if (!payload.senha) delete payload.senha;
        const response = await api.put(`/crm/usuarios/${editingId}`, payload);
        setUsuarios(usuarios.map(u => u.id === editingId ? response.data : u));
      } else {
        const response = await api.post('/crm/usuarios', formData);
        setUsuarios([response.data, ...usuarios]);
      }
      setIsModalOpen(false);
      setFormData({ nome: '', email: '', senha: '', perfil: 'CLIENT', permissoes: { ...PERMISSOES_PADRAO } });
      setEditingId(null);
    } catch (error) {
      console.error('Erro ao salvar usuário', error);
      alert(error.response?.data?.error || 'Erro ao salvar usuário.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        await api.delete(`/crm/usuarios/${id}`);
        setUsuarios(usuarios.filter(u => u.id !== id));
      } catch (error) {
        alert('Erro ao excluir usuário.');
      }
    }
  };

  const filteredUsers = usuarios.filter(u =>
    (u.nome && u.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Usuários do Sistema</h2>
          <p className="text-gray-400 text-sm">Gerencie sua equipe e permissões de acesso</p>
        </div>
        <button
          onClick={() => {
            setFormData({ nome: '', email: '', senha: '', perfil: 'CLIENT', permissoes: { ...PERMISSOES_PADRAO } });
            setEditingId(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 p-2 rounded-2xl flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-white/5 text-white rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-20 text-gray-500">Carregando...</div>
        ) : filteredUsers.map(user => (
          <div key={user.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all relative group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">
                {user.nome?.charAt(0).toUpperCase()}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setFormData({
                      nome: user.nome,
                      email: user.email,
                      senha: '',
                      perfil: user.perfil,
                      permissoes: user.permissoes || { ...PERMISSOES_PADRAO }
                    });
                    setEditingId(user.id);
                    setIsModalOpen(true);
                  }}
                  className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteUser(user.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="text-white font-semibold">{user.nome}</h3>
            <p className="text-gray-400 text-sm truncate">{user.email}</p>
            <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
              {user.permissoes && typeof user.permissoes === 'object' ? Object.keys(user.permissoes).map(mod => (
                user.permissoes[mod]?.visualizar && (
                  <span key={mod} className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                    {mod}
                  </span>
                )
              )) : (
                <span className="text-[10px] text-gray-600 italic">Sem permissões configuradas</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Usuário" : "Novo Usuário"}>
        <form onSubmit={handleSaveUser} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
          {/* Dados Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Nome</label>
              <input
                required
                value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">E-mail</label>
              <input
                required type="email"
                value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Senha</label>
              <input
                required={!editingId} type="password"
                value={formData.senha} onChange={e => setFormData({ ...formData, senha: e.target.value })}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
                placeholder={editingId ? "Vazio para manter" : "••••••"}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Tipo de Perfil</label>
              <select
                value={formData.perfil} onChange={e => setFormData({ ...formData, perfil: e.target.value })}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
              >
                <option value="CLIENT">Operador CRM</option>
                <option value="ADMIN">Gerente Cliente</option>
              </select>
            </div>
          </div>

          {/* Seção de Permissões */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-blue-400 uppercase tracking-widest">Configurar Permissões</label>
              <div className="relative">
                <select
                  value={moduloAtivo}
                  onChange={(e) => setModuloAtivo(e.target.value)}
                  className="bg-black/60 border border-white/10 text-white rounded-lg py-1 pl-3 pr-8 text-xs font-medium focus:outline-none appearance-none"
                >
                  {MODULOS_SISTEMA.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-3">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Ações de Escrita</span>
                
                {[
                  { id: 'visualizar', label: 'Visualizar Módulo' },
                  { id: 'salvar', label: 'Salvar / Criar' },
                  { id: 'alterar', label: 'Alterar / Editar' },
                  { id: 'deletar', label: 'Deletar {}' },
                ].map(acao => (
                  <label key={acao.id} className="flex items-center justify-between group cursor-pointer">
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{acao.label}</span>
                    <button
                      type="button"
                      onClick={() => handleTogglePermission(moduloAtivo, acao.id)}
                      className={`p-1 rounded-md transition-colors ${formData.permissoes[moduloAtivo][acao.id] ? 'text-blue-400 bg-blue-400/10' : 'text-gray-600 bg-white/5'}`}
                    >
                      {formData.permissoes[moduloAtivo][acao.id] ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </button>
                  </label>
                ))}
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-3">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Opções Específicas</span>
                
                {moduloAtivo === 'financeiro' && (
                  <label className="flex items-center justify-between group cursor-pointer">
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Lançar cancelamento</span>
                    <button
                      type="button"
                      onClick={() => handleTogglePermission('financeiro', 'cancelar_lancamento')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${formData.permissoes.financeiro.cancelar_lancamento ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}
                    >
                      {formData.permissoes.financeiro.cancelar_lancamento ? 'SIM' : 'NÃO'}
                    </button>
                  </label>
                )}

                {moduloAtivo === 'estoque' && (
                  <label className="flex items-center justify-between group cursor-pointer">
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Ajuste de Saldo</span>
                    <button
                      type="button"
                      onClick={() => handleTogglePermission('estoque', 'ajuste')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${formData.permissoes.estoque?.ajuste ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}
                    >
                      {formData.permissoes.estoque?.ajuste ? 'SIM' : 'NÃO'}
                    </button>
                  </label>
                )}

                {/* Placeholder para outros módulos */}
                {!['financeiro', 'estoque'].includes(moduloAtivo) && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-600 italic text-xs">
                    Sem opções extras para este módulo.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-400 font-bold text-xs uppercase hover:bg-white/5 rounded-xl transition-all">Cancelar</button>
            <button type="submit" disabled={isSaving} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Salvar Alterações' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
