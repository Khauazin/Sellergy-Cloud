-- Bloco A1: imagens ilustrativas em Produto e VariacaoProduto.
-- Storage: MinIO (bucket sellergy-midia, prefixo produtos/<clienteId>/...).

ALTER TABLE "produtos" ADD COLUMN "imagemUrl" TEXT;
ALTER TABLE "variacoes_produto" ADD COLUMN "imagemUrl" TEXT;
