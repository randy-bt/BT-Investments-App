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
  { name: 'Seeking Alpha REITs', url: 'https://seekingalpha.com/tag/reits.xml', category: 'stocks' },
  { name: 'Yahoo Finance RE', url: 'https://finance.yahoo.com/rss/industry?s=real_estate', category: 'stocks' },
  { name: 'Nareit News', url: 'https://www.reit.com/news/rss.xml', category: 'stocks' },
  { name: 'Globe St', url: 'https://www.globest.com/feed/', category: 'stocks' },

  // AI News — direct from labs (prioritized)
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'Google Gemini Blog', url: 'https://blog.google/products/gemini/rss/', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'Google Developers Blog', url: 'https://blog.google/technology/developers/rss/', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'AWS Machine Learning Blog', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', category: 'ai', aiSubcategory: 'ai_general' },

  // AI News — tech press
  { name: 'The Verge AI', url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', category: 'ai', aiSubcategory: 'ai_general' },

  // AI News — real estate specific
  { name: 'Geek Estate Blog', url: 'https://geekestateblog.com/feed/', category: 'ai', aiSubcategory: 'ai_real_estate' },
]

export const NEWS_API_QUERIES: ApiQuery[] = [
  // Local RE News
  { keywords: 'Seattle real estate', category: 'local' },
  { keywords: 'King County housing', category: 'local' },
  { keywords: 'Snohomish County real estate', category: 'local' },
  { keywords: 'Pierce County housing', category: 'local' },
  { keywords: 'Washington state zoning', category: 'local' },
  { keywords: 'Puget Sound development', category: 'local' },
  { keywords: 'Seattle housing market', category: 'local' },
  { keywords: 'Tacoma real estate', category: 'local' },
  { keywords: 'Bellevue real estate', category: 'local' },
  { keywords: 'Seattle ADU', category: 'local' },
  { keywords: 'Seattle DADU', category: 'local' },
  { keywords: 'Washington state DADU', category: 'local' },

  // National RE News
  { keywords: 'real estate market', category: 'national' },
  { keywords: 'housing market', category: 'national' },
  { keywords: 'home prices', category: 'national' },
  { keywords: 'real estate investing', category: 'national' },
  { keywords: 'wholesale real estate', category: 'national' },
  { keywords: 'real estate wholesaling', category: 'national' },
  { keywords: 'ADU housing', category: 'national' },
  { keywords: 'accessory dwelling unit', category: 'national' },

  // Macro Economic
  { keywords: 'Federal Reserve interest rates', category: 'macro' },
  { keywords: 'mortgage rates', category: 'macro' },
  { keywords: 'inflation housing', category: 'macro' },
  { keywords: 'housing affordability', category: 'macro' },
  { keywords: 'economic recession real estate', category: 'macro' },

  // Real Estate Stock News
  { keywords: 'REIT earnings', category: 'stocks' },
  { keywords: 'REIT dividend', category: 'stocks' },
  { keywords: 'real estate investment trust', category: 'stocks' },
  { keywords: 'homebuilder stocks', category: 'stocks' },
  { keywords: 'homebuilder earnings', category: 'stocks' },
  { keywords: 'real estate stocks', category: 'stocks' },
  { keywords: 'real estate ETF', category: 'stocks' },
  { keywords: 'housing sector stocks', category: 'stocks' },
  { keywords: 'Prologis', category: 'stocks' },
  { keywords: 'American Tower stock', category: 'stocks' },
  { keywords: 'Realty Income stock', category: 'stocks' },
  { keywords: 'D.R. Horton stock', category: 'stocks' },
  { keywords: 'Lennar stock', category: 'stocks' },
  { keywords: 'Simon Property Group', category: 'stocks' },
  { keywords: 'Zillow stock', category: 'stocks' },
  { keywords: 'Redfin stock', category: 'stocks' },
  { keywords: 'Opendoor stock', category: 'stocks' },
  { keywords: 'mortgage REIT', category: 'stocks' },

  // AI News — general
  { keywords: 'artificial intelligence', category: 'ai', aiSubcategory: 'ai_general' },
  { keywords: 'new AI model', category: 'ai', aiSubcategory: 'ai_general' },
  { keywords: 'generative AI', category: 'ai', aiSubcategory: 'ai_general' },
  { keywords: 'large language model', category: 'ai', aiSubcategory: 'ai_general' },
  { keywords: 'AI image generation', category: 'ai', aiSubcategory: 'ai_general' },
  { keywords: 'AI video generation', category: 'ai', aiSubcategory: 'ai_general' },
  { keywords: 'text to image AI', category: 'ai', aiSubcategory: 'ai_general' },
  { keywords: 'text to video AI', category: 'ai', aiSubcategory: 'ai_general' },
  { keywords: 'AI technology breakthrough', category: 'ai', aiSubcategory: 'ai_general' },
  { keywords: 'Higgsfield AI', category: 'ai', aiSubcategory: 'ai_general' },

  // AI News — real estate specific
  { keywords: 'AI real estate', category: 'ai', aiSubcategory: 'ai_real_estate' },
  { keywords: 'proptech AI', category: 'ai', aiSubcategory: 'ai_real_estate' },
]

export const CATEGORY_LIMITS: Record<string, number> = {
  local: 10,
  national: 3,
  macro: 1,
  stocks: 5,
  ai: 7,
}

export const SCORE_THRESHOLDS: Record<string, number> = {
  local: 5,
  national: 5,
  macro: 8,
  stocks: 6,
  ai: 7,
}

export const AI_SUBCATEGORY_TARGETS = {
  ai_real_estate: 3,
  ai_general: 5,
}
