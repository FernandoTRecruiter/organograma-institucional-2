/* =============================================================================
   estrutura.js: transforma uma LISTA de pessoas numa ÁRVORE (quem responde a quem).

   Duas entradas, uma saída só:
   1. a empresa fictícia do js/dados.js (cópia do gerador do dashboard do
      portfólio, mesmas pessoas): aqui a hierarquia é montada por REGRA FIXA,
      sem sorteio, então a árvore é igual em toda visita;
   2. dado próprio (CSV ou JSON colado na tela, ou window.ORGANOGRAMA_DADOS):
      a hierarquia já vem pronta na coluna gestor_id.
   A saída é sempre o mesmo objeto (o "org"), e o desenho não precisa saber de
   onde o dado veio.
   ============================================================================= */
window.ESTRUTURA = (function () {
  'use strict';
  const texto = v => (v == null ? '' : String(v)).trim();
  const semAcento = s => texto(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  /* ---------- 1. Empresa fictícia: a regra de quem responde a quem ---------- */

  // Cargo por área e nível. "(a)" marca a palavra que muda com o gênero:
  // flexionar() troca por "a" ou tira, conforme o cadastro da pessoa.
  const CARGOS = {
    ops: { apr: ['Jovem aprendiz de produção', 'Production apprentice'], ope: ['Operador(a) de produção', 'Production operator'], tcn: ['Técnico(a) de processo', 'Process technician'], ana: ['Analista de produção', 'Production analyst'], esp: ['Especialista de processo', 'Process specialist'], coo: ['Coordenador(a) de produção', 'Production coordinator'], ger: ['Gerente de Operações', 'Operations manager'] },
    man: { apr: ['Jovem aprendiz de manutenção', 'Maintenance apprentice'], ope: ['Mecânico(a) de manutenção', 'Maintenance mechanic'], tcn: ['Técnico(a) de manutenção', 'Maintenance technician'], ana: ['Analista de planejamento', 'Maintenance planner'], esp: ['Especialista em confiabilidade', 'Reliability specialist'], coo: ['Coordenador(a) de manutenção', 'Maintenance coordinator'], ger: ['Gerente de Manutenção', 'Maintenance manager'] },
    log: { apr: ['Jovem aprendiz de logística', 'Logistics apprentice'], ope: ['Operador(a) logístico(a)', 'Warehouse operator'], tcn: ['Técnico(a) de logística', 'Logistics technician'], ana: ['Analista de logística', 'Logistics analyst'], esp: ['Especialista em cadeia de suprimentos', 'Supply chain specialist'], coo: ['Coordenador(a) de logística', 'Logistics coordinator'], ger: ['Gerente de Logística', 'Logistics manager'] },
    tec: { est: ['Estagiário(a) de tecnologia', 'Technology intern'], tcn: ['Técnico(a) de suporte', 'Support technician'], ana: ['Analista de sistemas', 'Systems analyst'], esp: ['Especialista em dados', 'Data specialist'], coo: ['Coordenador(a) de tecnologia', 'Technology coordinator'], ger: ['Gerente de Tecnologia', 'Technology manager'] },
    com: { est: ['Estagiário(a) comercial', 'Sales intern'], ana: ['Analista comercial', 'Sales analyst'], esp: ['Especialista de contas', 'Key account specialist'], coo: ['Coordenador(a) comercial', 'Sales coordinator'], ger: ['Gerente Comercial', 'Sales manager'] },
    fin: { est: ['Estagiário(a) de finanças', 'Finance intern'], ana: ['Analista financeiro(a)', 'Financial analyst'], esp: ['Especialista em controladoria', 'Controlling specialist'], coo: ['Coordenador(a) financeiro(a)', 'Finance coordinator'], ger: ['Gerente Financeiro(a)', 'Finance manager'] },
    pes: { est: ['Estagiário(a) de RH', 'HR intern'], ana: ['Analista de Pessoas', 'People analyst'], esp: ['Especialista em desenvolvimento', 'Learning specialist'], coo: ['Coordenador(a) de Pessoas', 'People coordinator'], ger: ['Gerente de Pessoas & Cultura', 'People & Culture manager'] },
    jur: { ana: ['Analista jurídico(a)', 'Legal analyst'], esp: ['Advogado(a) especialista', 'Specialist lawyer'], coo: ['Coordenador(a) jurídico(a)', 'Legal coordinator'], ger: ['Gerente Jurídico(a)', 'Legal manager'] }
  };
  // Três diretorias dividem as oito áreas; quem preside é a pessoa mais antiga da Diretoria.
  const DIRETORIAS = [
    { areas: ['ops', 'man', 'log'], cargo: ['Diretor(a) de Operações', 'Operations Director'] },
    { areas: ['com', 'tec'], cargo: ['Diretor(a) Comercial e de Tecnologia', 'Commercial & Technology Director'] },
    { areas: ['fin', 'pes', 'jur'], cargo: ['Diretor(a) Administrativo(a)-Financeiro(a)', 'Finance & Administration Director'] }
  ];
  const CARGO_CEO = ['Diretor(a)-presidente (CEO)', 'Chief Executive Officer (CEO)'];
  const CARGO_DIRETOR_EXTRA = ['Diretor(a) executivo(a)', 'Executive Director'];

  // "Operador(a)" vira "Operadora" (F), "Operador" (M) ou fica igual (não informado).
  function flexionar(t, genero) {
    if (genero === 'M') return t.replace(/\(a\)/g, '');
    if (genero === 'F') return t.replace(/o\(a\)/g, 'a').replace(/\(a\)/g, 'a');
    return t;
  }
  function cargoDe(par, genero) { return { pt: flexionar(par[0], genero), en: par[1] }; }

  // E-mail fictício (domínio reservado .example, que não existe na internet).
  function emailFicticio(nome, usados) {
    const partes = semAcento(nome).replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean);
    const base = partes[0] + '.' + partes[partes.length - 1];
    let e = base, n = 2;
    while (usados.has(e)) e = base + (n++);
    usados.add(e);
    return e + '@cpaoli.example';
  }

  function daFicticia(D) {
    const ref = D.dataRef;
    const ativo = p => p.admissao <= ref && (!p.desligamento || p.desligamento > ref);
    // Desempate sempre pelo mesmo critério: mais antigo primeiro, depois a matrícula.
    const porAntiguidade = (a, b) => (a.admissao - b.admissao) || (a.id < b.id ? -1 : 1);
    const ativos = D.pessoas.filter(ativo).sort((a, b) => (a.id < b.id ? -1 : 1));
    const emails = new Set();
    const no = {};
    ativos.forEach(p => {
      const par = (CARGOS[p.area] || {})[p.nivel];
      no[p.id] = {
        id: p.id, tipo: 'pessoa', nome: p.nome, genero: p.genero,
        cargo: par ? cargoDe(par, p.genero) : { pt: D.niveis[p.nivel].pt, en: D.niveis[p.nivel].en },
        area: p.area, unidade: p.unidade, nivel: p.nivel, nivelOrdem: D.niveis[p.nivel].ordem,
        gestor: null, admissao: p.admissao,
        aniversario: { d: p.nascimento.getDate(), m: p.nascimento.getMonth() + 1 },
        email: emailFicticio(p.nome, emails), codigo: ''
      };
    });

    // Passo 1: topo. A pessoa mais antiga da Diretoria preside; as outras dirigem as diretorias.
    const diretoria = ativos.filter(p => p.nivel === 'dir').sort(porAntiguidade);
    const ceo = diretoria[0];
    no[ceo.id].cargo = cargoDe(CARGO_CEO, ceo.genero);
    const diretorDaArea = {};
    diretoria.slice(1).forEach((p, i) => {
      no[p.id].gestor = ceo.id;
      const dir = DIRETORIAS[i];
      no[p.id].cargo = cargoDe(dir ? dir.cargo : CARGO_DIRETOR_EXTRA, p.genero);
      if (dir) dir.areas.forEach(a => { diretorDaArea[a] = p.id; });
    });

    // Passo 2: em cada área, gerente -> coordenadores -> equipe.
    const chefeDaArea = {}, coordenadores = {}, tamanho = {};
    Object.keys(D.areas).filter(a => a !== 'dir').forEach(area => {
      const acima = diretorDaArea[area] || ceo.id; // diretoria vaga: a área sobe para o topo
      const gerentes = ativos.filter(p => p.area === area && p.nivel === 'ger').sort(porAntiguidade);
      gerentes.forEach((g, i) => { no[g.id].gestor = i === 0 ? acima : gerentes[0].id; });
      chefeDaArea[area] = gerentes.length ? gerentes[0].id : acima;
      coordenadores[area] = ativos.filter(p => p.area === area && p.nivel === 'coo').sort(porAntiguidade);
      coordenadores[area].forEach(c => { no[c.id].gestor = chefeDaArea[area]; tamanho[c.id] = 0; });
    });
    // Equipe: o coordenador da MESMA unidade com menos gente; sem coordenador, o gerente.
    function liderDaEquipe(area, unidade) {
      const todos = coordenadores[area] || [];
      if (!todos.length) return chefeDaArea[area];
      const mesmos = todos.filter(c => c.unidade === unidade);
      const opcoes = mesmos.length ? mesmos : todos;
      return opcoes.reduce((m, c) => (tamanho[c.id] < tamanho[m.id] ? c : m), opcoes[0]).id;
    }
    ativos.filter(p => !D.niveis[p.nivel].lider).forEach(p => {
      const l = liderDaEquipe(p.area, p.unidade);
      no[p.id].gestor = l;
      if (l in tamanho) tamanho[l] += 1;
    });

    // Passo 3: as vagas abertas do mesmo gerador entram como cartões tracejados.
    const vagas = D.vagas.filter(v => v.status === 'aberta').map(v => {
      const par = (CARGOS[v.area] || {})[v.nivel];
      const gestor = v.nivel === 'ger' ? (diretorDaArea[v.area] || ceo.id)
        : v.nivel === 'coo' ? chefeDaArea[v.area] : liderDaEquipe(v.area, v.unidade);
      return {
        id: v.id, tipo: 'vaga', nome: '', cargo: par ? cargoDe(par, 'N') : { pt: D.niveis[v.nivel].pt, en: D.niveis[v.nivel].en },
        area: v.area, unidade: v.unidade, nivel: v.nivel, nivelOrdem: D.niveis[v.nivel].ordem,
        gestor, abertura: v.abertura, etapa: v.etapa, codigo: ''
      };
    });

    const org = {
      empresa: D.empresa, dataRef: ref, ficticio: true, avisos: [],
      areas: D.areas, unidades: D.unidades, niveis: D.niveis,
      nos: Object.values(no).concat(vagas)
    };
    indexar(org);
    codigosDeEstrutura(org);
    return org;
  }

  // Código de estrutura fictício: cada líder ganha um "endereço" na árvore
  // (CP.01, CP.01.02, CP.01.02.03); quem não lidera herda o do seu líder.
  function codigosDeEstrutura(org) {
    function visitar(n, codigo) {
      n.codigo = codigo;
      let k = 0;
      (org.filhos.get(n.id) || []).forEach(f => {
        const lidera = (org.filhos.get(f.id) || []).length > 0 || ['dir', 'ger', 'coo'].includes(f.nivel);
        visitar(f, lidera ? codigo + '.' + String(++k).padStart(2, '0') : codigo);
      });
    }
    org.raizes.forEach((r, i) => visitar(r, 'CP.' + String(i + 1).padStart(2, '0')));
  }

  /* ---------- 2. Índices que o desenho usa (valem para as duas entradas) ---------- */

  // Por que ordenar aqui: a ordem dos irmãos decide o desenho. Pessoas antes de
  // vagas, liderança antes de equipe, e o nome desempata.
  function indexar(org) {
    org.porId = new Map(org.nos.map(n => [n.id, n]));
    org.filhos = new Map();
    org.raizes = [];
    org.nos.forEach(n => {
      if (n.gestor && org.porId.has(n.gestor)) {
        if (!org.filhos.has(n.gestor)) org.filhos.set(n.gestor, []);
        org.filhos.get(n.gestor).push(n);
      } else org.raizes.push(n);
    });
    const ordem = (a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'pessoa' ? -1 : 1) ||
      ((b.nivelOrdem || 0) - (a.nivelOrdem || 0)) ||
      (a.nome || '').localeCompare(b.nome || '', 'pt') || (a.id < b.id ? -1 : 1);
    org.filhos.forEach(l => l.sort(ordem));
    org.raizes.sort(ordem);
    return org;
  }

  /* ---------- 3. Dado próprio: CSV ou JSON ---------- */

  // Nome de coluna -> campo. Aceita português, inglês e os nomes mais comuns de sistemas de RH.
  const APELIDOS = {
    id: ['id', 'matricula', 'chapa', 'registro', 'employee_id'],
    nome: ['nome', 'name', 'colaborador', 'funcionario', 'employee'],
    cargo: ['cargo', 'funcao', 'title', 'job_title', 'position', 'role'],
    area: ['area', 'departamento', 'department', 'setor', 'secao'],
    unidade: ['unidade', 'unit', 'site', 'local', 'filial', 'location'],
    gestor_id: ['gestor_id', 'id_gestor', 'gestor', 'manager_id', 'manager', 'reports_to', 'parent', 'superior'],
    nivel: ['nivel', 'level', 'senioridade'],
    nivel_ordem: ['nivel_ordem', 'level_order'],
    admissao: ['admissao', 'data_admissao', 'hire_date', 'start_date'],
    aniversario: ['aniversario', 'nascimento', 'data_nascimento', 'birthday', 'birth_date'],
    email: ['email', 'e_mail', 'mail'],
    codigo_estrutura: ['codigo_estrutura', 'estrutura', 'structure_code', 'codigo'],
    tipo: ['tipo', 'type', 'vaga', 'vacancy'],
    abertura: ['abertura', 'aberta_em', 'opened_on'],
    etapa: ['etapa', 'stage']
  };
  const chave = k => semAcento(k).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  // Data "AAAA-MM-DD" ou "DD/MM/AAAA" vira Date à meia-noite LOCAL
  // (new Date("2026-01-05") seria UTC e poderia mudar o dia).
  function data(v) {
    const s = texto(v);
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  }
  // Aniversário guarda só dia e mês: o ano de nascimento, se vier, é descartado.
  function aniversario(v) {
    const d = data(v);
    if (d) return { d: d.getDate(), m: d.getMonth() + 1 };
    const m = /^(\d{1,2})\/(\d{1,2})$/.exec(texto(v));
    return m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31 ? { d: +m[1], m: +m[2] } : null;
  }

  // CSV simples e correto: aspas, aspas dobradas, quebra de linha dentro de aspas,
  // separador ; , ou TAB (o da primeira linha que mais aparece).
  function lerCsv(t) {
    const primeira = t.split(/\r?\n/, 1)[0];
    const sep = [';', ',', '\t'].map(s => [s, primeira.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
    const linhas = [];
    let campo = '', linha = [], aspas = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (aspas) {
        if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && t[i + 1] === '\n') i++;
        linha.push(campo); linhas.push(linha); campo = ''; linha = [];
      } else campo += c;
    }
    linha.push(campo); linhas.push(linha);
    const cab = linhas.shift().map(chave);
    return linhas.filter(l => l.some(v => texto(v) !== ''))
      .map(l => Object.fromEntries(cab.map((k, i) => [k, texto(l[i])])));
  }

  // Texto colado (ou arquivo) -> linhas. JSON pode ser uma lista ou {empresa, dataRef, pessoas}.
  function lerTexto(t) {
    const s = String(t || '').trim(); // trim() também tira o BOM que o Excel põe no começo
    if (!s) throw new Error('vazio');
    if (s[0] === '[' || s[0] === '{') {
      const j = JSON.parse(s);
      const lista = Array.isArray(j) ? j : (j.pessoas || j.linhas || []);
      return { linhas: lista, empresa: Array.isArray(j) ? '' : texto(j.empresa), dataRef: Array.isArray(j) ? '' : texto(j.dataRef) };
    }
    return { linhas: lerCsv(s), empresa: '', dataRef: '' };
  }

  // Etapa de vaga escrita em inglês vira a chave em português que a tela traduz.
  const ETAPA_EN = { screening: 'triagem', interview: 'entrevistas', interviews: 'entrevistas', offer: 'oferta' };

  // Ordem de nível pelo nome, para quem não manda nivel_ordem (0 = mais júnior).
  const ORDEM_NOMES = [['aprendiz', 0], ['estag', 1], ['operac', 2], ['tecnic', 3], ['analist', 4], ['especial', 5], ['coord', 6], ['supervis', 6], ['gerent', 7], ['gerenc', 7], ['head', 7], ['diret', 8], ['presid', 9], ['ceo', 9]];

  // Linhas (já lidas) -> org. Avisa em vez de travar: id repetido, gestor que não
  // existe e ciclo (A responde a B que responde a A) viram aviso na tela.
  function deLinhas(entrada) {
    const avisos = [];
    const campos = linha => {
      const l = {};
      Object.keys(linha || {}).forEach(k => { l[chave(k)] = linha[k]; });
      const out = {};
      Object.keys(APELIDOS).forEach(c => {
        const achado = APELIDOS[c].find(a => texto(l[a]) !== '');
        out[c] = achado ? texto(l[achado]) : '';
      });
      return out;
    };
    const linhas = (entrada.linhas || []).map(campos);
    const cad = prefixo => {
      const out = {}, cod = {};
      return {
        out, codigo(t) {
          const v = texto(t) || '-';
          if (!cod[v]) { cod[v] = prefixo + (Object.keys(out).length + 1); out[cod[v]] = { pt: v, en: v }; }
          return cod[v];
        }
      };
    };
    const areas = cad('a'), unidades = cad('u'), niveis = cad('n');
    const nos = [], vistos = new Set();
    linhas.forEach((l, i) => {
      let id = l.id || 'L' + (i + 2);
      if (vistos.has(id)) { avisos.push({ tipo: 'id_repetido', id }); return; }
      vistos.add(id);
      const vaga = /^(vag|vac|s$|sim$|y$|yes$|true$|1$)/.test(semAcento(l.tipo)) || !l.nome;
      const nomeNivel = semAcento(l.nivel || l.cargo);
      const achado = ORDEM_NOMES.find(([k]) => nomeNivel.includes(k));
      const ordem = l.nivel_ordem !== '' && isFinite(+l.nivel_ordem) ? +l.nivel_ordem : (achado ? achado[1] : 4);
      const nivel = l.nivel ? niveis.codigo(l.nivel) : '';
      if (nivel) niveis.out[nivel].ordem = ordem;
      nos.push({
        id, tipo: vaga ? 'vaga' : 'pessoa', nome: vaga ? '' : l.nome, cargo: l.cargo,
        area: areas.codigo(l.area), unidade: unidades.codigo(l.unidade), nivel, nivelOrdem: ordem,
        gestor: l.gestor_id || null, admissao: data(l.admissao), aniversario: aniversario(l.aniversario),
        email: l.email, codigo: l.codigo_estrutura, abertura: data(l.abertura), etapa: ETAPA_EN[semAcento(l.etapa)] || semAcento(l.etapa)
      });
    });
    // Gestor pelo id; se não achar, tenta pelo nome (planilha que traz o nome do chefe).
    const porId = new Map(nos.map(n => [n.id, n]));
    const porNome = new Map();
    nos.forEach(n => { if (n.nome) porNome.set(semAcento(n.nome), porNome.has(semAcento(n.nome)) ? null : n.id); });
    nos.forEach(n => {
      if (!n.gestor || n.gestor === n.id) { n.gestor = null; return; }
      if (porId.has(n.gestor)) return;
      const pn = porNome.get(semAcento(n.gestor));
      if (pn && pn !== n.id) { n.gestor = pn; return; }
      avisos.push({ tipo: 'gestor_inexistente', id: n.id, gestor: n.gestor });
      n.gestor = null;
    });
    // Ciclo: sobe a cadeia; se voltar a alguém já visto, corta o elo que fecha a volta.
    nos.forEach(n => {
      const vistosCadeia = new Set([n.id]);
      let atual = n;
      while (atual.gestor) {
        if (vistosCadeia.has(atual.gestor)) { avisos.push({ tipo: 'ciclo', id: atual.id }); atual.gestor = null; break; }
        vistosCadeia.add(atual.gestor);
        atual = porId.get(atual.gestor);
      }
    });
    const hoje = new Date();
    const org = {
      empresa: texto(entrada.empresa), dataRef: data(entrada.dataRef) || new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()),
      ficticio: false, avisos, areas: areas.out, unidades: unidades.out, niveis: niveis.out, nos
    };
    return indexar(org);
  }

  /* ---------- 4. Exportar: o CSV que sai é o mesmo formato que entra ---------- */

  // O cabeçalho sai no idioma da tela; os dois são aceitos de volta (ver APELIDOS).
  const COLUNAS = {
    pt: ['id', 'nome', 'cargo', 'area', 'unidade', 'gestor_id', 'gestor_nome', 'nivel', 'admissao', 'aniversario', 'email', 'codigo_estrutura', 'tipo', 'abertura', 'etapa'],
    en: ['id', 'name', 'title', 'department', 'unit', 'manager_id', 'manager_name', 'level', 'hire_date', 'birthday', 'email', 'structure_code', 'type', 'opened_on', 'stage']
  };
  const VALORES_EN = { pessoa: 'person', vaga: 'vacancy', triagem: 'screening', entrevistas: 'interviews', oferta: 'offer' };
  const iso = d => d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : '';
  const celula = v => { const s = texto(v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  // nome(x) traduz {pt, en} para o idioma da tela; o arquivo sai com BOM para o Excel abrir acentos.
  function paraCsv(org, nos, nome, lang) {
    const en = lang === 'en', valor = v => (en && VALORES_EN[v]) || v || '';
    const linhas = nos.map(n => {
      const g = n.gestor ? org.porId.get(n.gestor) : null;
      const a = n.aniversario ? String(n.aniversario.d).padStart(2, '0') + '/' + String(n.aniversario.m).padStart(2, '0') : '';
      return [n.id, n.nome, nome(n.cargo), nome(org.areas[n.area]), nome(org.unidades[n.unidade]), n.gestor || '', g ? (g.nome || nome(g.cargo)) : '',
        n.nivel && org.niveis[n.nivel] ? nome(org.niveis[n.nivel]) : '', iso(n.admissao), a, n.email || '', n.codigo || '', valor(n.tipo),
        iso(n.abertura), valor(n.etapa)].map(celula).join(';');
    });
    return String.fromCharCode(0xFEFF) + [COLUNAS[en ? 'en' : 'pt'].join(';')].concat(linhas).join('\r\n') + '\r\n';
  }

  return { daFicticia, deLinhas, lerTexto, paraCsv, indexar, COLUNAS, flexionar };
})();
