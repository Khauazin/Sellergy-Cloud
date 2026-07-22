import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, MoreHorizontal, Mail, ShieldCheck, Crown } from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, IconButton, Input, Avatar, Badge, EmptyState, SearchBar,
  Dropdown, DropdownItem, DropdownDivider, useToast
} from '../components/ui';
import Modal from '../components/Modal';

export default function UsersPage() {
  const toast = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState({ open: false, data: null });

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/usuarios');
      setUsuarios(r.data || []);
    } finally {
      setCarregando(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [usuarios, busca]);

  const handleSalvar = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/usuarios/${dados.id}`, dados);
        toast.success('Administrador atualizado');
      } else {
        await api.post('/usuarios', dados);
        toast.success('Administrador criado');
      }
      setModal({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    }
  };

  const handleExcluir = async (u) => {
    if (!confirm(`Excluir admin "${u.nome}"?`)) return;
    try {
      await api.delete(`/usuarios/${u.id}`);
      toast.success('Excluido');
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-5">
      <Card padding="lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0">
            <Crown size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)]">Administradores do sistema</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
              Pessoas com acesso total ao painel administrativo. Veem todos os clientes,
              bots, alertas. Diferente da equipe do tenant (cada cliente gerencia a propria
              equipe dentro do CRM).
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." />
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>Novo administrador</Button>
      </div>

      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtrados.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={ShieldCheck}
            title={usuarios.length === 0 ? 'Apenas voce' : 'Sem resultados'}
            description={usuarios.length === 0 ? 'Cadastre outros administradores se quiser delegar acesso ao painel.' : null}
            action={usuarios.length === 0 && (
              <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>Novo administrador</Button>
            )}
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-[var(--border-subtle)]">
            {filtrados.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                <Avatar name={u.nome} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{u.nome}</span>
                    <Badge variant="neutral" size="sm" icon={Crown}>Administrador</Badge>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                    <Mail size={11} /> {u.email}
                  </div>
                </div>
                <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}>
                  <DropdownItem icon={Edit2} onClick={() => setModal({ open: true, data: u })}>Editar</DropdownItem>
                  <DropdownDivider />
                  <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluir(u)}>Excluir</DropdownItem>
                </Dropdown>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ModalAdmin
        isOpen={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        admin={modal.data}
        onSalvar={handleSalvar}
      />
    </div>
  );
}

function ModalAdmin({ isOpen, onClose, admin, onSalvar }) {
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });

  useEffect(() => {
    if (admin) setForm({ nome: admin.nome, email: admin.email, senha: '' });
    else setForm({ nome: '', email: '', senha: '' });
  }, [admin, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!admin && !form.senha) {
      alert('Senha eh obrigatoria para novo admin');
      return;
    }
    const payload = { nome: form.nome, email: form.email };
    if (form.senha) payload.senha = form.senha;
    if (admin?.id) payload.id = admin.id;
    onSalvar(payload);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={admin ? 'Editar administrador' : 'Novo administrador'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
        <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <Input
          label={admin ? 'Nova senha (opcional)' : 'Senha'}
          type="password"
          value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
          placeholder={admin ? 'Deixe em branco para manter' : 'Minimo 6 caracteres'}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{admin ? 'Salvar' : 'Criar'}</Button>
        </div>
      </form>
    </Modal>
  );
}
