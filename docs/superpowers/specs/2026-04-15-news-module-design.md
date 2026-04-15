# Housing Market News Module — Design Spec

## Purpose

An internal news feed that surfaces high-signal real estate and AI industry headlines for the BT Investments team. Designed for Aldo (remote acquisitions) and Randy to stay current on local market conditions, national trends, and relevant tech developments — all in one place with AI-generated plain-language summaries.

## Pages

### 1. Main Feed — `/app/housing-market-news`

Replaces the existing placeholder page.

**Weather Header:**
Large display at top showing current date/time and live Seattle weather (temperature, condition icon). Uses Open-Meteo API (free, no key). Client-side fetch on page load.

**Headline Sections (displayed in this order):**

| Section | Max Headlines | Scoring Criteria |
|---------|--------------|------------------|
| Local RE News | 10 | Relevance to Seattle-area residential real estate |
| National RE News | 3 | Relevance to real estate industry generally |
| Macro Econ | 1 | Relevance to real estate investors and housing market |
| Real Estate Stock News | 3 | Relevance to real estate stocks, REITs, homebuilders |
| AI News | 7 | 2-3 AI in real estate specific, 4-5 general breaking AI news |

**Headline layout:**
Each headline is a single line of text. No card, no border — clean and minimal. Format:

```
M.DD  Headline text here
```

Date prefix uses the same M.D format as the activity feed. Sections are separated by a section header label. Clicking any headline opens the article detail page in a new browser tab.

### 2. Article Detail — `/app/housing-market-news/article/[id]`

Opens in a new tab. Auth required (behind `/app/*` middleware).

**Loading state:** Page opens immediately with a spinner while the summary loads.

**Display (once loaded):**
- Published date at top
- Source name
- Claude Haiku rewritten summary (1-3 paragraphs, plain language)
- Link to original article at bottom

**Summary generation flow:**
1. Page loads, checks if `summary` column already exists for this article
2. If yes: display cached summary instantly
3. If no: calls `POST /api/news/rewrite/[id]`
   - Fetches source URL, extracts readable text via readability parser
   - Sends to Claude Haiku with instructions: rewrite in 1-3 paragraphs, concise, plain language, easy to understand for someone without deep real estate knowledge
   - Saves summary to the article row in Supabase
   - Returns summary to the page

**Fallback scenarios:**
- **Source blocked/paywall:** Display the original excerpt with a clear message explaining the issue (e.g. "This article's source could not be accessed — the site may require a subscription or have blocked automated access."). Original article link still shown at bottom.
- **API failure or out of credits:** Display "Summary temporarily unavailable" with the reason. Article flagged with `summary_failed: true` for automatic retry on the next refresh cycle.

Summaries only generate on user click — nothing is pre-generated.

### 3. Archive — `/app/housing-market-news/archive`

Accessible via link from the main news page.

**Layout:**
- Search bar at top — searches across headline text and source name
- Articles listed in reverse chronological order, grouped by date
- Each line: headline text, date, and a category pill on the far right
- Category pills: `Local`, `National`, `Macro Econ`, `Stocks`, `AI`
- Clicking any headline opens the article detail page in a new tab

All articles retained indefinitely — nothing is deleted.

## Data Sources

### RSS Feeds

**Local RE News:**
- Seattle Times Real Estate — `seattletimes.com/business/real-estate/feed`
- Puget Sound Business Journal Seattle
- The Urbanist — `theurbanist.org/feed`
- The Registry NW
- Seattle DJC
- Washington REALTORS news feed

**National RE News:**
- Inman News — `inman.com/feed`
- HousingWire — `housingwire.com/feed`
- Redfin Blog — `redfin.com/blog/feed`
- Keeping Current Matters — `keepingcurrentmatters.com/feed`
- BiggerPockets Blog — `biggerpockets.com/blog/feed`
- Real Estate Skills — `realestateskills.com/blog.rss`

**Macro Econ:**
- Calculated Risk — `calculatedriskblog.com/feeds/posts/default`
- Mortgage News Daily — `mortgagenewsdaily.com/feed`
- Federal Reserve — `federalreserve.gov/feeds/press_all.xml`

**Real Estate Stock News:**
- CNBC Real Estate — `cnbc.com/id/10000115/device/rss/rss.html`
- MarketWatch Real Estate — `marketwatch.com/rss/realestate`

