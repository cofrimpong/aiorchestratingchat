import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findTextbookPDF, getTextbookDetails, listSubjects } from "./textbookFinder";

// ── helpers ───────────────────────────────────────────────────────────────────

function mockFetchWith(docs: object[], numFound = docs.length) {
  return vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ docs, numFound }), { status: 200 }),
  );
}

function mockFetchFailure() {
  return vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("textbookFinder", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Open Library API with the search query", async () => {
    const spy = mockFetchWith([
      {
        key: "/works/OL1234W",
        title: "Calculus: Early Transcendentals",
        author_name: ["James Stewart"],
        isbn: ["9780538497909"],
        ia: ["calculus00stew"],
        has_fulltext: true,
        public_scan_b: true,
        edition_count: 7,
      },
    ]);

    const results = await findTextbookPDF("calculus");
    expect(spy).toHaveBeenCalled();
    const calledUrl = spy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("openlibrary.org/search.json");
    expect(calledUrl).toContain("calculus");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toBe("Calculus: Early Transcendentals");
  });

  it("returns an Internet Archive URL when book has a free scan", async () => {
    mockFetchWith([
      {
        key: "/works/OL1234W",
        title: "Nursing Health Care Policy",
        author_name: ["Jane Doe"],
        ia: ["nursinghc1234"],
        has_fulltext: true,
        public_scan_b: true,
      },
    ]);

    const results = await findTextbookPDF("nursing health care policy");
    expect(results[0].url).toContain("archive.org/details/nursinghc1234");
    expect(results[0].available).toBe(true);
    expect(results[0].source).toBe("Internet Archive (free download)");
  });

  it("returns an Open Library URL when book has no free scan", async () => {
    mockFetchWith([
      {
        key: "/works/OL9999W",
        title: "Some Textbook",
        author_name: ["Author X"],
        has_fulltext: false,
        public_scan_b: false,
      },
    ]);

    const results = await findTextbookPDF("some textbook");
    expect(results[0].url).toContain("openlibrary.org/works/OL9999W");
    expect(results[0].available).toBe(false);
  });

  it("filters out print-disabled-only Internet Archive results", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        docs: [
          {
            key: "/works/OLprintW",
            title: "Chemistry for Engineering Students",
            author_name: ["Brown"],
            ia: ["chemistryforeng_printdisabled"],
            has_fulltext: true,
            ebook_access: "printdisabled",
          },
          {
            key: "/works/OLborrowW",
            title: "Engineering Chemistry",
            author_name: ["Holme"],
            ia: ["engineeringchemistry_borrow"],
            has_fulltext: true,
            ebook_access: "borrowable",
          },
        ],
        numFound: 2,
      }), { status: 200 }),
    );

    const results = await findTextbookPDF("engineering chemistry");
    expect(results.some((r) => r.source.includes("print-disabled only"))).toBe(false);
    expect(results.some((r) => r.source.includes("free borrow"))).toBe(true);
  });

  it("falls back to OER list when API call fails", async () => {
    mockFetchFailure();
    const results = await findTextbookPDF("calculus");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).not.toBe("Internet Archive");
  });

  it("falls back to OER list when API returns no docs", async () => {
    mockFetchWith([]);
    const results = await findTextbookPDF("biology");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty query", async () => {
    const results = await findTextbookPDF("");
    expect(results).toEqual([]);
  });

  it("returns at most 12 results", async () => {
    const manyDocs = Array.from({ length: 20 }, (_, i) => ({
      key: `/works/OL${i}W`,
      title: `Textbook ${i}`,
      author_name: ["Author"],
    }));
    mockFetchWith(manyDocs, 20);
    const results = await findTextbookPDF("textbook");
    expect(results.length).toBeLessThanOrEqual(12);
  });

  it("retries with a cleaned query when edition wording is too specific", async () => {
    const spy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ docs: [], numFound: 0 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        docs: [
          {
            key: "/works/OL321W",
            title: "Policy and politics in nursing and health care",
            author_name: ["Diana J. Mason"],
            ia: ["policypoliticsin0000unse_p8g8"],
            has_fulltext: true,
            public_scan_b: true,
          },
        ],
        numFound: 1,
      }), { status: 200 }))
      .mockResolvedValue(new Response(JSON.stringify({ docs: [], numFound: 0 }), { status: 200 }));

    const results = await findTextbookPDF("Policy & Politics in Nursing and Health Care 8th edition");

    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.title.toLowerCase().includes("policy"))).toBe(true);
  });

  it("sorts free-download books before external source links", async () => {
    mockFetchWith([
      { key: "/works/OL1W", title: "Borrowable Book", author_name: ["A"], ia: ["ia1"], has_fulltext: true, public_scan_b: false },
      { key: "/works/OL2W", title: "Free Book", author_name: ["B"], ia: ["ia2"], has_fulltext: true, public_scan_b: true },
    ]);
    const results = await findTextbookPDF("book");
    // Free-download books should sort before external source links
    const freeIdx = results.findIndex((r) => r.source === "Internet Archive (free download)");
    const externalIdx = results.findIndex((r) => r.source.startsWith("Free PDF Source"));
    expect(freeIdx).toBeLessThan(externalIdx);
  });

  it("getTextbookDetails returns a curated OER match", () => {
    const book = getTextbookDetails("Biology 2e");
    expect(book).not.toBeNull();
    expect(book?.author).toBe("Mary Ann Clark");
  });

  it("getTextbookDetails returns null for unknown title", () => {
    expect(getTextbookDetails("Nonexistent Textbook XYZ")).toBeNull();
  });

  it("listSubjects returns a sorted list", () => {
    const subjects = listSubjects();
    expect(subjects.length).toBeGreaterThan(0);
    expect(subjects).toEqual([...subjects].sort());
  });

  it("expands NJIT course queries to find CS textbooks in fallback mode", async () => {
    mockFetchFailure();
    const results = await findTextbookPDF("NJIT CS 114 required textbook");
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some(
        (book) =>
          book.source.includes("Internet Archive") ||
          book.source.includes("Open Library"),
      ),
    ).toBe(true);
  });

  it("finds at least two CS options for generic computer science queries", async () => {
    mockFetchFailure();
    const results = await findTextbookPDF("computer science textbook");
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("prioritizes strict title+author intent for specific textbook queries", async () => {
    mockFetchWith([
      {
        key: "/works/OLspanishW",
        title: "Quimica la ciencia central",
        author_name: ["Theodore L. Brown", "H. Eugene Lemay", "Bruce Bursten"],
        ia: ["quimicalacienciacentral"],
        public_scan_b: true,
      },
      {
        key: "/works/OLtargetW",
        title: "Chemistry for Engineering Students",
        author_name: ["Lawrence S. Brown", "Thomas A. Holme"],
        ia: ["chemistryforengineeringstudents"],
        public_scan_b: true,
      },
    ]);

    const results = await findTextbookPDF("Chemistry for Engineering Students by Brown Holme pdf");
    expect(results.some((r) => /engineering students/i.test(r.title))).toBe(true);
    expect(results.some((r) => /quimica la ciencia central/i.test(r.title))).toBe(false);
  });
});
