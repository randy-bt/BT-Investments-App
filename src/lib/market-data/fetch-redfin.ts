/**
 * Redfin median home prices for Seattle, Tacoma, and Bellevue.
 *
 * Redfin's city-level data file is ~1GB compressed, too large for serverless.
 * Monthly median prices are updated manually via Settings > Market Stats.
 * The monthly cron exists to keep the schedule cadence, but the actual values
 * come from manual entry after checking Redfin's city pages:
 *   - https://www.redfin.com/city/16163/WA/Seattle/housing-market
 *   - https://www.redfin.com/city/17887/WA/Tacoma/housing-market
 *   - https://www.redfin.com/city/1387/WA/Bellevue/housing-market
 */

// Placeholder — manual override in settings is the primary update method
export async function fetchRedfinMedianPrices(): Promise<Record<string, null>> {
  return {
    median_seattle: null,
    median_tacoma: null,
    median_bellevue: null,
  }
}
