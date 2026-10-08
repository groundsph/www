#!/usr/bin/env bun
/**
 * Build docs/brand-guidelines.pdf from docs/brand-guidelines.md
 *
 * Pipeline: markdown -> pandoc (standalone HTML + brand print CSS) -> Chromium print-to-PDF
 *
 * The markdown stays the single source of truth. Edit the .md, re-run this script.
 *
 *   bun run scripts/build-brand-pdf.ts           # build
 *   bun run scripts/build-brand-pdf.ts --keep    # keep intermediate HTML for debugging
 *
 * Requires: pandoc on PATH, playwright-core + its Chromium (already in devDeps/cache).
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { resolve, join } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const MD_PATH = join(ROOT, "docs", "brand-guidelines.md")
const CSS_PATH = join(ROOT, "docs", "brand", "pdf.css")
const TEMPLATE_PATH = join(ROOT, "docs", "brand", "pdf-template.html")
const BUILD_DIR = join(ROOT, "docs", "brand")
const TMP_MD = join(BUILD_DIR, ".brand.build.md")
const TMP_HTML = join(BUILD_DIR, ".brand.build.html")
const OUT_PATH = join(ROOT, "docs", "brand-guidelines.pdf")

const KEEP = process.argv.includes("--keep")
const log = (msg: string) => console.log(`  ${msg}`)

/* ---------------------------------------------------------------- fonts --- */

/**
 * Locate DM Sans locally so the PDF embeds the real brand face.
 * Falls back to the Google Fonts CSS if the file is not installed.
 */
function fontFaceCss(): { css: string; source: string } {
    const dir = join(homedir(), "Library", "Fonts")
    const upright = join(dir, "DMSans-VariableFont_opsz,wght.ttf")
    const italic = join(dir, "DMSans-Italic-VariableFont_opsz,wght.ttf")

    if (existsSync(upright)) {
        const faces = [
            `@font-face {
                font-family: "DM Sans";
                src: url("file://${upright}") format("truetype-variations");
                font-weight: 100 1000;
                font-style: normal;
                font-display: block;
            }`,
        ]
        if (existsSync(italic)) {
            faces.push(`@font-face {
                font-family: "DM Sans";
                src: url("file://${italic}") format("truetype-variations");
                font-weight: 100 1000;
                font-style: italic;
                font-display: block;
            }`)
        }
        return { source: `local files (${dir})`, css: faces.join("\n") }
    }

    return {
        source: "Google Fonts CDN (local DM Sans not installed)",
        css: `@import url("https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap");`,
    }
}

/* ------------------------------------------------------------- markdown --- */

/**
 * Add a colour swatch chip after every inline-code hex value, so the palette
 * tables render as real swatches in the PDF without polluting the markdown.
 */
function injectSwatches(md: string): string {
    return md.replace(
        /`(#[0-9a-fA-F]{3,8})`/g,
        (_m, hex: string) =>
            `\`${hex}\`<span class="chip" style="background:${hex}"></span>`
    )
}

/**
 * Insert a large swatch grid above the core-token table in §3.1.
 * The token rows are parsed out of the markdown table, so the .md stays the
 * single source of truth for the palette.
 */
function injectSwatchGrid(md: string): string {
    const anchor = "### 3.1 Core tokens"
    const anchorIdx = md.indexOf(anchor)
    if (anchorIdx === -1) return md

    const tail = md.slice(anchorIdx)
    const tableStart = tail.search(/\n\|\s*Token\s*\|/i)
    if (tableStart === -1) return md

    const rows: { token: string; hex: string; name: string }[] = []
    // tableStart points AT the newline preceding the header row
    for (const line of tail
        .slice(tableStart)
        .replace(/^\n+/, "")
        .split("\n")) {
        if (!line.startsWith("|")) break
        const m = line.match(
            /^\|\s*`([^`]+)`\s*\|\s*`(#[0-9A-Fa-f]{3,8})`\s*\|\s*([^|]+?)\s*\|/
        )
        if (m) rows.push({ token: m[1], hex: m[2], name: m[3] })
    }
    if (!rows.length) return md

    const cards = rows
        .map(
            ({ token, hex, name }) =>
                `<div class="swatch"><div class="swatch__color" style="background:${hex}"></div><div class="swatch__meta"><strong>${name}</strong><code>${token}</code><code>${hex}</code></div></div>`
        )
        .join("")

    // single line = guaranteed one raw HTML block for pandoc
    const grid = `<div class="swatches">${cards}</div>`

    return (
        md.slice(0, anchorIdx) +
        tail.slice(0, tableStart) +
        "\n\n" +
        grid +
        // trailing newline is required: without a blank line pandoc swallows the
        // following markdown table into the raw HTML block
        "\n" +
        tail.slice(tableStart)
    )
}

