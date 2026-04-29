const prisma = require('../prisma');
const crypto = require('crypto');

const CAMPOS_OBRIGATORIOS_LANCAMENTO = ['descricao', 'valor', 'tipo', 'dataVencimento',];
const TIPOS_VALIDOS = ['RECEITA', 'DESPESA'];
const STATUS_VALIDOS_LANCAMENTO = ['PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO'];

function validarCampos(corpo, campos) {
    return campos.filter(
        c => corpo[c] === undefined || corpo[c] === null || corpo[c] === ''
    );
}

async function buscarLancamentoDoCliente(id, clientId) {
    const lancamento = await prisma.lancamentoFinanceiro.findUnique({
        where: { id }
    })
    if (!lancamento) return null;
    if (lancamento.clientId !== clientId) return null;
    return lancamento;
}

class FinanceiroController {

    // Lançamentos
    async listarLancamentos(req, res) {
        try {
            const { clientId } = req.usuario;
            const { tipo, status, inicio, fim, pagina = 1, limite = 50, buscar } = req.query;

            const paginaNum = Math.max(1, parseInt(pagina))
            const limiteNum = Math.min(100, Math.max(1, parseInt(limite)))

            const onde = {
                clientId: clientId,
                tipo: tipo || undefined,
                status: status || undefined,
                descricao: buscar ? {
                    contains: buscar,
                    mode: 'insensitive'
                } : undefined,
                dataVencimento: {
                    gte: inicio ? new Date(inicio) : undefined,
                    lte: fim ? new Date(fim) : undefined
                }
            }

            const [lancamentos, total] = await prisma.$transaction([
                prisma.lancamentoFinanceiro.findMany({
                    where: onde,
                    include: {
                        categoria: true,
                        lead: { select: { name: true } },
                        venda: true
                    },
                    orderBy: { dataVencimento: 'desc' },
                    skip: (paginaNum - 1) * limiteNum,
                    take: limiteNum
                }),
                prisma.lancamentoFinanceiro.count({
                    where: onde
                })
            ]);

            const dadosComAtrasoVirtual = lancamentos.map(l => ({
                ...l,
                estaAtrasado: l.status === 'PENDENTE' && new Date(l.dataVencimento) < new Date()
            }));

            res.json({
                dados: dadosComAtrasoVirtual,
                paginacao: {
                    total,
                    pagina: paginaNum,
                    limite: limiteNum,
                    paginas: Math.ceil(total / limiteNum)
                }
            });
        } catch (error) {
            console.error('[listaLancamentos]', error);
            res.status(500).json({ error: 'Erro ao listar lançamentos' });
        }
    }

