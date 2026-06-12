import type { Metadata } from "next";
import { PageBranding } from "@/components/marketing/PageBranding";
import { CompareMap, type MapListing } from "./CompareMap";

// One-off comparison page for friends shopping in the ~$800K range —
// 7628 Zircon Dr SW (Lakewood) vs. 14 active alternatives. Lives at an
// unguessable slug and is excluded from search engines; anyone with the
// link can view it.
export const metadata: Metadata = {
  title: "Same Budget, Better Options — BT Investments",
  description: "A side-by-side look at 14 active listings in the same budget.",
  robots: { index: false, follow: false },
};

type Listing = MapListing & {
  photo?: string;
  price: string;
  bdba: string;
  sqft: string;
  lot: string;
};

const LISTINGS: Listing[] = [
  {
    address: "7628 Zircon Dr SW, Lakewood",
    price: "$800,000",
    shortPrice: "$800K",
    bdba: "4/3",
    sqft: "3,049",
    lot: "6,010",
    lat: 47.195118,
    lng: -122.540519,
    subject: true,
  },
  {
    address: "3108 E Valley View Ter, Tacoma",
    photo: "/marketing/comparisons/homes/valley-view-ter.jpg",
    price: "$699,000",
    shortPrice: "$699K",
    bdba: "4/3.5",
    sqft: "3,824",
    lot: "5,750",
    lat: 47.2346238,
    lng: -122.4163817,
    url: "https://www.redfin.com/WA/Tacoma/3108-E-Valley-View-Ter-98404/home/23096559",
    topPick: true,
  },
  {
    address: "4708 Smithers Ave S, Renton",
    photo: "/marketing/comparisons/homes/smithers-renton.jpg",
    price: "$799,950",
    shortPrice: "$800K",
    bdba: "3/2.5",
    sqft: "2,750",
    lot: "6,340",
    lat: 47.4373555,
    lng: -122.2084546,
    url: "https://www.redfin.com/WA/Renton/4708-Smithers-Ave-S-98055/home/383837",
    topPick: true,
  },
  {
    address: "3630 Spyglass Dr NE, Tacoma",
    photo: "/marketing/comparisons/homes/spyglass-tacoma.jpg",
    price: "$779,950",
    shortPrice: "$780K",
    bdba: "4/2.5",
    sqft: "2,502",
    lot: "9,165",
    lat: 47.2906451,
    lng: -122.3934315,
    url: "https://www.redfin.com/WA/Tacoma/3630-Spyglass-Dr-NE-98422/home/2864769",
    topPick: true,
  },
  {
    address: "32214 50th Ct S, Auburn",
    photo: "/marketing/comparisons/homes/50th-ct-auburn.jpg",
    price: "$735,000",
    shortPrice: "$735K",
    bdba: "4/3",
    sqft: "2,671",
    lot: "7,088",
    lat: 47.3138786,
    lng: -122.2713718,
    url: "https://www.redfin.com/WA/Auburn/32214-50th-Ct-S-98001/home/113178494",
    topPick: true,
  },
  {
    address: "35517 56th Ave S, Auburn",
    photo: "/marketing/comparisons/homes/56th-ave-auburn.jpg",
    price: "$749,950",
    shortPrice: "$750K",
    bdba: "4/2.5",
    sqft: "2,532",
    lot: "5,750",
    lat: 47.283023,
    lng: -122.2653665,
    url: "https://www.redfin.com/WA/Auburn/35517-56th-Ave-S-98001/home/22697468",
    topPick: true,
  },
  {
    address: "130 67th Ave Ct E, Fife",
    photo: "/marketing/comparisons/homes/67th-ave-fife.jpg",
    price: "$699,000",
    shortPrice: "$699K",
    bdba: "4/3.5",
    sqft: "2,836",
    lot: "9,004",
    lat: 47.2560263,
    lng: -122.3397816,
    url: "https://www.redfin.com/WA/Fife/130-67th-Avenue-Ct-E-98424/home/2932274",
    topPick: true,
  },
  {
    address: "36010 11th Ave SW, Federal Way",
    photo: "/marketing/comparisons/homes/11th-ave-federal-way.jpg",
    price: "$789,000",
    shortPrice: "$789K",
    bdba: "4/2.5",
    sqft: "3,210",
    lot: "5,000",
    lat: 47.2784994,
    lng: -122.3488652,
    url: "https://www.redfin.com/WA/Federal-Way/36010-11th-Ave-SW-98023/home/2075534",
  },
  {
    address: "1328 E 51st St, Tacoma",
    photo: "/marketing/comparisons/homes/51st-st-tacoma.jpg",
    price: "$690,000",
    shortPrice: "$690K",
    bdba: "6/3",
    sqft: "2,727",
    lot: "5,625",
    lat: 47.2109436,
    lng: -122.4112896,
    url: "https://www.redfin.com/WA/Tacoma/1328-E-51st-St-98404/home/22786137",
  },
  {
    address: "4319 S 10th St, Tacoma",
    photo: "/marketing/comparisons/homes/10th-st-tacoma.jpg",
    price: "$787,500",
    shortPrice: "$788K",
    bdba: "4/2.5",
    sqft: "2,830",
    lot: "5,875",
    lat: 47.2519375,
    lng: -122.4952893,
    url: "https://www.redfin.com/WA/Tacoma/4319-S-10th-St-98405/home/40476380",
  },
  {
    address: "1210 29th St NW, Puyallup",
    photo: "/marketing/comparisons/homes/29th-st-puyallup.jpg",
    price: "$699,999",
    shortPrice: "$700K",
    bdba: "4/2.5",
    sqft: "2,722",
    lot: "5,800",
    lat: 47.201943,
    lng: -122.3329634,
    url: "https://www.redfin.com/WA/Puyallup/1210-29th-St-NW-98371/home/106418741",
  },
  {
    address: "1414 60th Ave NE, Tacoma",
    photo: "/marketing/comparisons/homes/60th-ave-tacoma.jpg",
    price: "$799,900",
    shortPrice: "$800K",
    bdba: "4/2.5",
    sqft: "2,536",
    lot: "4,875",
    lat: 47.2705486,
    lng: -122.346047,
    url: "https://www.redfin.com/WA/Tacoma/1414-60th-Ave-NE-98422/home/192222730",
  },
  {
    address: "3122 15th Ave NW, Puyallup",
    photo: "/marketing/comparisons/homes/15th-ave-puyallup.jpg",
    price: "$714,997",
    shortPrice: "$715K",
    bdba: "5/3",
    sqft: "3,081",
    lot: "4,550",
    lat: 47.2044463,
    lng: -122.3355724,
    url: "https://www.redfin.com/WA/Puyallup/3122-15th-Ave-NW-98371/home/170227402",
  },
  {
    address: "6820 S Alaska St, Tacoma",
    photo: "/marketing/comparisons/homes/alaska-st-tacoma.jpg",
    price: "$739,950",
    shortPrice: "$740K",
    bdba: "6/3.5",
    sqft: "2,538",
    lot: "7,406",
    lat: 47.1950105,
    lng: -122.4590857,
    url: "https://www.redfin.com/WA/Tacoma/6820-S-Alaska-St-98408/home/178471678",
  },
  {
    address: "2008 84th Ave E, Edgewood",
    photo: "/marketing/comparisons/homes/84th-ave-edgewood.jpg",
    price: "$760,000",
    shortPrice: "$760K",
    bdba: "4/3",
    sqft: "2,470",
    lot: "9,903",
    lat: 47.2387322,
    lng: -122.318128,
    url: "https://www.redfin.com/WA/Edgewood/2008-84th-Ave-E-98371/home/172185217",
  },
];

