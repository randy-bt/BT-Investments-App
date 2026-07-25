// County assessor URLs — APN replaces %s
export const COUNTY_URLS: Record<string, string> = {
  king: "https://blue.kingcounty.com/Assessor/eRealProperty/Dashboard.aspx?ParcelNbr=%s",
  pierce: "https://atip.piercecountywa.gov/#/app/propertyDetail/%s/summary",
  snohomish: "https://www.snoco.org/proptax/search.aspx?parcel_number=%s",
  thurston: "https://tcproperty.co.thurston.wa.us/propsql/basic.asp?pn=%s",
  kitsap: "https://psearch.kitsapgov.com/details.asp?RPID=%s",
  skagit: "https://www.skagitcounty.net/Search/Property/?id=%s",
};

export function getCountyUrl(county: string | null, apn: string | null): string | null {
  if (!county || !apn) return null;
  const template = COUNTY_URLS[county.toLowerCase()];
  if (!template) return null;
  return template.replace("%s", apn);
}
