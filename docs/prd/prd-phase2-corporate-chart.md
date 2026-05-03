# PRD Atualizado - App Financeiro Master com Plano de Contas Corporativo

## MUDANÇA CRÍTICA NA FASE 2

A Fase 2 do PRD original foi **expandida e completamente revisada** para incluir o Plano de Contas Corporativo de Nível IPO/M&A.

---

### Fase 2 (REVISADA): O Coração Financeiro - Plano de Contas Corporativo e Transações
**Objetivo**: Implementar um plano de contas robusto, alinhado com IFRS/GAAP, que permita gerar DRE, EBITIDA e Fluxo de Caixa com precisão necessária para IPO/M&A.

#### 2.1 Plano de Contas Corporativo (Estrutura Completa)

O sistema deve implementar o **Plano de Contas Corporativo** conforme documento `CHART_OF_ACCOUNTS_CORPORATE.md`, que inclui:

**Classe 1: Ativos (Balanço Patrimonial)**
- Ativos Circulantes: Caixa, Contas a Receber, Estoques, Despesas Antecipadas
- Ativos Não Circulantes: Investimentos, Imobilizado (com depreciação), Intangíveis (com amortização)

**Classe 2: Passivos (Balanço Patrimonial)**
- Passivos Circulantes: Contas a Pagar, Obrigações Trabalhistas, Tributárias, Empréstimos CP
- Passivos Não Circulantes: Empréstimos LP, Provisões, Passivos Diferidos

**Classe 3: Patrimônio Líquido**
- Capital Social, Reservas, Lucros Acumulados, Ajustes Patrimoniais

**Classe 4: Receitas (DRE)**
- Receita Operacional Bruta (por canal: Amazon, Shopify, Varejo, B2B)
- Deduções (Devoluções, Descontos, Impostos sobre Vendas)
- Receita Operacional Líquida (calculada automaticamente)
- Receitas Não Operacionais

**Classe 5: Custos e Despesas (DRE)**
- Custo dos Produtos Vendidos (CPV): Matéria-Prima, Mão de Obra Direta, Custos Indiretos, Embalagem, Logística de Entrada
- Lucro Bruto (calculado automaticamente)
- Despesas Operacionais:
  - Comerciais: Taxas de Marketplace, Publicidade, Logística de Saída, Atendimento ao Cliente
  - Administrativas: Pessoal, Infraestrutura, Tecnologia, Depreciação/Amortização
  - Financeiras: Juros, Variação Cambial
- Lucro Operacional/EBIT (calculado automaticamente)
- EBITIDA (calculado automaticamente: EBIT + D&A)
- Despesas Não Operacionais
- Impostos sobre o Lucro (IRPJ, CSLL)
- Lucro Líquido (calculado automaticamente)

#### 2.2 Implementação Técnica do Plano de Contas

1. **Estrutura Hierárquica no Banco de Dados**:
   - Tabela `chart_of_accounts` com campos: `account_code`, `account_name`, `account_type`, `parent_account_id`, `class` (1-5), `is_calculated` (para contas que são somas automáticas)
   - Suportar até 5 níveis de hierarquia (ex: 5.3.1.1.1 para Publicidade Amazon)

2. **Transações Vinculadas**:
   - Cada transação (tabela `transactions`) deve ser vinculada a uma conta específica do plano de contas
   - Suportar transações multi-linha (ex: uma nota fiscal pode impactar CMV, ICMS, Contas a Pagar simultaneamente)

3. **Cálculos Automáticos**:
   - Implementar engine de cálculo que:
     - Soma automaticamente contas filhas para gerar contas pais
     - Calcula Receita Líquida = Receita Bruta - Deduções
     - Calcula Lucro Bruto = Receita Líquida - CPV
     - Calcula EBIT = Lucro Bruto - Despesas Operacionais
     - Calcula EBITIDA = EBIT + Depreciação + Amortização
     - Calcula Lucro Líquido = EBIT - Despesas Não Operacionais - Impostos
   - Usar `decimal.js` para evitar erros de ponto flutuante

4. **Validações de Integridade**:
   - Verificar que todas as transações estão vinculadas a contas válidas
   - Alertar se houver contas órfãs (sem transações) que deveriam ter dados
   - Validar que a soma de Ativos = Passivos + Patrimônio Líquido

#### 2.3 Interface de Gestão do Plano de Contas

1. **Visualização Hierárquica**:
   - Árvore expansível mostrando a estrutura completa
   - Permitir expandir/recolher categorias
   - Mostrar saldo de cada conta (em tempo real)

2. **Criação e Edição de Contas**:
   - Formulário para criar nova conta com validação de código (ex: 5.3.1.1.1)
   - Permitir editar nome, tipo e conta pai
   - Soft delete (marcar como inativa, não deletar)

3. **Importação de Template**:
   - Botão para importar o template corporativo padrão
   - Permitir customização após importação (adicionar/remover contas específicas do negócio)

4. **Mapeamento de Contas por Canal**:
   - Para cada canal (Amazon, Shopify, Varejo, B2B), permitir configurar quais contas são aplicáveis
   - Exemplo: "Taxas de Marketplace" só se aplica a Amazon e Shopify

#### 2.4 Módulo de Transações (Revisado)

1. **Entrada Manual de Transações**:
   - Formulário com campos: Data, Descrição, Conta Débito, Conta Crédito, Valor, Canal, Comprovante
   - Suportar transações multi-linha (lançamento contábil completo)

