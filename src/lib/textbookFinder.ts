/**
 * Search for free college textbook PDFs via Open Library / Internet Archive API.
 * Falls back to a curated list of OpenStax OER titles when the API is unavailable.
 */

export interface TextbookResult {
  title: string;
  author: string;
  url: string;
  isbn?: string;
  edition?: string;
  source: string;
  available: boolean; // true = free full-text accessible right now
}

// ── Open Library search response shapes ─────────────────────────────────────

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  isbn?: string[];
  ia?: string[];
  has_fulltext?: boolean;
  public_scan_b?: boolean;
  ebook_access?: string;
  edition_count?: number;
  first_publish_year?: number;
}

interface OLSearchResponse {
  docs: OLDoc[];
  numFound: number;
}

const OPEN_LIBRARY_FIELDS =
  "key,title,author_name,isbn,ia,has_fulltext,public_scan_b,ebook_access,edition_count,first_publish_year";
const OPEN_LIBRARY_FETCH_LIMIT = 40;
const MAX_RESULTS = 12;

const EXTERNAL_FREE_PDF_SOURCES: Array<{
  name: string;
  buildUrl: (encoded: string) => string;
}> = [
  {
    name: "Internet Archive",
    buildUrl: (encoded) => `https://archive.org/search?query=${encoded}`,
  },
  {
    name: "Open Library",
    buildUrl: (encoded) => `https://openlibrary.org/search?q=${encoded}`,
  },
];

const COURSE_QUERY_EXPANSIONS: Record<string, string[]> = {
  cs: [
    "computer science",
    "programming",
    "data structures",
    "algorithms",
    "discrete mathematics",
  ],
  "computer science": [
    "computer science",
    "programming",
    "software engineering",
    "data structures and algorithms",
  ],
  nursing: ["nursing", "nursing policy", "health care policy", "community health nursing"],
  biology: ["biology", "general biology", "introductory biology"],
  chemistry: ["chemistry", "general chemistry", "organic chemistry"],
  physics: ["physics", "college physics", "university physics"],
  calculus: ["calculus", "calculus early transcendentals", "differential calculus"],
  statistics: ["statistics", "probability and statistics", "introductory statistics"],
  psychology: ["psychology", "introduction to psychology", "abnormal psychology"],
  economics: ["economics", "microeconomics", "macroeconomics"],
  government: ["american government", "political science", "public policy"],
  history: ["world history", "us history", "western civilization"],
};

// NJIT-focused course aliasing to boost required-textbook discovery.
const NJIT_COURSE_EXPANSIONS: Array<{ pattern: RegExp; expansions: string[] }> = [
  {
    pattern: /\bcs\s*100\b/i,
    expansions: ["roadmap to computing", "computing fundamentals", "computer literacy"],
  },
  {
    pattern: /\bcs\s*113\b/i,
    expansions: ["python programming", "introduction to programming", "programming in python"],
  },
  {
    pattern: /\bcs\s*114\b/i,
    expansions: ["data structures", "objects first with java", "algorithms and data structures"],
  },
  {
    pattern: /\bcs\s*241\b/i,
    expansions: ["foundations of computer science", "discrete mathematics and its applications", "discrete math"],
  },
  {
    pattern: /\bcs\s*280\b/i,
    expansions: ["programming language concepts", "computer systems", "c programming language"],
  },
  {
    pattern: /\bcs\s*288\b/i,
    expansions: ["intensive programming in linux", "linux programming", "unix programming"],
  },
  {
    pattern: /\bcs\s*331\b/i,
    expansions: ["database systems", "database system concepts", "sql database systems"],
  },
  {
    pattern: /\bcs\s*332\b/i,
    expansions: ["principles of operating systems", "operating system concepts", "modern operating systems"],
  },
  {
    pattern: /\bcs\s*341\b/i,
    expansions: ["computer networks", "computer networking a top down approach", "networking"],
  },
  {
    pattern: /\bcs\s*350\b/i,
    expansions: ["introduction to cyber security", "computer security", "network security essentials"],
  },
  {
    pattern: /\bcs\s*435\b/i,
    expansions: ["machine learning", "pattern recognition and machine learning", "deep learning"],
  },
  {
    pattern: /\bis\s*117\b/i,
    expansions: ["web systems development", "web development", "internet applications"],
  },
  {
    pattern: /\bit\s*202\b/i,
    expansions: ["internet applications", "web programming", "full stack web development"],
  },
];

