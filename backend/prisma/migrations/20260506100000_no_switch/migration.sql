-- Switch: bifurca em N saidas baseado no valor de uma expressao.
-- Substitui IF aninhado: 1 nó com 5 saidas em vez de 4 IFs encadeados.
-- Forma de dados: { expressao: '{{caminho.dot}}', casos: [{ valor, label? }], default: bool }
ALTER TYPE "TipoNo" ADD VALUE 'SWITCH';