/** Drop the leading H1 — the PDF renders it as a designed cover instead. */
function stripTitle(md: string): string {
    return md.replace(/^#\s+.*(?:\r?\n)+/, "")
}

/* ---------------------------------------------------------------- pandoc --- */

async function runPandoc(): Promise<void> {
    const proc = Bun.spawn(
        [
            "pandoc",
            TMP_MD,
            "-f",
            "gfm+raw_html",
            "-t",
            "html5",
            "--standalone",
            `--template=${TEMPLATE_PATH}`,
            "--toc",
            "--toc-depth=2",
            "--metadata",
            `title=GroundsPH Brand Guidelines`,
            "--metadata",
            `version=${VERSION}`,
            "--metadata",
            `date=${TODAY}`,
            "-o",
            TMP_HTML,
        ],
        { cwd: ROOT, stdout: "pipe", stderr: "pipe" }
    )

    const exit = await proc.exited
    const stderr = await new Response(proc.stderr).text()
    if (exit !== 0) throw new Error(`pandoc failed (${exit}):\n${stderr}`)
    if (stderr.trim()) log(`pandoc: ${stderr.trim()}`)
}

/** Warn if any internal anchor link points at a heading id that does not exist. */
function checkAnchors(html: string): string[] {
    const ids = new Set(
        [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
    )
    const broken = new Set<string>()
    for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) {
        if (!ids.has(href)) broken.add(href)
    }
    return [...broken]
}

/* ----------------------------------------------------------------- build --- */

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
const VERSION: string = pkg.version
const TODAY = new Date().toISOString().slice(0, 10)

console.log(`\nBuilding GroundsPH brand guidelines PDF (v${VERSION})\n`)

if (!existsSync(MD_PATH)) throw new Error(`Missing source: ${MD_PATH}`)

// 1. markdown -> temp markdown (swatches + no H1)
const source = readFileSync(MD_PATH, "utf8")
// order matters: the swatch grid is parsed from the raw table, before the
// inline hex chips rewrite the table cells
writeFileSync(TMP_MD, injectSwatches(injectSwatchGrid(stripTitle(source))))
log(`prepared ${MD_PATH.replace(ROOT + "/", "")}`)

// 2. pandoc -> standalone HTML
await runPandoc()
log("rendered HTML via pandoc")

// 3. inject fonts + brand CSS into the template output
const { css: fontCss, source: fontSource } = fontFaceCss()
const brandCss = readFileSync(CSS_PATH, "utf8")
let html = readFileSync(TMP_HTML, "utf8")
html = html.replace("__BRAND_FONTS__", fontCss).replace("__BRAND_CSS__", brandCss)
writeFileSync(TMP_HTML, html)
log(`typeface: ${fontSource}`)

const broken = checkAnchors(html)
if (broken.length) log(`⚠ broken internal links: ${broken.join(", ")}`)
else log("internal anchor links: all resolve")

// 4. Chromium -> PDF
const { chromium } = await import("playwright-core")
const browser = await chromium.launch({
    args: ["--allow-file-access-from-files", "--font-render-hinting=none"],
})

try {
    const page = await browser.newPage()
    await page.goto(`file://${TMP_HTML}`, { waitUntil: "load" })
    await page.evaluate(() => document.fonts.ready)

    await page.pdf({
        path: OUT_PATH,
        format: "Letter",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `
            <div style="width:100%;box-sizing:border-box;padding:0 17mm;display:flex;justify-content:space-between;font-family:'DM Sans',-apple-system,Helvetica,sans-serif;font-size:8px;letter-spacing:0.08em;color:#AF8F6F;">
                <span style="text-transform:uppercase;">GroundsPH Brand Guidelines · v${VERSION}</span>
                <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
            </div>`,
        margin: { top: "16mm", bottom: "18mm", left: "17mm", right: "17mm" },
    })
    log("printed to PDF via Chromium")
} finally {
    await browser.close()
    if (!KEEP) {
        for (const f of [TMP_MD, TMP_HTML]) if (existsSync(f)) unlinkSync(f)
    } else {
        log(`kept intermediate HTML: ${TMP_HTML.replace(ROOT + "/", "")}`)
    }
}

/* ---------------------------------------------------------------- verify --- */

const bytes = readFileSync(OUT_PATH)
const pages = (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length
const embeddedFont = /DMSans|DM\+Sans/i.test(bytes.toString("latin1"))
const kb = (statSync(OUT_PATH).size / 1024).toFixed(0)

console.log(`\n  ✓ ${OUT_PATH.replace(ROOT + "/", "")}`)
log(`pages: ${pages}   size: ${kb} KB   DM Sans embedded: ${embeddedFont ? "yes" : "NO"}`)

if (!embeddedFont) {
    console.log(
        "\n  ⚠ DM Sans was not embedded — the PDF will fall back to a system sans.\n"
    )
    process.exitCode = 1
}
console.log("")