// ── Curated OER fallback list ────────────────────────────────────────────────

const OER_FALLBACK: TextbookResult[] = [
  {
    title: "Think Python: How to Think Like a Computer Scientist",
    author: "Allen B. Downey",
    url: "https://greenteapress.com/wp/think-python-2e/",
    isbn: "978-1491939369",
    edition: "2nd",
    source: "Green Tea Press",
    available: true,
  },
  {
    title: "Open Data Structures",
    author: "Pat Morin",
    url: "https://opendatastructures.org/",
    isbn: "978-1921983252",
    edition: "Open Edition",
    source: "Open Data Structures",
    available: true,
  },
  {
    title: "Operating Systems: Three Easy Pieces",
    author: "Remzi H. Arpaci-Dusseau, Andrea C. Arpaci-Dusseau",
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/",
    isbn: "N/A",
    edition: "Open Edition",
    source: "OSTEP",
    available: true,
  },
  {
    title: "Computer Networking: Principles, Protocols and Practice",
    author: "Olivier Bonaventure",
    url: "https://www.computer-networking.info/",
    isbn: "N/A",
    edition: "Open Edition",
    source: "Computer Networking Info",
    available: true,
  },
  {
    title: "Database Design - 2nd Edition",
    author: "Adrienne Watt, Nelson Eng",
    url: "https://opentextbc.ca/dbdesign01/",
    isbn: "978-1-77420-010-0",
    edition: "2nd",
    source: "Open Textbook BC",
    available: true,
  },
  {
    title: "The Missing Semester of Your CS Education",
    author: "MIT",
    url: "https://missing.csail.mit.edu/",
    isbn: "N/A",
    edition: "Open Course",
    source: "MIT",
    available: true,
  },
  {
    title: "Software Engineering at Google",
    author: "Titus Winters, Tom Manshreck, Hyrum Wright",
    url: "https://abseil.io/resources/swe-book",
    isbn: "978-1492082798",
    edition: "Open Web Edition",
    source: "Google/Abseil",
    available: true,
  },
  {
    title: "Dive Into Systems",
    author: "Suzanne J. Matthews, Tia Newhall, Kevin C. Webb",
    url: "https://diveintosystems.org/",
    isbn: "N/A",
    edition: "Open Edition",
    source: "Dive Into Systems",
    available: true,
  },
  {
    title: "Introduction to Algorithms (course notes and open companions)",
    author: "Multiple Open Sources",
    url: "https://opendatastructures.org/newhtml/ods/latex/intro.html",
    isbn: "N/A",
    edition: "Open Companion",
    source: "Open Data Structures",
    available: true,
  },
  {
    title: "Calculus: Early Transcendentals",
    author: "David Guichard",
    url: "https://www.whitman.edu/mathematics/calculus_online/",
    isbn: "N/A",
    edition: "Open Edition",
    source: "Whitman College",
    available: true,
  },
  {
    title: "Biology 2e",
    author: "Mary Ann Clark",
    url: "https://openstax.org/details/books/biology-2e",
    isbn: "978-1-938168-12-2",
    edition: "2nd",
    source: "OpenStax",
    available: true,
  },
  {
    title: "Chemistry: Atoms First",
    author: "Julia Burdge",
    url: "https://openstax.org/details/books/chemistry-atoms-first",
    isbn: "978-1-947172-55-0",
    edition: "2nd",
    source: "OpenStax",
    available: true,
  },
  {
    title: "Physics",
    author: "Paul Peter Urone & Roger Hinrichs",
    url: "https://openstax.org/details/books/physics",
    isbn: "978-1-947172-20-8",
    edition: "Open Edition",
    source: "OpenStax",
    available: true,
  },
  {
    title: "American Government",
    author: "OpenStax",
    url: "https://openstax.org/details/books/american-government",
    isbn: "978-1-938168-17-7",
    edition: "2nd",
    source: "OpenStax",
    available: true,
  },
  {
    title: "Economics 2e",
    author: "OpenStax",
    url: "https://openstax.org/details/books/economics-2e",
    isbn: "978-1-947172-30-7",
    edition: "2e",
    source: "OpenStax",
    available: true,
  },
  {
    title: "Introduction to Psychology",
    author: "Paul Cruce & Carrie Cutting",
    url: "https://open.umn.edu/opentextbooks/textbooks/introduction-to-psychology",
    isbn: "N/A",
    edition: "1st",
    source: "Open Textbook Library",
    available: true,
  },
  {
    title: "Organic Chemistry",
    author: "UC Davis Chemistry Wiki",
    url: "https://chem.libretexts.org/Courses/University_of_California_Davis/UCD_Chem_124A%3A_Organic_Chemistry_I_(Larsen)",
    isbn: "N/A",
    edition: "Open LibreTexts",
    source: "LibreTexts Chemistry",
    available: true,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function olDocToResult(doc: OLDoc): TextbookResult {
  const author = doc.author_name?.join(", ") ?? "Unknown Author";
  const isbn = doc.isbn?.[0] ?? undefined;
  const edition = doc.edition_count ? `${doc.edition_count} edition(s)` : undefined;
  const access = (doc.ebook_access ?? "").toLowerCase();
  const isPublic = access === "public" || Boolean(doc.public_scan_b);
  const isBorrowable = access === "borrowable";
  const isPrintDisabledOnly = access === "printdisabled";

  // Prefer a direct Internet Archive link when the book has a free full scan
  let url: string;
  let source: string;

  if (isPublic && doc.ia?.length) {
    url = `https://archive.org/details/${doc.ia[0]}`;
    source = "Internet Archive (free download)";
  } else if (isBorrowable && doc.ia?.length) {
    // Borrowable via Internet Archive's free Controlled Digital Lending
    url = `https://archive.org/details/${doc.ia[0]}`;
    source = "Internet Archive (free borrow)";
  } else if (isPrintDisabledOnly && doc.ia?.length) {
    url = `https://archive.org/details/${doc.ia[0]}`;
    source = "Internet Archive (print-disabled only)";
  } else {
    url = `https://openlibrary.org${doc.key}`;
    source = "Open Library";
  }

  return {
    title: doc.title,
    author,
    url,
    isbn,
    edition,
    source,
    available: isPublic || isBorrowable,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Strip edition numbers and common noise terms from a search query so
 * Open Library can find books regardless of edition specificity.
 * e.g. "biology 8th edition PDF" → "biology"
 */
function cleanQuery(query: string): string {
  return query
    .replace(/\b\d+\s*(?:st|nd|rd|th)\s*(?:edition|ed\.?)\b/gi, "") // "8th edition", "3rd ed"
    .replace(/\b(?:edition|ed\.?|volume|vol\.?|revised|textbook|pdf|free|ebook|e-book)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function uniquePush(target: string[], value: string): void {
  const normalized = value.trim();
  if (normalized.length > 0 && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function queryTokens(query: string): string[] {
  const tokens = cleanQuery(query)
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 3)
    .filter((token) => !/^(for|the|and|with|from|into|your|need|looking|course|required|class|section|njit)$/.test(token))
    .filter((token) => !/^\d+$/.test(token));

  return Array.from(new Set(tokens));
}

type QueryIntent = {
  titleTokens: string[];
  authorTokens: string[];
  strict: boolean;
};

function parseQueryIntent(rawQuery: string): QueryIntent {
  const cleaned = cleanQuery(rawQuery);
  const byMatch = cleaned.match(/\bby\b(.+)$/i);

  const titlePart = byMatch ? cleaned.replace(/\bby\b.+$/i, "").trim() : cleaned;
  const authorPart = byMatch ? byMatch[1].trim() : "";

  const titleTokens = queryTokens(titlePart);
  const authorTokens = queryTokens(authorPart);
  const strict = authorTokens.length > 0 || /"/.test(rawQuery) || titleTokens.length >= 5;

  return { titleTokens, authorTokens, strict };
}

function countTokenHits(haystack: string, tokens: string[]): number {
  let hits = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      hits += 1;
    }
  }
  return hits;
}

function matchesIntent(result: TextbookResult, intent: QueryIntent): boolean {
  const title = result.title.toLowerCase();
  const author = result.author.toLowerCase();
  const titleHits = countTokenHits(title, intent.titleTokens);
  const authorHits = countTokenHits(author, intent.authorTokens);

  if (!intent.strict) {
    return titleHits > 0 || authorHits > 0;
  }

  const requiredTitleHits = intent.titleTokens.length <= 2
    ? 1
    : Math.max(2, Math.ceil(intent.titleTokens.length * 0.5));

  if (intent.authorTokens.length > 0) {
    // Prefer title+author matches, but allow strong title-only matches when
    // metadata does not include full author names.
    return titleHits >= requiredTitleHits &&
      (authorHits >= 1 || titleHits >= requiredTitleHits + 1);
  }

  return titleHits >= requiredTitleHits;
}

function relevanceScore(result: TextbookResult, tokens: string[]): number {
  if (tokens.length === 0) {
    return 1;
  }

  const haystackTitle = result.title.toLowerCase();
  const haystackAuthor = result.author.toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (haystackTitle.includes(token)) {
      score += 3;
    }
    if (haystackAuthor.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function buildExternalFreePdfLinks(query: string): TextbookResult[] {
  const encoded = encodeURIComponent(cleanQuery(query) || query);
  return EXTERNAL_FREE_PDF_SOURCES.map((source) => ({
    title: `Search free textbooks on ${source.name}`,
    author: "N/A",
    url: source.buildUrl(encoded),
    edition: "Search link",
    source: `Free PDF Source (${source.name})`,
    available: true,
  }));
}

function accessPriority(result: TextbookResult): number {
  if (result.source.includes("free download")) return 0;
  if (result.source.includes("free borrow")) return 1;
  if (result.source.includes("Open Library")) return 2;
  if (result.source.startsWith("Free PDF Source")) return 3;
  return 4;
}

function buildQueryVariants(rawQuery: string): string[] {
  const variants: string[] = [];
  const original = rawQuery.trim();
  const cleaned = cleanQuery(original);

  uniquePush(variants, original);
  uniquePush(variants, cleaned);
  uniquePush(variants, cleaned.replace(/&/g, "and"));

  const lowered = cleaned.toLowerCase();

  for (const [keyword, expansions] of Object.entries(COURSE_QUERY_EXPANSIONS)) {
    if (lowered.includes(keyword)) {
      for (const expansion of expansions) {
        uniquePush(variants, expansion);
      }
    }
  }

  for (const mapping of NJIT_COURSE_EXPANSIONS) {
    if (mapping.pattern.test(rawQuery) || mapping.pattern.test(cleaned)) {
      for (const expansion of mapping.expansions) {
        uniquePush(variants, expansion);
      }
    }
  }

  if (/\bnjit\b/i.test(rawQuery) || /\bnjit\b/i.test(cleaned)) {
    uniquePush(variants, cleaned.replace(/\bnjit\b/gi, ""));
    uniquePush(variants, "computer science textbook");
    uniquePush(variants, "engineering textbook");
  }

  // Add a broader fallback made from meaningful words only.
  const broad = cleaned
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .filter((word) => !/^(for|the|and|with|from|into|your|my|our|need|looking)$/i.test(word))
    .slice(0, 6)
    .join(" ");
  uniquePush(variants, broad);

  return variants.slice(0, 8);
}

async function fetchOpenLibraryDocs(query: string): Promise<OLDoc[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://openlibrary.org/search.json?q=${encoded}&fields=${OPEN_LIBRARY_FIELDS}&limit=${OPEN_LIBRARY_FETCH_LIMIT}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "TextbookFinder/1.0 (college student tool)" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Open Library returned ${response.status}`);
  }

  const data = (await response.json()) as OLSearchResponse;
  return data.docs ?? [];
}

/**
 * Search Open Library for textbooks matching the query.
 * Falls back to the curated OER list if the network request fails.
 * Returns up to 5 results sorted by availability (free first).
 */
export async function findTextbookPDF(query: string): Promise<TextbookResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const queryVariants = buildQueryVariants(query);
  const tokens = queryTokens(queryVariants.join(" "));
  const intent = parseQueryIntent(query);
  const aggregated = new Map<string, TextbookResult>();
  let networkFailed = false;

  for (const q of queryVariants) {
    try {
      const docs = await fetchOpenLibraryDocs(q);
      for (const doc of docs) {
        const result = olDocToResult(doc);
        const dedupeKey = `${result.title.toLowerCase()}::${result.author.toLowerCase()}`;
        if (!aggregated.has(dedupeKey)) {
          aggregated.set(dedupeKey, result);
        }
      }

      // Stop early once we have plenty of candidates.
      if (aggregated.size >= OPEN_LIBRARY_FETCH_LIMIT) {
        break;
      }
    } catch {
      networkFailed = true;
    }
  }

  const results = Array.from(aggregated.values()).filter(
    (result) =>
      relevanceScore(result, tokens) > 0 &&
      matchesIntent(result, intent) &&
      !result.source.includes("print-disabled only"),
  );
  const externalLinks = buildExternalFreePdfLinks(query);
  const combined = new Map<string, TextbookResult>();

  for (const result of [...results, ...externalLinks]) {
    const dedupeKey = `${result.title.toLowerCase()}::${result.url.toLowerCase()}`;
    if (!combined.has(dedupeKey)) {
      combined.set(dedupeKey, result);
    }
  }

  const mergedResults = Array.from(combined.values());

  if (mergedResults.length > 0) {
    // Sort by relevance first, then by access type.
    mergedResults.sort((a, b) => {
      const rel = relevanceScore(b, tokens) - relevanceScore(a, tokens);
      if (rel !== 0) {
        return rel;
      }
      return accessPriority(a) - accessPriority(b);
    });

    return mergedResults.slice(0, MAX_RESULTS);
  }

  // Network unavailable or no results — fall back to curated OER list.
  if (networkFailed) {
    return fallbackSearch(query);
  }

  return fallbackSearch(query);
}

/** Search the local curated OER list (used as offline fallback). */
function fallbackSearch(query: string): TextbookResult[] {
  const variants = buildQueryVariants(query).map((value) => value.toLowerCase());
  const tokens = queryTokens(variants.join(" "));

  const results = OER_FALLBACK.filter((book) => {
    const title = book.title.toLowerCase();
    const author = book.author.toLowerCase();
    const source = book.source.toLowerCase();

    const variantMatch = variants.some(
      (term) =>
        title.includes(term) ||
        author.includes(term) ||
        source.includes(term) ||
        term.includes(title.split(":")[0].trim()),
    );

    return variantMatch || relevanceScore(book, tokens) > 0;
  });

  const merged = [...results, ...buildExternalFreePdfLinks(query)];
  merged.sort((a, b) => {
    const rel = relevanceScore(b, tokens) - relevanceScore(a, tokens);
    if (rel !== 0) {
      return rel;
    }
    return accessPriority(a) - accessPriority(b);
  });

  return merged.slice(0, MAX_RESULTS);
}

/**
 * Get detailed textbook information by exact title match (uses OER fallback list).
 */
export function getTextbookDetails(title: string): TextbookResult | null {
  return OER_FALLBACK.find((b) => b.title.toLowerCase() === title.toLowerCase()) ?? null;
}

/**
 * List all available subjects from the curated OER list.
 */
export function listSubjects(): string[] {
  const subjects = new Set<string>();
  OER_FALLBACK.forEach((book) => {
    subjects.add(book.title.split(":")[0].trim());
  });
  return Array.from(subjects).sort();
}

// ── AI counselor source finder (Sun Tzu + Project Gutenberg) ───────────────

interface GutendexAuthor {
  name: string;
}

interface GutendexFormats {
  [format: string]: string | undefined;
}

interface GutendexBook {
  title: string;
  authors?: GutendexAuthor[];
  languages?: string[];
  formats?: GutendexFormats;
}

interface GutendexResponse {
  results?: GutendexBook[];
}

function pickBestReadableFormat(formats: GutendexFormats | undefined): string | null {
  if (!formats) {
    return null;
  }

  const prioritizedFormats = [
    "text/html",
    "application/epub+zip",
    "text/plain; charset=utf-8",
    "text/plain",
    "application/octet-stream",
  ];

  for (const formatKey of prioritizedFormats) {
    const url = formats[formatKey];
    if (url && typeof url === "string") {
      return url;
    }
  }

  return null;
}

function buildSunTzuSources(): TextbookResult[] {
  return [
    {
      title: "The Art of War",
      author: "Sun Tzu (translated by Lionel Giles)",
      url: "https://www.gutenberg.org/ebooks/132",
      edition: "Public Domain",
      source: "Project Gutenberg",
      available: true,
    },
    {
      title: "The Art of War (Plain Text)",
      author: "Sun Tzu (translated by Lionel Giles)",
      url: "https://www.gutenberg.org/cache/epub/132/pg132.txt",
      edition: "Public Domain",
      source: "Project Gutenberg",
      available: true,
    },
  ];
}

/**
 * Find counselor reading sources focused on strategic judgment,
 * human skills, and character development.
 */
export async function findCounselorSources(query: string): Promise<TextbookResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return buildSunTzuSources();
  }

  const strategyQuery = `${trimmed} leadership character judgment`; 
  const encoded = encodeURIComponent(strategyQuery);
  const gutendexUrl = `https://gutendex.com/books?search=${encoded}`;

  const baseResults = buildSunTzuSources();

  try {
    const response = await fetch(gutendexUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "IS219-Counselor/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Gutendex returned ${response.status}`);
    }

    const payload = (await response.json()) as GutendexResponse;
    const books = payload.results ?? [];

    const mapped: TextbookResult[] = books
      .filter((book) => (book.languages ?? []).includes("en") || !book.languages?.length)
      .map((book) => {
        const url = pickBestReadableFormat(book.formats) ?? "https://www.gutenberg.org/";
        const author = book.authors?.map((a) => a.name).join(", ") || "Unknown Author";

        return {
          title: book.title,
          author,
          url,
          edition: "Public Domain",
          source: "Project Gutenberg",
          available: true,
        };
      })
      .slice(0, 8);

    const deDupe = new Map<string, TextbookResult>();
    for (const result of [...baseResults, ...mapped]) {
      const key = `${result.title.toLowerCase()}::${result.author.toLowerCase()}`;
      if (!deDupe.has(key)) {
        deDupe.set(key, result);
      }
    }

    return Array.from(deDupe.values());
  } catch {
    return [
      ...baseResults,
      {
        title: "Search Project Gutenberg for Counselor Reading",
        author: "N/A",
        url: `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(trimmed)}`,
        edition: "Search Link",
        source: "Project Gutenberg",
        available: true,
      },
    ];
  }
}