    async criarLancamento(req, res) {
        try {
            const { clientId } = req.usuario;
            const {
                descricao, valor, tipo, dataVencimento,
                categoriaId, leadId, vendaId, parcelas = 1
            } = req.body;

            let { status, dataPagamento } = req.body;
            status = status || 'PENDENTE';

            const ausentes = validarCampos(req.body, CAMPOS_OBRIGATORIOS_LANCAMENTO);
            if (ausentes.length > 0) {
                return res.status(422).json({
                    error: 'Campos obrigatórios ausentes',
                    campos: ausentes
                });
            }

            if (typeof valor !== 'number' || valor <= 0) {
                return res.status(422).json({
                    error: 'O valor deve ser um número positivo.',
                    campos: ['valor']
                });
            }

            if (!TIPOS_VALIDOS.includes(tipo)) {
                return res.status(422).json({
                    error: 'Tipo inválido. Use RECEITA ou DESPESA',
                    campos: ['tipo']
                });
            }

            if (!STATUS_VALIDOS_LANCAMENTO.includes(status)) {
                return res.status(422).json({
                    error: 'Status inválido. Use PENDENTE, PAGO, ATRASADO ou CANCELADO',
                    campo: 'status'
                });
            }

            if (status === 'PAGO' && !dataPagamento) {
                return res.status(422).json({
                    error: 'dataPagamento é obrigatório quando status é PAGO',
                    campo: 'dataPagamento'
                });
            }

            // Validações de Integridade
            if (categoriaId) {
                const cat = await prisma.categoriaFinanceira.findFirst({
                    where: { id: categoriaId, clientId }
                });
                if (!cat) return res.status(400).json({ error: 'Categoria não encontrada' });
            }

            if (leadId) {
                const lead = await prisma.lead.findFirst({
                    where: { id: leadId, clientId }
                });
                if (!lead) return res.status(400).json({ error: 'Lead não encontrado' });
            }

            if (vendaId) {
                const venda = await prisma.sale.findFirst({
                    where: { id: vendaId, clientId }
                });
                if (!venda) return res.status(400).json({ error: 'Venda não encontrada' });
            }

            const lancamentosParaCriar = [];
            const valorParcela = Number((valor / parcelas).toFixed(2));
            const diferencaCentavos = Number((valor - (valorParcela * parcelas)).toFixed(2));

            const idAgrupamento = parcelas > 1 ? crypto.randomUUID() : null;
            const dataBase = new Date(dataVencimento);

            for (let i = 0; i < parcelas; i++) {
                const dataVencimentoParcela = new Date(dataBase);
                dataVencimentoParcela.setMonth(dataBase.getMonth() + i);

                if (dataVencimentoParcela.getDate() !== dataBase.getDate()) {
                    dataVencimentoParcela.setDate(0);
                }

                const valorFinalDestaParcela = (i === parcelas - 1)
                    ? valorParcela + diferencaCentavos
                    : valorParcela;

                lancamentosParaCriar.push({
                    clientId,
                    descricao: parcelas > 1 ? `${descricao} (${i + 1}/${parcelas})` : descricao,
                    valor: valorFinalDestaParcela,
                    tipo,
                    dataVencimento: dataVencimentoParcela,
                    status: i === 0 ? status : 'PENDENTE',
                    dataPagamento: (i === 0 && status === 'PAGO') ? (dataPagamento ? new Date(dataPagamento) : new Date()) : null,
                    categoriaId: categoriaId || null,
                    leadId: leadId || null,
                    vendaId: vendaId || null,
                    idAgrupamento: idAgrupamento,
                });
            }

            if (parcelas > 1) {
                await prisma.lancamentoFinanceiro.createMany({
                    data: lancamentosParaCriar
                });
                res.status(201).json({
                    mensagem: `${parcelas} parcelas criadas.`,
                    total: valor
                });
            } else {
                const lancamento = await prisma.lancamentoFinanceiro.create({
                    data: lancamentosParaCriar[0]
                });
                res.status(201).json(lancamento);
            }
        } catch (error) {
            console.error('[criarLancamento]', error);
            res.status(500).json({ error: 'Erro ao criar lançamento financeiro' });
        }
    }

    async editarLancamento(req, res) {
        try {
            const { id } = req.params;
            const { clientId } = req.usuario;
            const dados = req.body;

            const existente = await buscarLancamentoDoCliente(id, clientId);
            if (!existente) return res.status(404).json({ error: 'Lançamento não encontrado.' });

            if (existente.status === 'PAGO') {
                return res.status(422).json({ error: 'Não é possível editar um lançamento já pago.' });
            }

            // Validações de Integridade para Edição
            if (dados.categoriaId) {
                const cat = await prisma.categoriaFinanceira.findFirst({
                    where: { id: dados.categoriaId, clientId }
                });
                if (!cat) return res.status(400).json({ error: 'Categoria inválida.' });
            }

            const lancamento = await prisma.lancamentoFinanceiro.update({
                where: { id },
                data: {
                    descricao: dados.descricao,
                    valor: dados.valor,
                    tipo: dados.tipo,
                    dataVencimento: dados.dataVencimento ? new Date(dados.dataVencimento) : undefined,
                    categoriaId: dados.categoriaId,
                    leadId: dados.leadId,
                    vendaId: dados.vendaId
                }
            });

            res.json(lancamento);
        } catch (error) {
            console.error('[editarLancamento]', error);
            res.status(500).json({ error: 'Erro ao editar lançamento' });
        }
    }

