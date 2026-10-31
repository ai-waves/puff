import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { COLLECTIONS, LEVEL_FIELDS, SCHEMA } from './game/levels/schema';

// The docs that agents and people work from stay true to the code. Every path they name exists, every
// link resolves, every npm script they run is defined, every level field is in the field reference,
// and the path rules written for Claude Code and for Antigravity say the same thing.

const docs = import.meta.glob(['/*.md', '/docs/**/*.md', '/design/README.md', '/.claude/**/*.md', '/.agents/**/*.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Every file in the repo that docs might name. Only the keys are used; nothing is imported.
// (A glob leaves out the module running it, so this file adds itself.)
const files = [
  '/src/docs.test.ts',
  ...Object.keys(
    import.meta.glob([
      '/*.{md,json,ts,html}',
      '/.nvmrc',
      '/.gitignore',
      '/src/**/*',
      '/scripts/**/*',
      '/docs/**/*',
      '/design/**/*',
      '/.claude/**/*',
      '/.agents/**/*',
    ]),
  ),
];
const exists = (path: string) => {
  const p = '/' + path.replace(/^\/+/, '');
  return p.endsWith('/') ? files.some((f) => f.startsWith(p)) : files.includes(p) || files.some((f) => f.startsWith(p + '/'));
};

// `src/game/sim.ts`-style mentions of paths from the repo root. Patterns and placeholders
// (`data/<id>.json`, `*.slow.test.ts`) aren't checked.
const ROOTS = /^(src|docs|design|scripts|\.claude|\.agents)\/|^(AGENTS|CLAUDE|README)\.md$|^(vite|vitest|capacitor)\.config\.ts$|^(package|tsconfig)\.json$|^\.nvmrc$/;
function mentionedPaths(text: string): string[] {
  return [...text.matchAll(/`([^`\s]+)`/g)]
    .map((m) => m[1]!.replace(/[.,:;]$/, ''))
    .filter((p) => ROOTS.test(p) && !/[<>*{}$]/.test(p));
}

function links(text: string): string[] {
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!).filter((l) => !/^(https?:|mailto:|#)/.test(l));
}

function resolve(from: string, link: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const seg of link.split('#')[0]!.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/') + (link.split('#')[0]!.endsWith('/') ? '/' : '');
}

const body = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n+/, '');

describe('documentation', () => {
  it('finds the docs it checks', () => {
    for (const f of ['/AGENTS.md', '/CLAUDE.md', '/docs/STATUS.md', '/docs/LEVELS.md', '/.claude/rules/sim.md', '/.agents/rules/project.md']) {
      expect(Object.keys(docs), f).toContain(f);
    }
  });

  it.each(Object.keys(docs))('%s only names files that exist', (doc) => {
    const missing = mentionedPaths(docs[doc]!).filter((p) => !exists(p));
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(docs))('%s only links to files that exist', (doc) => {
    const broken = links(docs[doc]!).filter((l) => !exists(resolve(doc, l)));
    expect(broken).toEqual([]);
  });

  it('only runs npm scripts that package.json defines', () => {
    const scripts = pkg.scripts as Record<string, string>;
    for (const [doc, text] of Object.entries(docs)) {
      for (const m of text.matchAll(/npm run (?:-s )?([\w:-]*\w)/g)) expect(scripts, `${doc}: npm run ${m[1]}`).toHaveProperty([m[1]!]);
    }
  });

  it('lists every level field in the field reference, under its kind', () => {
    const ref = docs['/docs/LEVELS.md']!;
    const sections = ref.split('\n### ').slice(1);
    const section = (heading: (h: string) => boolean) => sections.find((s) => heading(s.split('\n')[0]!)) ?? '';
    for (const c of COLLECTIONS) {
      const text = section((h) => h.includes(`\`${c}\``));
      expect(text, `a "### ... \`${c}\`" section`).not.toBe('');
      for (const f of SCHEMA[c].fields) if (f.key !== 'id' && f.key !== 'note') expect(text, `${c}.${f.key}`).toContain(`\`${f.key}\``);
    }
    const level = section((h) => h === 'Level');
    for (const f of LEVEL_FIELDS) expect(level, `level ${f.key}`).toContain(`\`${f.key}\``);
  });

  it('gives Claude Code and Antigravity the same path rules', () => {
    const claude = Object.keys(docs).filter((d) => d.startsWith('/.claude/rules/'));
    expect(claude.length).toBeGreaterThan(0);
    for (const c of claude) {
      const twin = c.replace('/.claude/', '/.agents/');
      expect(Object.keys(docs), twin).toContain(twin);
      expect(body(docs[twin]!), twin).toBe(body(docs[c]!));
    }
  });

  it('pairs every Claude skill with an Antigravity workflow that runs the same playbook', () => {
    const skills = Object.keys(docs).filter((d) => /^\/\.claude\/skills\/[^/]+\/SKILL\.md$/.test(d));
    expect(skills.length).toBeGreaterThan(0);
    for (const s of skills) {
      const name = s.split('/')[3]!;
      const workflow = docs[`/.agents/workflows/${name}.md`];
      expect(workflow, `.agents/workflows/${name}.md`).toBeDefined();
      const playbook = /docs\/playbooks\/[\w-]+\.md/.exec(docs[s]!)?.[0];
      expect(playbook, `${s} names a playbook`).toBeDefined();
      expect(exists(playbook!), playbook).toBe(true);
      expect(workflow).toContain(`@/${playbook}`);
    }
  });
});
