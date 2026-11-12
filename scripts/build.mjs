// Builds the site into dist/: fetches GitHub data, fills the template, copies assets.
// Usage: GH_TOKEN=<token> node scripts/build.mjs
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';

const LOGIN = 'TingGeorge';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const headers = {
  'User-Agent': 'personal-site-build',
  Accept: 'application/vnd.github+json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

// Full data: contribution calendar + counts. Needs a token (GraphQL has no anonymous access).
async function fetchGraphQL() {
  if (!TOKEN) throw new Error('no token');
  const query = `query($login: String!) {
    user(login: $login) {
      followers { totalCount }
      repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100) {
        totalCount
        nodes { stargazerCount }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount contributionLevel } }
        }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors || !json.data?.user) {
    throw new Error(`GraphQL failed: ${res.status} ${JSON.stringify(json.errors ?? json.message ?? '')}`);
  }
  const u = json.data.user;
  const cal = u.contributionsCollection.contributionCalendar;
  return {
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((n, r) => n + r.stargazerCount, 0),
    followers: u.followers.totalCount,
    total: cal.totalContributions,
    weeks: cal.weeks.map((w) => w.contributionDays.map((d) => ({
      date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0,
    }))),
  };
}

// Fallback: counts only, from the public REST API (works without a token, rate limited).
async function fetchRest() {
  const get = async (url) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`REST failed: ${res.status} ${url}`);
    return res.json();
  };
  const user = await get(`https://api.github.com/users/${LOGIN}`);
  const repos = await get(`https://api.github.com/users/${LOGIN}/repos?per_page=100&type=owner`);
  return {
    repos: user.public_repos,
    stars: repos.reduce((n, r) => n + (r.stargazers_count || 0), 0),
    followers: user.followers,
    total: null,
    weeks: null,
  };
}

const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

function renderGithub(data) {
  if (!data) {
    return '      <p class="stats">See what I am working on at <a class="link" href="https://github.com/TingGeorge">github.com/TingGeorge</a>.</p>';
  }
  const parts = [];
  if (data.weeks) {
    const cells = data.weeks
      .map((week) => week.map((d) => `<span class="l${d.level}" title="${d.count} on ${d.date}"></span>`).join(''))
      .join('');
    // The first week can be partial; pad it so every column starts on Sunday.
    const pad = '<span style="visibility:hidden"></span>'.repeat(7 - data.weeks[0].length);
    const summary = `${plural(data.total, 'contribution', 'contributions')} in the last 12 months`;
    parts.push(
      `      <div class="contrib" role="img" aria-label="${summary}">${pad}${cells}</div>`,
      `      <div class="contrib-meta"><span>${summary}</span>` +
        '<span class="legend">Less <i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More</span></div>',
    );
  }
  parts.push(
    `      <p class="stats">${plural(data.repos, 'repository', 'repositories')}, ${plural(data.stars, 'star', 'stars')}, ${plural(data.followers, 'follower', 'followers')}</p>`,
  );
  return parts.join('\n');
}

let data = null;
try {
  data = await fetchGraphQL();
  console.log(`GitHub data: ${data.total} contributions, ${data.repos} repos, ${data.stars} stars, ${data.followers} followers`);
} catch (err) {
  console.warn(`Contribution calendar unavailable (${err.message}). Falling back to counts only.`);
  try {
    data = await fetchRest();
    console.log(`GitHub data (counts only): ${data.repos} repos, ${data.stars} stars, ${data.followers} followers`);
  } catch (err2) {
    console.warn(`GitHub counts unavailable too (${err2.message}). Building without them.`);
  }
}

const template = await readFile('src/template.html', 'utf8');
const html = template
  .replace('<!--GITHUB-->', renderGithub(data))
  .replace('<!--YEAR-->', String(new Date().getUTCFullYear()));

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('src/styles.css', 'dist/styles.css');
await writeFile('dist/index.html', html);
await writeFile('dist/.nojekyll', '');
console.log('Built dist/');