    async atualizarStatus(req, res) {
        try {
            const { id } = req.params;
            const { clientId } = req.usuario;
            const { status, dataPagamento, dataCancelamento } = req.body;

            const existente = await buscarLancamentoDoCliente(id, clientId);
            if (!existente) return res.status(404).json({ error: 'Lançamento não encontrado.' });

            if (!STATUS_VALIDOS_LANCAMENTO.includes(status))
                return res.status(422).json({ error: 'Status inválido.' });

            if (status === 'PAGO' && !dataPagamento)
                return res.status(422).json({ error: 'Data de pagamento é obrigatória ao pagar.' });

            const lancamento = await prisma.lancamentoFinanceiro.update({
                where: { id },
                data: {
                    status,
                    dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined,
                    dataCancelamento: dataCancelamento ? new Date(dataCancelamento) : undefined
                }
            });

            res.json(lancamento);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao atualizar status do lançamento' });
        }
    }

    async cancelarLancamento(req, res) {
        try {
            const { id } = req.params;
            const { clientId } = req.usuario;
            const { motivo } = req.body;

            const existent = await buscarLancamentoDoCliente(id, clientId);
            if (!existent) return res.status(404).json({ error: 'Lançamento não encontrado.' });

            if (existent.status === 'PAGO') return res.status(422).json({ error: 'Lançamento já pago.' });

            const lancamento = await prisma.lancamentoFinanceiro.update({
                where: { id },
                data: {
                    status: 'CANCELADO',
                    motivoCancelamento: motivo || 'Cancelado pelo usuário',
                    dataCancelamento: new Date()
                }
            });

            res.json(lancamento);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao cancelar lançamento' });
        }
    }

    async excluirLancamento(req, res) {
        try {
            const { id } = req.params;
            const { clientId } = req.usuario;

            const existente = await buscarLancamentoDoCliente(id, clientId);
            if (!existente) return res.status(404).json({ error: 'Lançamento não encontrado.' });

            await prisma.lancamentoFinanceiro.delete({ where: { id } });

            res.json({ mensagem: 'Lançamento excluído com sucesso.' });
        } catch (error) {
            console.error('[excluirLancamento]', error);
            res.status(500).json({ error: 'Erro ao excluir lançamento' });
        }
    }

    async dashboard(req, res) {
        try {
            const { clientId } = req.usuario;
            const hoje = new Date();

            const agregados = await prisma.lancamentoFinanceiro.groupBy({
                by: ['tipo', 'status'],
                where: { clientId },
                _sum: { valor: true }
            });

            const proximos = await prisma.lancamentoFinanceiro.findMany({
                where: { clientId, status: 'PENDENTE', dataVencimento: { gte: hoje } },
                take: 5,
                orderBy: { dataVencimento: 'asc' },
                include: { categoria: true }
            });

            const resumo = { receita: 0, despesa: 0, saldo: 0, pendenteReceita: 0, pendenteDespesa: 0 };
            agregados.forEach(a => {
                const valor = a._sum.valor || 0;
                if (a.tipo === 'RECEITA') {
                    if (a.status === 'PAGO') resumo.receita += valor;
                    else resumo.pendenteReceita += valor;
                } else {
                    if (a.status === 'PAGO') resumo.despesa += valor;
                    else resumo.pendenteDespesa += valor;
                }
            });
            resumo.saldo = resumo.receita - resumo.despesa;

            res.json({
                resumo,
                proximosVencimentos: proximos,
                totalProximos: proximos.length
            });
        } catch (error) {
            console.error('[dashboard]', error);
            res.status(500).json({ error: 'Erro ao carregar dashboard' });
        }
    }

    async resumo(req, res) {
        try {
            const { clientId } = req.usuario;
            const agregados = await prisma.lancamentoFinanceiro.groupBy({
                by: ['tipo', 'status'],
                where: { clientId },
                _sum: { valor: true },
                _count: { id: true }
            });

            let resumo = {
                receitas: { pagas: 0, pendentes: 0 },
                despesas: { pagas: 0, pendentes: 0 },
                atrasados: 0
            };

            agregados.forEach(item => {
                const valor = Number(item._sum.valor) || 0;
                if (item.tipo === 'RECEITA') {
                    if (item.status === 'PAGO') resumo.receitas.pagas += valor;
                    else resumo.receitas.pendentes += valor;
                } else if (item.tipo === 'DESPESA') {
                    if (item.status === 'PAGO') resumo.despesas.pagas += valor;
                    else resumo.despesas.pendentes += valor;
                }
                if (item.status === 'ATRASADO') resumo.atrasados += item._count.id;
            });

            res.json({
                saldoAtual: resumo.receitas.pagas - resumo.despesas.pagas,
                receitas: resumo.receitas,
                despesas: resumo.despesas,
                atrasados: resumo.atrasados
            });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar resumo' });
        }
    }

