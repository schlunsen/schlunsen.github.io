export interface Project {
  name: string;
  desc: string;
  tags: string[];
  repo?: string;
  site?: string;
  shots: string[];
  books?: boolean;
  /** Shown in the terminal doodle when there are no screenshots. */
  install?: string;
  /** A short film, played in the big-screen player (label is the button text, about is its accessible description). */
  video?: { src: string; poster: string; label: string; about: string };
  /** Not public yet: no links, shown with a stamp. */
  private?: boolean;
  /** A PAL colour name, used for the card's tape and number. */
  tint: 'clay' | 'teal' | 'ochre' | 'rose' | 'sap' | 'violet' | 'indigo' | 'sky';
}

export const projects: Project[] = [
  {
    name: 'n0',
    desc: 'The AI workspace for teams, built at Clovr Labs. Chat, files, calendar, automations and agents in one private, encrypted space.',
    tags: ['AI', 'Workspace', 'Agents'],
    site: 'https://nzero.pro',
    shots: ['/n0-home.webp', '/n0-og.webp'],
    tint: 'indigo',
  },
  {
    name: 'Claude Agent SDK Go',
    desc: 'Build Claude agents in Go. A port of the official Python SDK: idiomatic, zero dependencies, full streaming.',
    tags: ['Go', 'AI', 'SDK'],
    repo: 'https://github.com/schlunsen/claude-agent-sdk-go',
    site: 'https://schlunsen.github.io/claude-agent-sdk-go/',
    shots: ['/claude-sdk-go.webp'],
    tint: 'teal',
  },
  {
    name: 'Gource Viewer',
    desc: 'Any repo’s history as an animated film, in the browser. Exports MP4s with title card, leaderboard and music.',
    tags: ['Visualization', 'Dev tools'],
    repo: 'https://github.com/schlunsen/gource-view',
    site: 'https://schlunsen.github.io/gource-view/',
    shots: ['/gource-app.webp', '/gource-history.webp', '/gource-title-card.webp', '/gource-leaderboard.webp'],
    tint: 'sky',
  },
  {
    name: 'Gitilla',
    desc: 'Your GitHub as a little living city. Gitoply turns it into a board game: solo against AI or with family on one screen.',
    tags: ['Visualization', 'Three.js', 'Games'],
    site: 'https://gitilla.com',
    shots: ['/gitilla-home.webp', '/gitilla-board.webp', '/gitilla-city.webp'],
    tint: 'sap',
  },
  {
    name: 'Codex SDK Go',
    desc: 'Embed the Codex coding agent in Go services, CLIs and CI. Streaming, structured output, sandboxing. Stdlib only.',
    tags: ['Go', 'AI', 'SDK'],
    repo: 'https://github.com/schlunsen/codex-sdk-go',
    site: 'https://pkg.go.dev/github.com/schlunsen/codex-sdk-go',
    shots: [],
    install: 'go get github.com/schlunsen/codex-sdk-go',
    tint: 'indigo',
  },
  {
    name: 'wee.cat',
    desc: 'Learn to read, the fun way. Ten reading games for ages 5 to 12, in three worlds that grow with the child. Adaptive, dyslexia-friendly, Catalan first.',
    tags: ['EdTech', 'Games', 'Kids'],
    site: 'https://wee.cat',
    shots: ['/wee-home.webp', '/wee-worlds.webp', '/wee-games.webp', '/wee-mobile.webp'],
    video: { src: '/media/wee/tour.mp4', poster: '/media/wee/tour-poster.webp', label: 'Watch the tour', about: 'A one-minute tour of wee, narrated in English: the three worlds and a few of the ten reading games.' },
    tint: 'violet',
  },
  {
    name: 'Donna',
    desc: 'Autonomous AI pentesting: Claude Code agents, orchestrated with Temporal, finding and exploiting vulnerabilities.',
    tags: ['Security', 'AI'],
    shots: [],
    private: true,
    tint: 'rose',
  },
  {
    name: 'The Agentic Crew',
    desc: 'Three free books on agentic engineering, for developers, non-coders and teams. Four languages, with an audiobook.',
    tags: ['Books', 'AI', 'Free'],
    repo: 'https://github.com/schlunsen/theagenticcrew',
    site: 'https://theagenticcrew.com',
    shots: [
      'https://theagenticcrew.com/book-cover.png',
      'https://theagenticcrew.com/book-cover-crew.png',
      '/book-cover-handson.webp',
    ],
    books: true,
    tint: 'ochre',
  },
  {
    name: 'Hefty',
    desc: 'Fast disk usage analyzer, CLI and native macOS app. Find the hefty files hogging your disk.',
    tags: ['Rust', 'macOS', 'TUI'],
    repo: 'https://github.com/schlunsen/hefty',
    site: 'https://schlunsen.github.io/hefty/',
    shots: [
      'https://raw.githubusercontent.com/schlunsen/hefty/main/screenshots/mac-app.png',
      'https://raw.githubusercontent.com/schlunsen/hefty/main/screenshots/cli-tui.png',
    ],
    tint: 'rose',
  },
];

/** Smaller things on the bench. Only link what is public. */
export const bench: { name: string; note: string; url?: string }[] = [
  { name: 'Maperick', note: 'TCP connections on a world map, TUI + Mac app', url: 'https://schlunsen.github.io/maperick/' },
  { name: 'Radio CLI', note: 'internet radio in the terminal and the menu bar', url: 'https://schlunsen.github.io/radio-cli/' },
  { name: 'Web Presenter', note: 'Three.js slides with narration', url: 'https://schlunsen.github.io/web-presenter/' },
  { name: 'nuxt-leaflet', note: 'Leaflet for Nuxt, ~200★', url: 'https://github.com/schlunsen/nuxt-leaflet' },
  { name: 'Wee Editor', note: 'AI & infrastructure' },
  { name: 'Straw Draw', note: 'iPad · Swift' },
];

export const story: { when: string; title: string; em: string; body: string; tint: Project['tint']; link?: { href: string; label: string }; brief?: boolean }[] = [
  { when: '2008–2011 · Esbjerg', title: 'Computer science.', em: 'Three years.', body: 'Business Academy West, now SEA.', tint: 'sky', brief: true, link: { href: 'https://www.s-e-a.dk/', label: 's-e-a.dk' } },
  { when: '2010', title: 'It started', em: 'with security.', body: 'My first job, while still studying: an internship at a security company, 45 minutes away. I had to buy a car to get there, so it cost more than it paid. Worth every krone for what I learned.', tint: 'rose' },
  { when: 'Final project', title: 'Built in Unity3D,', em: 'while it was brand new.', body: 'My final project, in a young Danish engine that had only just reached Windows and gone free.', tint: 'violet' },
  { when: 'Agency', title: 'Full stack,', em: 'full speed.', body: 'Front to back at a young agency.', tint: 'ochre' },
  { when: 'Freelance · 5 yrs', title: 'OrbiSCADA.', em: 'Wind, at scale.', body: 'Drove the SCADA system for wind turbines: from one in Denmark to 1,500+ across Denmark, the UK, the USA and Japan. Along the way, Orbital won Børsen Gazelle’s 2018 manufacturing prize for Central Jutland.', tint: 'teal' },
  { when: 'Clovr Labs', title: 'Following', em: 'the money.', body: 'Crypto forensic analytics: blockchain compliance and risk analysis.', tint: 'sap' },
  { when: 'Now', title: 'The workspace', em: 'of the future.', body: 'n0: people, agents and apps in one place.', tint: 'clay', link: { href: 'https://nzero.pro', label: 'nzero.pro' } },
];
