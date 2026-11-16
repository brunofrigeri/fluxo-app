// Landing-page wording. Every claim here describes something the app does today; add a line only when it ships.
export const landing = {
  meta: {
    title: "Fluxo: agenda, presença e evolução para estúdios",
    description:
      "Agenda, presença e registros clínicos para estúdios de Pilates e acupuntura. Cada instrutor vê só os seus clientes e cada estúdio tem seu próprio espaço.",
  },
  nav: { features: "Recursos", signIn: "Entrar", signUp: "Criar conta" },
  hero: {
    eyebrow: "Para estúdios de Pilates e acupuntura",
    title: "A agenda, a presença e a evolução do seu estúdio em um só lugar",
    subtitle:
      "O Fluxo organiza as aulas e sessões, registra quem veio e guarda as avaliações e evoluções de cada cliente, com acesso separado por instrutor.",
    primary: "Criar conta",
    secondary: "Já tenho conta",
  },
  features: {
    title: "Tudo o que o dia a dia do estúdio precisa",
    items: [
      {
        icon: "calendar",
        title: "Agenda do dia ao mês",
        text: "Veja o dia, três dias, a semana ou o mês e adicione clientes em qualquer horário, sem limite por turma.",
      },
      {
        icon: "check",
        title: "Presença com um toque",
        text: "Marque presença ou falta direto na agenda. Faltas justificadas podem ser repostas e ficam ligadas à reposição.",
      },
      {
        icon: "wave",
        title: "Evolução por sessão",
        text: "Registre o que foi trabalhado em cada sessão. No Pilates, por aparelho, tipo de exercício e região do corpo.",
      },
      {
        icon: "note",
        title: "Avaliações por modalidade",
        text: "Fichas de avaliação de cada modalidade, como a de acupuntura, preenchidas uma vez e consultadas quando precisar.",
      },
      {
        icon: "users",
        title: "Equipe com permissões",
        text: "Convide instrutores por e-mail. Cada um vê apenas os clientes das modalidades pelas quais é responsável.",
      },
      {
        icon: "clock",
        title: "Lista de espera",
        text: "Guarde nome, telefone e período de quem aguarda uma vaga, na ordem em que chegou.",
      },
      {
        icon: "archive",
        title: "Documentos do cliente",
        text: "Guarde exames e outros documentos em armazenamento privado, com até 10 MB por arquivo.",
      },
      {
        icon: "repeat",
        title: "Mais de uma modalidade",
        text: "Um cliente pode fazer Pilates e acupuntura, com um instrutor responsável em cada uma.",
      },
      {
        icon: "shield",
        title: "Cada estúdio no seu espaço",
        text: "Os dados do seu estúdio não aparecem para nenhum outro. Os registros são de saúde e tratados como tal.",
      },
    ],
  },
  modalities: { title: "Modalidades disponíveis", items: ["Pilates", "Acupuntura"] },
  cta: {
    title: "Comece pelo seu estúdio",
    text: "Crie sua conta, escolha as modalidades e convide sua equipe.",
    button: "Criar conta",
  },
  footer: { rights: "Todos os direitos reservados." },
} as const;