    async fluxoCaixa(req, res) {
        try {
            const { clientId } = req.usuario;
            const hoje = new Date();
            const trintaDiasDepois = new Date();
            trintaDiasDepois.setDate(hoje.getDate() + 30);

            const lancamentos = await prisma.lancamentoFinanceiro.findMany({
                where: { clientId, dataVencimento: { gte: hoje, lte: trintaDiasDepois }, status: { not: 'CANCELADO' } },
                orderBy: { dataVencimento: 'asc' }
            });

            const fluxo = {};
            lancamentos.forEach(l => {
                const data = l.dataVencimento.toISOString().split('T')[0];
                if (!fluxo[data]) fluxo[data] = { receita: 0, despesa: 0, saldo: 0 };
                if (l.tipo === 'RECEITA') fluxo[data].receita += l.valor;
                else fluxo[data].despesa += l.valor;
                fluxo[data].saldo = fluxo[data].receita - fluxo[data].despesa;
            });

            res.json(fluxo);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao gerar fluxo de caixa' });
        }
    }

    async relatorioPorCategoria(req, res) {
        try {
            const { clientId } = req.usuario;
            const { inicio, fim } = req.query;

            const dados = await prisma.lancamentoFinanceiro.groupBy({
                by: ['categoriaId'],
                where: {
                    clientId,
                    dataVencimento: {
                        gte: inicio ? new Date(inicio) : undefined,
                        lte: fim ? new Date(fim) : undefined
                    }
                },
                _sum: { valor: true },
                _count: { id: true }
            });

            const categorias = await prisma.categoriaFinanceira.findMany({ where: { clientId } });

            const relatorio = dados.map(item => ({
                categoria: categorias.find(c => c.id === item.categoriaId)?.nome || 'Sem Categoria',
                valorTotal: item._sum.valor,
                quantidade: item._count.id
            }));

            res.json(relatorio);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao gerar relatório por categoria' });
        }
    }

    async atualizarStatusEmLote(req, res) {
        try {
            const { clientId } = req.usuario;
            const { ids, status, dataPagamento } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) return res.status(422).json({ error: 'IDs não informados' });

            await prisma.lancamentoFinanceiro.updateMany({
                where: { id: { in: ids }, clientId },
                data: {
                    status,
                    dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined
                }
            });

            res.json({ mensagem: `${ids.length} lançamentos atualizados.` });
        } catch (error) {
            res.status(500).json({ error: 'Erro na atualização em lote' });
        }
    }

    async excluirGrupo(req, res) {
        try {
            const { clientId } = req.usuario;
            const { idAgrupamento } = req.params;

            if (!idAgrupamento) return res.status(422).json({ error: 'ID de agrupamento não informado.' })

            const resultado = await prisma.lancamentoFinanceiro.deleteMany({
                where: { clientId, idAgrupamento }
            });

            res.json({ mensagem: "Grupo excluído.", quantidade: resultado.count });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao excluir grupo' });
        }
    }

    // Categorias
    async listarCategorias(req, res) {
        try {
            const { clientId } = req.usuario;
            const categorias = await prisma.categoriaFinanceira.findMany({
                where: { clientId },
                orderBy: { nome: 'asc' }
            });
            res.json(categorias);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao listar categorias' });
        }
    }

    async criarCategoria(req, res) {
        try {
            const { clientId } = req.usuario;
            const { nome, tipo } = req.body;

            if (!nome || !tipo) return res.status(422).json({ error: "Nome e tipo são obrigatórios." });

            if (!TIPOS_VALIDOS.includes(tipo)) return res.status(422).json({ error: "Tipo inválido." });

            const categoria = await prisma.categoriaFinanceira.create({
                data: { clientId, nome, tipo }
            });

            res.status(201).json(categoria);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar categoria' });
        }
    }
}

module.exports = new FinanceiroController();