2. **Validações Contábeis**:
   - Débito deve = Crédito (partidas dobradas)
   - Validar que contas de débito/crédito são compatíveis com o tipo de transação

3. **Histórico e Auditoria**:
   - Manter log de todas as transações: quem criou, quando, o quê foi alterado
   - Permitir visualizar versões anteriores (sem permitir edição retroativa)

#### 2.5 Seletor de Contexto Multi-CNPJ (Revisado)

1. **Seletor Global**:
   - Dropdown no cabeçalho permitindo selecionar: CNPJ Individual ou "Consolidado"
   - Quando "Consolidado", todas as contas mostram soma de todos os CNPJs

2. **Plano de Contas por CNPJ**:
   - Cada CNPJ pode ter seu próprio plano de contas (customizável)
   - Ou usar um plano consolidado (recomendado para IPO)

3. **Regime Tributário**:
   - Cada CNPJ tem um regime (Simples Nacional ou Lucro Presumido)
   - Sistema calcula impostos automaticamente conforme regime

---

## INDICADORES PARA APRESENTAÇÃO A INVESTIDORES

O sistema deve calcular e exibir automaticamente:

| Indicador | Fórmula | Benchmark Ideal |
|-----------|---------|-----------------|
| Margem Bruta | (Lucro Bruto / Receita Líquida) × 100 | 55-70% |
| Margem Operacional | (EBIT / Receita Líquida) × 100 | 15-25% |
| Margem EBITIDA | (EBITIDA / Receita Líquida) × 100 | 20-30% |
| Margem Líquida | (Lucro Líquido / Receita Líquida) × 100 | 18-26% |
| ROE | (Lucro Líquido / Patrimônio Líquido) × 100 | > 15% |
| ROA | (Lucro Líquido / Ativo Total) × 100 | > 10% |
| Crescimento Receita | (Receita Período Atual - Período Anterior) / Período Anterior × 100 | > 20% ao ano |
| Crescimento EBITIDA | (EBITIDA Período Atual - Período Anterior) / Período Anterior × 100 | > 25% ao ano |

---

## ESTRUTURA DE RELATÓRIOS PARA INVESTIDORES

### Relatório Nível 1: Executive Summary (1 página)
- Receita Operacional Líquida (com crescimento YoY)
- EBITIDA e Margem EBITIDA (com crescimento YoY)
- Lucro Líquido e Margem Líquida
- Comparação com benchmarks do setor
- Principais drivers de crescimento

### Relatório Nível 2: DRE Consolidada (1 página)
- Todas as linhas principais da DRE
- Comparação com período anterior (valores e %)
- Comparação com orçado (se aplicável)

### Relatório Nível 3: DRE Detalhada por Canal (2-3 páginas)
- Receita por canal (Amazon, Shopify, Varejo, B2B)
- CMV por canal
- Despesas alocáveis por canal
- Lucro e Margem por canal
- Crescimento por canal

### Relatório Nível 4: Análise de Sensibilidade (1 página)
- Impacto de variação de ±10% em principais drivers (Receita, CMV, Despesas)
- Cenários: Otimista (+20% receita), Base, Pessimista (-20% receita)
- Projeção de EBITIDA em cada cenário

### Relatório Nível 5: Fluxo de Caixa (1 página)
- Fluxo Operacional, de Investimento e de Financiamento
- Projeção de 3-5 anos
- Análise de working capital

---

## MUDANÇAS NAS FASES SUBSEQUENTES

### Fase 3 (Google Drive + OCR) - Integração com Novo Plano de Contas
- Ao processar comprovante, o sistema deve sugerir não apenas a categoria principal, mas a **conta específica do plano de contas corporativo**
- Exemplo: Fatura de fornecedor → sugerir "5.1.1.1 Matéria-Prima - Fornecedor A"

### Fase 4 (DRE) - Cálculos Automáticos
- O motor de cálculo deve usar as fórmulas definidas no novo plano de contas
- Gerar automaticamente: Receita Líquida, Lucro Bruto, EBIT, EBITIDA, Lucro Líquido

### Fase 5 (Benchmarking) - Indicadores Corporativos
- Adicionar comparação automática de todos os indicadores listados acima com benchmarks do setor

### Fase 6 (Dashboard + Relatórios) - Apresentação Executiva
- Dashboard deve exibir os "Big Five" KPIs mais os indicadores corporativos
- Relatórios devem incluir todas as 5 estruturas de apresentação a investidores

---

## CONFORMIDADE E AUDITORIA

1. **Rastreabilidade**: Cada lançamento contábil deve ser rastreável até o comprovante original (nota fiscal, recibo, etc)
2. **Auditoria**: Manter log completo de quem criou/alterou cada transação e quando
3. **Conformidade Tributária**: Sistema deve validar conformidade com regime tributário de cada CNPJ
4. **IFRS/GAAP**: Estrutura alinhada com IFRS 15 (Receita), IFRS 16 (Leasing), IFRS 9 (Instrumentos Financeiros)
5. **Validação Contábil**: Sempre manter Ativos = Passivos + Patrimônio Líquido

---

## PRÓXIMOS PASSOS

1. Integrar este Plano de Contas Corporativo na Fase 2 do PRD original
2. Atualizar as Fases 3-6 para trabalhar com a nova estrutura
3. Preparar templates de relatórios para apresentação a investidores
4. Implementar validações contábeis rigorosas
