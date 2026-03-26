# comparacao_algs_busca
## Objetivo
Desenvolver uma aplicação que permita explorar, visualizar e comparar diferentes algoritmos de busca em strings, analisando seu funcionamento passo a passo, desempenho e complexidade.

## Descrição Geral
Os alunos deverão implementar uma aplicação (web ou desktop) capaz de:
- Carregar um ou mais arquivos .txt
- Receber uma string de busca (pattern)
- Executar diferentes algoritmos de busca de padrões
- Permitir visualizar a execução passo a passo
- Medir e comparar tempo de execução e complexidade teórica
  
## Requisitos Funcionais
Entrada de dados
- Upload de 1 ou N arquivos .txt
- Campo de entrada para a string a ser buscada
- Opção para escolher o algoritmo
  
## Algoritmos obrigatórios
Implementar os seguintes algoritmos:
- Busca Naive (força bruta)
- Rabin-Karp
- Knuth-Morris-Pratt (KMP)
- Boyer-Moore

## Execução
Executar o código:
- Execução normal
- Execução passo a passo (step-by-step) - usar o debug da sua linguagem se nunca usou aprender a usar

Durante o passo a passo, exibir:
- Índices comparados
- Comparações realizadas
- Movimentação do padrão
- Estruturas auxiliares (ex: tabela LPS do KMP, tabela de saltos do Boyer-Moore)
- Métricas e análise

Para cada execução:
- Tempo de execução (ms ou ns)
- Número de comparações realizadas
- Tamanho do texto e do padrão
  
Exibir também:
- Complexidade teórica:
- Naive → O(n * m)
- Rabin-Karp → O(n + m) (médio)
- KMP → O(n + m)
- Boyer-Moore → O(n / m) (melhor caso)

Comparação entre:
- Tempo real vs complexidade esperada
- Requisitos de Implementação
- Arquitetura

Se usar linguagem OO (Java, C#, Python, etc.), OBRIGATÓRIO usar o padrão Strategy

Exemplo:

SearchStrategy (interface)  ├── NaiveSearch  ├── RabinKarpSearch  ├── KMPSearch  ├── BoyerMooreSearch Interface (sugestão)
Web (HTML + JS + backend opcional) ou desktop

Elementos:
- Upload de arquivos
- Input de string
- Dropdown de algoritmo
- Botão "Executar"
- Botão "Passo a passo"
- Área de visualização (log da execução)