**AI News:**
- The Verge AI — `theverge.com/ai-artificial-intelligence/rss/index.xml`
- MIT Technology Review AI — `technologyreview.com/topic/artificial-intelligence/feed`
- TechCrunch AI — `techcrunch.com/category/artificial-intelligence/feed`
- Geek Estate Blog — `geekestateblog.com/feed`

### News API Queries

Used to supplement RSS feeds with additional coverage. API provider TBD (Currents API recommended — free tier, production-allowed).

**Local:** "Seattle real estate," "King County housing," "Snohomish County real estate," "Pierce County housing," "Washington state zoning," "Puget Sound development"

**Real Estate Stocks:** "REIT stocks," "real estate investment trust," "homebuilder stocks"

## Database

### `news_articles` table

```sql
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  category TEXT NOT NULL CHECK (category IN ('local', 'national', 'macro', 'stocks', 'ai')),
  ai_subcategory TEXT,  -- for AI section: 'ai_real_estate' or 'ai_general'
  relevance_score NUMERIC(4,2) DEFAULT 0,
  summary TEXT,  -- populated on user click via Haiku rewrite
  summary_failed BOOLEAN NOT NULL DEFAULT false,  -- flagged for retry
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX news_articles_category_idx ON news_articles(category, relevance_score DESC);
CREATE INDEX news_articles_fetched_at_idx ON news_articles(fetched_at DESC);
CREATE INDEX news_articles_source_url_idx ON news_articles(source_url);
```

RLS enabled, authenticated users can read all rows. Only the service role (cron API route) inserts/updates.

## Refresh Schedule

Runs 3x daily: **8:00 AM, 12:00 PM, 4:00 PM Pacific** via Vercel Cron.

```json
// vercel.json
{
  "crons": [
    { "path": "/api/news/refresh", "schedule": "0 15,19,23 * * *" }
  ]
}
```

(UTC times: 15:00, 19:00, 23:00 = 8am, 12pm, 4pm Pacific during PDT)

### Refresh Job Flow (`POST /api/news/refresh`)

1. Fetch all RSS feeds in parallel using `rss-parser` npm package
2. Fetch News API results for keyword queries
3. Deduplicate by URL against existing articles in the database
4. For new articles only: send headlines + excerpts to Claude (Anthropic API) for relevance scoring, batched by category
5. Insert scored articles into `news_articles`
6. Retry summary generation for any articles flagged with `summary_failed: true`
7. Return count of new articles added

### Relevance Scoring

Uses Anthropic API (Claude — model chosen for cost efficiency on lightweight scoring calls). Each article scored 0-10 based on category-specific criteria:

- **Local:** How relevant is this to Seattle-area residential real estate? (threshold: 5+)
- **National:** How relevant is this to the US real estate industry? (threshold: 5+)
- **Macro Econ:** How relevant is this to real estate investors and the housing market? (threshold: 7+, since only 1 headline shown)
- **Stocks:** How relevant is this to real estate stocks, REITs, and homebuilders? (threshold: 5+)
- **AI:** Scored on two dimensions — is this AI in real estate (subcategory `ai_real_estate`) or general breaking AI news (`ai_general`)? Threshold: 5+

Articles below threshold are stored but never displayed. The front-end selects the top N by relevance score per category from the most recent refresh cycle.

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/news/refresh` | POST | Cron-triggered: fetch, score, store articles |
| `/api/news/rewrite/[id]` | POST | On-demand: fetch full text, Haiku rewrite, save summary |

Both routes require authentication (refresh also accepts Vercel cron auth header).

## Environment Variables Needed

- `ANTHROPIC_API_KEY` — for relevance scoring and article rewrites (user will provide)
- `NEWS_API_KEY` — for Currents API or NewsAPI (user will provide when ready)

## Tech Stack

- `rss-parser` — npm package for parsing RSS feeds
- `@mozilla/readability` + `linkedom` — extract article text from source URLs for rewrites
- Anthropic SDK (`@anthropic-ai/sdk`) — relevance scoring (batch) and article rewrites (Haiku)
- Open-Meteo API — weather data (free, no key)
- Vercel Cron — scheduled refresh jobs