const cellStyle: React.CSSProperties = {
  padding: "13px 14px",
  fontSize: 14.5,
  borderBottom: "1px solid #e9e6da",
  whiteSpace: "nowrap",
};

const numCell: React.CSSProperties = { ...cellStyle, textAlign: "right" };

const headCell: React.CSSProperties = {
  padding: "11px 14px",
  fontSize: 11.5,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

export default function ZirconComparisonPage() {
  return (
    <div
      className="marketing-scope"
      style={{ background: "var(--mkt-cream)", minHeight: "100vh" }}
    >
      <main
        style={{
          maxWidth: 1060,
          margin: "0 auto",
          padding: "60px 24px 100px",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          color: "var(--mkt-text-on-light)",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-block", marginBottom: 26 }}>
            <PageBranding />
          </div>
          <h1
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "clamp(38px, 6vw, 58px)",
              fontWeight: 500,
              lineHeight: 1.06,
              margin: 0,
            }}
          >
            Same Budget, Better Options
          </h1>
          <p
            style={{
              marginTop: 14,
              fontSize: 12.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#76794c",
              fontWeight: 500,
            }}
          >
            14 homes on the market right now · Prepared June 2026
          </p>
        </header>

        <section
          style={{
            maxWidth: 920,
            margin: "0 auto 44px",
            fontSize: 16.5,
            lineHeight: 1.7,
            color: "var(--mkt-muted-light)",
          }}
        >
          <p style={{ margin: 0 }}>
            The Lakewood home on Zircon Drive is spacious, nearly new, and
            priced in line with its neighborhood — but it isn&rsquo;t the best
            home this budget can buy. The fourteen listings below are all on
            the market right now for the same money or less, and most offer
            what Zircon Drive can&rsquo;t: stronger locations. Many sit closer
            to Renton for the Boeing commute, and most are served by far
            better school districts — Lakewood&rsquo;s assigned middle school
            rates just 2/10, while the Renton, Auburn, and Puyallup schools
            behind many of these homes rate well above it. Several also offer
            something Lakewood doesn&rsquo;t have at all: views. The Renton
            home in particular pairs a genuinely beautiful view with one of
            the best locations of the whole group.
          </p>
        </section>

        <section style={{ textAlign: "center", marginBottom: 56 }}>
          <h2
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "clamp(26px, 3.8vw, 34px)",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Where They Sit
          </h2>
          <p
            style={{
              fontSize: 14.5,
              color: "var(--mkt-muted-light)",
              maxWidth: 620,
              margin: "0 auto 22px",
              lineHeight: 1.6,
            }}
          >
            Every pin is one of the fourteen — olive pins are our top picks,
            the dark pin is the Lakewood house. Click any pin to open its
            Redfin listing.
          </p>
          <CompareMap
            listings={LISTINGS.map(
              ({ address, shortPrice, lat, lng, url, topPick, subject }) => ({
                address,
                shortPrice,
                lat,
                lng,
                url,
                topPick,
                subject,
              })
            )}
          />
        </section>

        <section
          style={{
            overflowX: "auto",
            marginBottom: 10,
            borderRadius: 12,
            border: "1px solid #e4e1d6",
            boxShadow: "0 4px 20px rgba(22,22,20,0.06)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 700,
              background: "#fffefb",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--mkt-dark)",
                  color: "var(--mkt-text-on-dark)",
                }}
              >
                <th style={{ ...headCell, textAlign: "left" }}>Address</th>
                <th style={{ ...headCell, textAlign: "right" }}>Price</th>
                <th style={{ ...headCell, textAlign: "right" }}>Bd/Ba</th>
                <th style={{ ...headCell, textAlign: "right" }}>Sq Ft</th>
                <th style={{ ...headCell, textAlign: "right" }}>Lot (sq ft)</th>
                <th style={{ ...headCell, textAlign: "center" }}>Listing</th>
              </tr>
            </thead>
            <tbody>
              {LISTINGS.map((l) => (
                <tr
                  key={l.address}
                  style={l.subject ? { background: "#f6f4e7" } : undefined}
                >
                  <td style={{ ...cellStyle, fontWeight: l.subject ? 600 : 450 }}>
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: 20,
                        color: "#a8a679",
                        fontSize: 12,
                      }}
                    >
                      {l.subject ? "●" : l.topPick ? "★" : ""}
                    </span>
                    {l.address}
                    {l.subject && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 10.5,
                          fontWeight: 500,
                          color: "#8a6c00",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        under consideration
                      </span>
                    )}
                  </td>
                  <td style={{ ...numCell, fontWeight: 600 }}>{l.price}</td>
                  <td style={numCell}>{l.bdba}</td>
                  <td style={numCell}>{l.sqft}</td>
                  <td style={numCell}>{l.lot}</td>
                  <td style={{ ...cellStyle, textAlign: "center" }}>
                    {l.url ? (
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-block",
                          padding: "3px 13px",
                          borderRadius: 999,
                          border: "1px solid #b9b68a",
                          color: "#585732",
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Redfin&thinsp;↗
                      </a>
                    ) : (
                      <span style={{ color: "#c4c1b2", fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p
          style={{
            fontSize: 12.5,
            color: "var(--mkt-muted-light)",
            marginBottom: 64,
            paddingLeft: 4,
          }}
        >
          ★ our top picks &ensp;·&ensp; ● the Lakewood house under consideration
        </p>

        <section>
          <h2
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "clamp(26px, 3.8vw, 34px)",
              fontWeight: 500,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            The Homes
          </h2>
          <p
            style={{
              fontSize: 14.5,
              color: "var(--mkt-muted-light)",
              maxWidth: 620,
              margin: "0 auto 28px",
              lineHeight: 1.6,
              textAlign: "center",
            }}
          >
            Click any home to open its full Redfin listing.
          </p>
          { }
          <style>{`
            .cmp-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
            .cmp-card:hover { transform: translateY(-4px) scale(1.015); box-shadow: 0 12px 32px rgba(22,22,20,0.18); }
          `}</style>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {LISTINGS.filter((l) => l.photo && l.url).map((l) => (
              <a
                key={l.address}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="cmp-card"
                style={{
                  display: "block",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid #e4e1d6",
                  background: "#fffefb",
                  textDecoration: "none",
                  color: "var(--mkt-text-on-light)",
                  boxShadow: "0 3px 14px rgba(22,22,20,0.07)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.photo}
                  alt={l.address}
                  width={720}
                  height={514}
                  loading="lazy"
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "10px 14px 11px",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {l.topPick && (
                      <span aria-hidden style={{ color: "#a8a679", marginRight: 6, fontSize: 11.5 }}>★</span>
                    )}
                    {l.address}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 650, color: "#585732", whiteSpace: "nowrap" }}>
                    {l.price}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <footer
          style={{
            marginTop: 72,
            paddingTop: 28,
            borderTop: "1px solid #e4e1d6",
            textAlign: "center",
            fontSize: 13,
            color: "var(--mkt-muted-light)",
          }}
        >
          Prepared by BT Investments · June 2026 · Questions? Reply to the
          text or email that brought you here.
        </footer>
      </main>
    </div>
  );
}
