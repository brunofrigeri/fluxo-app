// Landing-page wording, from the "Landing page" boards of the Fluxo design canvas.
//
// Some claims here are the product's plan, not what the app does today (the 14-day trial and read-only period,
// the prices, a 4-client class, data export, "a lotado avisa"). They are marked `// not shipped yet` so they can be
// checked against the app before launch. Do not add a claim without it being true or marked.

/** Attendance status as the design draws it: ok = present, jm = justified miss, um = unjustified, rp = replacement, no = unmarked. */
export type DemoStatus = "ok" | "jm" | "um" | "rp" | "no";

export const landing = {
  meta: {
    title: "Fluxo: a agenda do seu estúdio, no ritmo certo",
    description:
      "Organize horários, presenças e evoluções de Pilates em um só lugar. Abra o dia em segundos, marque presença com um toque e encontre o histórico de qualquer cliente em dois cliques.",
  },
  nav: {
    label: "Seções",
    features: "Recursos",
    howItWorks: "Como funciona",
    plans: "Planos",
    faq: "Perguntas",
    signIn: "Entrar",
    trial: "Testar grátis",
  },
  hero: {
    pill: "Para estúdios e profissionais autônomos",
    title: "A agenda do seu estúdio, no ritmo certo.",
    lead: "O Fluxo organiza horários, presenças e evoluções de Pilates em um só lugar. Abra o dia em segundos, marque presença com um toque e encontre o histórico de qualquer cliente em dois cliques.",
    primary: "Testar 14 dias grátis", // not shipped yet
    secondary: "Ver planos",
    assurances: ["Sem cartão de crédito", "Clientes ilimitados", "Para atendimento particular"], // not shipped yet
    card: {
      date: "Segunda-feira, 05/10",
      title: "Sessões de hoje",
      time: "07:00",
      occupancy: "2/4",
      toast: "Presença registrada",
      sessions: [
        { name: "Bruno Almeida", status: "ok" },
        { name: "José “Zé” Carvalho", status: "jm" },
        { name: "Luís Fernando Moreira", status: "no" },
        { name: "João Pedro Tavares", status: "um" },
      ] as { name: string; status: DemoStatus }[],
    },
  },
  audience: [
    { icon: "users", title: "Profissional autônomo", text: "Você atende, agenda e registra sozinha ou sozinho. O Fluxo tira a rotina do caderno e das planilhas, sem complicar." },
    { icon: "calendar", title: "Estúdio com equipe", text: "Turmas pequenas, vários profissionais, horários cheios. Veja a ocupação de cada horário e saiba quem vem e quem faltou." },
    { icon: "lock", title: "Atendimento particular", text: "Feito para quem atende clientes particulares. Sem a burocracia de convênios." },
  ],
  features: {
    eyebrow: "Recursos",
    title: "Tudo o que o dia de um estúdio pede, e nada além.",
    agenda: {
      title: "Agenda pensada para turmas pequenas",
      text: "Cada horário reúne até 4 clientes. Você vê a ocupação (2/4), reconhece na hora o horário lotado e navega por dia, 3 dias, semana ou mês.", // not shipped yet: the app has no 4-client limit
      checks: ["Faltas liberam a vaga automaticamente", "Horário lotado avisa antes de você agendar"], // not shipped yet
      days: [
        {
          label: "SEG 05",
          slots: [
            { time: "07:00", occupancy: "2/4", full: false, clients: [{ name: "Bruno", status: "ok" }, { name: "Zé", status: "jm" }, { name: "Luís", status: "no" }, { name: "João", status: "um" }] },
            { time: "18:00", occupancy: "4/4", full: true, clients: [{ name: "Camila", status: "no" }, { name: "Rafael", status: "no" }, { name: "Patrícia", status: "no" }, { name: "Thiago", status: "no" }] },
          ],
        },
        {
          label: "TER 06",
          slots: [
            { time: "08:00", occupancy: "2/4", full: false, clients: [{ name: "Marina", status: "no" }, { name: "Cláudio", status: "no" }] },
            { time: "18:00", occupancy: "3/4", full: false, clients: [{ name: "Helena", status: "no" }, { name: "Gustavo", status: "no" }, { name: "Renata", status: "no" }] },
          ],
        },
        {
          label: "QUA 07",
          slots: [{ time: "09:00", occupancy: "2/4", full: false, clients: [{ name: "João", status: "no" }, { name: "Beatriz", status: "no" }] }],
        },
      ] as { label: string; slots: { time: string; occupancy: string; full: boolean; clients: { name: string; status: DemoStatus }[] }[] }[],
    },
    attendance: {
      title: "Presença em um toque",
      text: "Presença confirmada, falta justificada, falta não justificada ou reposição. Cada status tem cor, ícone e nome, então ninguém se confunde, nem de longe.",
      checks: ["Marque direto na Home ou na agenda", "A reposição fica ligada à falta que ela repõe"],
      demo: {
        initials: "BA",
        name: "Bruno Almeida",
        when: "Segunda, 05/10, 07:00",
        replacementLabel: "Reposição de 05/10",
        replacementNote: "Zé repõe sua falta na sexta, 09/10.",
      },
    },
    evolution: {
      title: "Evolução por aparelho, sem 45 campos na tela",
      text: "Reformer, Barrel, Cadillac, Chair e Balance. Abra só o aparelho que foi usado, escreva o que importa e pronto. Na leitura, só aparece o que foi preenchido.",
      checks: ["Todos os campos são opcionais", "Aviso antes de sair com alterações não salvas"],
      demo: {
        open: { name: "Reformer", count: "2 campos", options: ["Mobilidade", "Fortalecimento", "Alongamento"], selected: "Fortalecimento", field: "Inferiores", value: "Footwork com 3 molas, 3 séries de 12. Boa estabilidade de quadril." },
        closed: [{ name: "Barrel" }, { name: "Cadillac", count: "1 campo" }],
      },
    },
    extras: [
      { icon: "clock", title: "Home com o dia pronto", text: "Sessões de hoje, pendências de ontem, reposições a agendar, clientes em atenção e aniversariantes da semana." },
      { icon: "note", title: "Ficha completa do cliente", text: "Dados pessoais, doenças, cirurgias, rotina semanal, evoluções e avaliações iniciais e reavaliações, tudo no mesmo lugar." },
      { icon: "sun", title: "No computador, tablet e celular", text: "Marque presença ao lado do aparelho, com botões grandes. Tema claro e escuro." },
    ],
  },
  steps: {
    eyebrow: "Como funciona",
    title: "Do cadastro à evolução, em três passos.",
    items: [
      { title: "Cadastre clientes e horários", text: "Registre cada cliente com a rotina semanal. De 2 a 3 dias por semana, nos horários de cada um." },
      { title: "Abra o dia e marque presença", text: "A Home mostra quem vem hoje. Um toque no status e a presença está registrada." },
      { title: "Escreva a evolução", text: "Para quem esteve presente, registre o que foi feito. O histórico fica a dois cliques de distância." },
    ],
  },
  // not shipped yet: there is no billing, trial or plan limit in the app
  pricing: {
    eyebrow: "Planos",
    title: "Preço pelo número de profissionais. Clientes sempre ilimitados.",
    lead: "Todos os planos incluem todas as funções. O que muda é só o tamanho da equipe.",
    periodLabel: "Periodicidade",
    monthly: "Mensal",
    annual: "Anual",
    annualBadge: "2 meses grátis",
    forStudios: "Para estúdios",
    cta: "Testar 14 dias grátis",
    founder: "preço de fundador",
    monthlyBilling: "Cobrança mensal",
    perMonth: "/mês",
    perYear: "/ano",
    common: ["Clientes ilimitados", "Todas as funções do Fluxo"],
    note: "No plano anual você paga 10 meses e leva 12. Complementos opcionais virão depois e só serão cobrados quando existirem.",
    plans: [
      { name: "Solo", who: "1 profissional", highlight: false, monthly: { price: "R$59", list: "R$89/mês" }, annual: { price: "R$590", list: "R$890/ano", sub: "Equivale a R$49,17 por mês" } },
      { name: "Estúdio", who: "até 4 profissionais", highlight: true, monthly: { price: "R$119", list: "R$169/mês" }, annual: { price: "R$1.190", list: "R$1.690/ano", sub: "Equivale a R$99,17 por mês" } },
      {
        name: "Clínica",
        who: "até 10 profissionais",
        highlight: false,
        monthly: { price: "R$199", list: "R$269/mês" },
        annual: { price: "R$1.990", list: "R$2.690/ano", sub: "Equivale a R$165,83 por mês" },
        extra: "+ R$29 por mês por profissional extra",
      },
    ],
  },
  // not shipped yet: the trial, the read-only period and the export
  trial: {
    eyebrow: "Teste sem risco",
    title: "Experimente de verdade antes de decidir.",
    items: [
      { icon: "check", title: "14 dias grátis", text: "Sem cartão de crédito. Use com seus clientes reais." },
      { icon: "eye", title: "Depois, 30 dias só para leitura", text: "Se você não assinar, a conta fica em modo leitura por 30 dias, com exportação dos seus dados." },
      { icon: "lock", title: "Dados de saúde nunca são apagados", text: "O histórico dos seus clientes é seu e permanece guardado." },
    ],
  },
  faq: {
    eyebrow: "Perguntas frequentes",
    title: "Ficou com dúvida?",
    items: [
      { q: "Preciso de cartão de crédito para testar?", a: "Não. O teste de 14 dias é sem cartão." },
      { q: "E se eu não assinar depois do teste?", a: "A conta fica em modo leitura por 30 dias, com exportação dos dados. Os dados de saúde nunca são apagados." },
      { q: "Existe limite de clientes?", a: "Não. Todos os planos têm clientes ilimitados. O preço varia só com o número de profissionais." },
      { q: "O Fluxo atende convênios?", a: "Por enquanto, não. Ele foi feito para atendimento particular." },
      { q: "Tem lembretes por WhatsApp ou emissão de nota fiscal?", a: "Ainda não. Quando esses recursos existirem, serão complementos opcionais, cobrados só a partir de então." },
      { q: "Funciona no celular?", a: "Sim. O Fluxo funciona no computador, no tablet e no celular, com botões grandes para marcar presença em pé, ao lado do aparelho." },
      { q: "O que acontece se minha equipe crescer?", a: "Você muda de plano. No Clínica, que vai até 10 profissionais, cada profissional extra custa R$29 por mês." },
    ],
  },
  cta: {
    title: "Comece o dia em menos de 10 segundos.",
    text: "Teste o Fluxo por 14 dias, sem cartão, com os clientes do seu estúdio.",
    button: "Testar 14 dias grátis",
  },
  footer: {
    label: "Rodapé",
    terms: "Termos de uso",
    privacy: "Privacidade",
    rights: "Todos os direitos reservados.",
  },
} as const;
