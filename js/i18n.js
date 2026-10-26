/* =============================================================================
   i18n.js: todo texto da tela, em português e inglês, num lugar só.

   Por que separado: texto espalhado pelo código vira tradução que esquece um
   botão. Aqui, chave que falta aparece entre colchetes na tela ([chave]) e o
   teste automático reprova.
   ============================================================================= */
window.I18N = (function () {
  'use strict';
  const D = {
    eyebrow: ['ORGANOGRAMA · DEMONSTRAÇÃO', 'ORG CHART · DEMO'], eyebrow_real: ['ORGANOGRAMA', 'ORG CHART'],
    idioma: ['Idioma', 'Language'],
    t_modo_igual: ['Nada muda aqui: os dois modos só diferem nas equipes abertas. Abra um ramo (+) para ver.', 'Nothing changes here: the two modes only differ on open teams. Open a branch (+) to see it.'],
    zoom_100: ['Voltar para 100%', 'Back to 100%'],
    arq_csv: ['organograma', 'org-chart'], arq_modelo: ['organograma-modelo', 'org-chart-template'],
    titulo: ['Organograma institucional', 'Institutional org chart'],
    ficticio: ['dados fictícios, gerados no seu navegador', 'fictional data, generated in your browser'],
    proprio: ['seus dados, só neste navegador', 'your data, this browser only'],
    fonte_pbi: ['dados do relatório', 'report data'],
    numeros_de: ['Estrutura de', 'Structure as of'],
    dica_data: ['Quem está ativo nesta data entra no desenho. A empresa é sorteada com semente fixa: mesmo resultado em toda visita.', 'Everyone active on this date is drawn. The company is generated with a fixed seed: same result on every visit.'],
    tema_claro: ['Claro', 'Light'], tema_escuro: ['Escuro', 'Dark'],
    // barra de ferramentas
    busca: ['Buscar nome ou cargo', 'Search name or job title'],
    sem_resultado: ['Nada encontrado', 'Nothing found'],
    f_unidade: ['Unidade', 'Unit'], f_area: ['Área', 'Area'],
    todas_unidade: ['Todas as unidades', 'All units'], todas_area: ['Todas as áreas', 'All areas'],
    limpar: ['Limpar', 'Clear'],
    destaques: ['Destaques', 'Highlights'],
    d_aniv: ['Aniversariantes de {mes}', '{mes} birthdays'], d_novatos: ['Novatos (90 dias)', 'New hires (90 days)'], d_vagas: ['Vagas abertas', 'Open positions'],
    compacto: ['Compacto', 'Compact'], espalhado: ['Espalhado', 'Spread out'],
    dica_compacto: ['Equipes em colunas, ligadas por um trilho: é só para caber na tela, não é mais um nível', 'Teams in columns on a rail: it only saves space, it is not another level'],
    dica_espalhado: ['Todo mundo lado a lado, como o organograma clássico', 'Everyone side by side, like the classic org chart'],
    desenho: ['Desenho', 'Chart'], lista: ['Lista', 'List'],
    expandir_tudo: ['Expandir tudo', 'Expand all'], recolher_tudo: ['Recolher tudo', 'Collapse all'],
    centralizar: ['Centralizar', 'Center'], ver_tudo: ['Ver tudo', 'Fit all'],
    zoom_mais: ['Aproximar', 'Zoom in'], zoom_menos: ['Afastar', 'Zoom out'],
    baixar_csv: ['Baixar CSV', 'Download CSV'], imprimir: ['Imprimir', 'Print'], meus_dados: ['Usar meus dados', 'Use my data'],
    mostrando: ['{n} de {t} pessoas', '{n} of {t} people'],
    mais_vagas: ['+ {n} vagas', '+ {n} open positions'], mais_vaga: ['+ 1 vaga', '+ 1 open position'],
    navegar: ['Arraste para mover · roda do mouse para zoom · clique num cartão para ver detalhes', 'Drag to move · scroll to zoom · click a card for details'],
    // cartão
    vaga: ['Vaga aberta', 'Open position'], vaga_ha: ['aberta há {n} dias', 'open for {n} days'],
    novo: ['Novo', 'New'], aniv_chip: ['Aniversário {d}', 'Birthday {d}'],
    t_anos_meses: ['{a}a {m}m', '{a}y {m}m'], t_anos: ['{a} anos', '{a} years'], t_ano: ['1 ano', '1 year'],
    t_meses: ['{m} meses', '{m} months'], t_mes: ['1 mês', '1 month'], t_dias: ['{d} dias', '{d} days'],
    no_ramo: ['{n} no ramo', '{n} in branch'], abrir_ramo: ['Expandir ramo', 'Expand branch'], fechar_ramo: ['Recolher ramo', 'Collapse branch'],
    // painel de detalhes
    p_area: ['Área', 'Area'], p_unidade: ['Unidade', 'Unit'], p_nivel: ['Nível', 'Level'],
    p_tempo: ['Tempo de casa', 'Tenure'], p_desde: ['desde {d}', 'since {d}'], p_aniv: ['Aniversário', 'Birthday'],
    p_email: ['E-mail', 'E-mail'], p_email_fic: ['fictício', 'fictional'], p_codigo: ['Código da estrutura', 'Structure code'], p_id: ['ID', 'ID'],
    p_gestor: ['Responde a', 'Reports to'], p_topo: ['Topo da estrutura', 'Top of the structure'],
    p_diretos: ['Equipe direta', 'Direct reports'], p_ramo: ['Pessoas no ramo', 'People in branch'],
    p_cadeia: ['Cadeia até o topo', 'Chain to the top'], p_ver: ['Mostrar no desenho', 'Show on chart'], p_ver_lista: ['Mostrar na lista', 'Show in list'], p_ver_ramo: ['Ver o ramo inteiro', 'View whole branch'],
    p_aberta: ['Aberta em', 'Opened on'], p_etapa: ['Etapa', 'Stage'], p_dias: ['Dias em aberto', 'Days open'],
    etapa_triagem: ['Triagem', 'Screening'], etapa_entrevistas: ['Entrevistas', 'Interviews'], etapa_oferta: ['Oferta', 'Offer'],
    fechar: ['Fechar', 'Close'], hoje: ['hoje', 'today'],
    l_vazio: ['Ninguém nesta lista com os filtros atuais.', 'No one in this list with the current filters.'],
    l_dica: ['Clique num nome para ir até o cartão.', 'Click a name to go to the card.'],
    // dado próprio
    imp_titulo: ['Usar seus dados', 'Use your own data'],
    imp_texto: ['Cole um CSV (com cabeçalho) ou um JSON, ou escolha um arquivo. Nada sai do seu navegador e nada fica salvo: ao recarregar a página, volta a empresa fictícia.', 'Paste a CSV (with a header row) or JSON, or choose a file. Nothing leaves your browser and nothing is saved: reloading the page brings the fictional company back.'],
    imp_colunas: ['Obrigatórias: id, nome, cargo, gestor_id (vazio no topo). Opcionais: area, unidade, nivel, admissao (AAAA-MM-DD), aniversario (DD/MM), email, codigo_estrutura, tipo (pessoa ou vaga). Os nomes em inglês também valem.', 'Required: id, name, title, manager_id (empty at the top). Optional: department, unit, level, hire_date (YYYY-MM-DD), birthday (DD/MM), email, structure_code, type (person or vacancy). Portuguese column names also work.'],
    imp_exemplo: ['id;nome;cargo;area;unidade;gestor_id\n1;Nome da Pessoa;Diretora-presidente;Diretoria;Matriz;\n2;Outra Pessoa;Gerente Financeira;Financeiro;Matriz;1', 'id;name;title;department;unit;manager_id\n1;Person Name;Chief Executive Officer;Board;Head office;\n2;Another Person;Finance Manager;Finance;Head office;1'],
    imp_arquivo: ['Escolher arquivo', 'Choose file'], imp_modelo: ['Baixar modelo em CSV', 'Download CSV template'],
    imp_carregar: ['Carregar', 'Load'], imp_voltar: ['Voltar para a empresa fictícia', 'Back to the fictional company'],
    imp_ok: ['{n} linhas carregadas.', '{n} rows loaded.'], imp_erro: ['Não consegui ler o texto: {e}', 'Could not read the text: {e}'],
    imp_vazio: ['Cole o texto ou escolha um arquivo primeiro.', 'Paste the text or choose a file first.'],
    av_id_repetido: ['id {id} repetido: ficou a primeira linha', 'id {id} repeated: the first row was kept'],
    av_gestor_inexistente: ['gestor_id "{gestor}" (de {id}) não existe: {id} virou topo', 'gestor_id "{gestor}" (of {id}) does not exist: {id} became a top node'],
    av_ciclo: ['ciclo na cadeia de {id}: o elo foi cortado', 'cycle in the chain of {id}: the link was cut'],
    avisos: ['Avisos', 'Warnings'],
    // avisos rápidos
    t_filtros_limpos: ['Filtros limpos para mostrar {nome}', 'Filters cleared to show {nome}'],
    t_csv: ['CSV com {n} linhas baixado', 'CSV with {n} rows downloaded'],
    // legenda e impressão
    leg_vaga: ['Vaga aberta', 'Open position'], leg_novo: ['Novato (menos de 90 dias)', 'New hire (under 90 days)'],
    leg_aniv: ['Aniversário no mês', 'Birthday this month'], leg_equipe: ['Equipe no trilho (não é outro nível)', 'Team on a rail (not another level)'], leg_contexto: ['Fora do filtro: só liga ao topo', 'Outside the filter: only links to the top'],
    filtros_ativos: ['Filtros', 'Filters'], impresso_em: ['Impresso em {d}', 'Printed on {d}'],
    portfolio: ['Portfólio', 'Portfolio'],
    sem_dados: ['Nenhuma pessoa para desenhar.', 'No one to draw.']
  };

  const api = {
    lang: 'pt',
    // T('mostrando', {n: 3, t: 10}) -> "3 de 10 pessoas". Chave que falta aparece como [chave].
    T(chave, vars) {
      const par = D[chave];
      let s = par ? par[api.lang === 'en' ? 1 : 0] : '[' + chave + ']';
      if (vars) Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
      return s;
    },
    // Cadastro {pt, en} ou texto simples (dado próprio vem como texto).
    nome(x) { return x == null ? '' : typeof x === 'string' ? x : (x[api.lang] || x.pt || ''); },
    locale() { return api.lang === 'en' ? 'en-US' : 'pt-BR'; }
  };
  return api;
})();
