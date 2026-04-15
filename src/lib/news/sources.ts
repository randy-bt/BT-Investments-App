export type FeedSource = {
  name: string
  url: string
  category: 'local' | 'national' | 'macro' | 'stocks' | 'ai'
  aiSubcategory?: 'ai_real_estate' | 'ai_general'
}

export type ApiQuery = {
  keywords: string
  category: 'local' | 'national' | 'macro' | 'stocks' | 'ai'
  aiSubcategory?: 'ai_real_estate' | 'ai_general'
}

export const RSS_FEEDS: FeedSource[] = [
  // Local RE News
  { name: 'Seattle Times Real Estate', url: 'https://www.seattletimes.com/business/real-estate/feed/', category: 'local' },
  { name: 'The Urbanist', url: 'https://www.theurbanist.org/feed/', category: 'local' },
  { name: 'Puget Sound Business Journal', url: 'https://www.bizjournals.com/seattle/feed', category: 'local' },

  // National RE News
  { name: 'Inman News', url: 'https://www.inman.com/feed/', category: 'national' },
  { name: 'HousingWire', url: 'https://www.housingwire.com/feed/', category: 'national' },
  { name: 'Redfin Blog', url: 'https://www.redfin.com/blog/feed/', category: 'national' },
  { name: 'Keeping Current Matters', url: 'https://www.keepingcurrentmatters.com/feed/', category: 'national' },
  { name: 'BiggerPockets Blog', url: 'https://www.biggerpockets.com/blog/feed/', category: 'national' },
  { name: 'Real Estate Skills', url: 'https://www.realestateskills.com/blog.rss', category: 'national' },

  // Macro Econ
  { name: 'Calculated Risk', url: 'https://www.calculatedriskblog.com/feeds/posts/default', category: 'macro' },
  { name: 'Mortgage News Daily', url: 'https://www.mortgagenewsdaily.com/feed', category: 'macro' },
  { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', category: 'macro' },

  // Real Estate Stock News
  { name: 'CNBC Real Estate', url: 'https://www.cnbc.com/id/10000115/device/rss/rss.html', category: 'stocks' },
  { name: 'MarketWatch Real Estate', url: 'https://www.marketwatch.com/rss/realestate', category: 'stocks' },

  // AI News — general
  { name: 'The Verge AI', url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'ai', aiSubcategory: 'ai_general' },

  // AI News — real estate specific
  { name: 'Geek Estate Blog', url: 'https://geekestateblog.com/feed/', category: 'ai', aiSubcategory: 'ai_real_estate' },
]

export const NEWS_API_QUERIES: ApiQuery[] = [
  // Local
  { keywords: 'Seattle real estate', category: 'local' },
  { keywords: 'King County housing', category: 'local' },
  { keywords: 'Snohomish County real estate', category: 'local' },
  { keywords: 'Pierce County housing', category: 'local' },
  { keywords: 'Washington state zoning', category: 'local' },
  { keywords: 'Puget Sound development', category: 'local' },

  // Real Estate Stocks
  { keywords: 'REIT stocks', category: 'stocks' },
  { keywords: 'real estate investment trust', category: 'stocks' },
  { keywords: 'homebuilder stocks', category: 'stocks' },
]

export const CATEGORY_LIMITS: Record<string, number> = {
  local: 10,
  national: 3,
  macro: 1,
  stocks: 3,
  ai: 7,
}

export const SCORE_THRESHOLDS: Record<string, number> = {
  local: 5,
  national: 5,
  macro: 7,
  stocks: 5,
  ai: 5,
}

export const AI_SUBCATEGORY_TARGETS = {
  ai_real_estate: 3,
  ai_general: 5,
}
