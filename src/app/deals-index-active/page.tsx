import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { PageBranding } from "@/components/marketing/PageBranding";

export const dynamic = "force-dynamic";

const PHOTOS_BUCKET = "listing-page-photos";

export const metadata: Metadata = {
  title: "BT Investments — Active Deals",
  description: "Browse current real estate investment opportunities from BT Investments.",
};

type IndexRow = {
  slug: string;
  address: string;
  page_type: string;
  inputs: Record<string, unknown> | null;
  created_at: string;
};

function pickPhotoPath(inputs: Record<string, unknown> | null): string | null {
  if (!inputs) return null;
  const hero = (inputs as { heroPhotoPath?: string }).heroPhotoPath;
  if (typeof hero === "string" && hero.length > 0) return hero;
  const front = (inputs as { frontPhotoPath?: string }).frontPhotoPath;
  if (typeof front === "string" && front.length > 0) return front;
  return null;
}

function pickPrice(inputs: Record<string, unknown> | null): string | null {
  if (!inputs) return null;
  const price = (inputs as { price?: string }).price;
  return typeof price === "string" && price.length > 0 ? price : null;
}

export default async function DealsIndexActivePage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("listing_pages")
    .select("slug, address, page_type, inputs, created_at")
    .eq("is_active", true)
    .eq("show_on_index", true)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as IndexRow[];

  return (
    <div className="marketing-scope" style={{ background: "var(--mkt-cream)", minHeight: "100vh" }}>
      <MarketingNav />

      <main
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "72px 24px 120px",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          color: "var(--mkt-text-on-light)",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-block", marginBottom: 36 }}>
            <PageBranding />
          </div>
          <p
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--mkt-olive-light)",
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            Active Deals
          </p>
          <h1
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "clamp(40px, 6vw, 56px)",
              fontWeight: 500,
              lineHeight: 1.05,
              color: "var(--mkt-text-on-light)",
              margin: 0,
            }}
          >
            Current Opportunities
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--mkt-text-on-light)",
              opacity: 0.75,
              marginTop: 18,
              maxWidth: 540,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.6,
            }}
          >
            Off-market investment properties currently available through BT Investments. Click any
            card to see full details.
          </p>
        </header>

        {rows.length === 0 ? (
          <div
            style={{
              padding: "80px 24px",
              textAlign: "center",
              borderRadius: 12,
              background: "var(--mkt-cream-dim)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontSize: 22,
                color: "var(--mkt-olive)",
                margin: 0,
                fontStyle: "italic",
              }}
            >
              No active deals right now.
            </p>
            <p style={{ marginTop: 8, fontSize: 14, opacity: 0.7 }}>Check back soon.</p>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 18,
            }}
            className="lpv2-deals-grid"
          >
            {rows.map((row) => (
              <DealCard key={row.slug} row={row} />
            ))}
          </ul>
        )}
      </main>

      {/* Responsive grid: 2 cols mobile, 3 cols tablet+ */}
      <style>{`
        /* Mobile: shift the photo/text balance toward the photo (~70/30) */
        .lpv2-deal-photo { aspect-ratio: 4 / 3; }
        .lpv2-deal-body { padding: 10px 12px 12px; }
        .lpv2-deal-address { font-size: 17px; line-height: 1.2; }
        .lpv2-deal-price { font-size: 11px; margin-top: 3px; }

        @media (min-width: 640px) {
          .lpv2-deals-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 28px !important;
          }
          .lpv2-deal-photo { aspect-ratio: 16 / 10; }
          .lpv2-deal-body { padding: 18px 18px 20px; }
          .lpv2-deal-address { font-size: 22px; line-height: 1.2; }
          .lpv2-deal-price { font-size: 13px; margin-top: 6px; }
        }
        .lpv2-deal-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(88, 87, 50, 0.10);
        }
      `}</style>
    </div>
  );
}

function DealCard({ row }: { row: IndexRow }) {
  const photoPath = pickPhotoPath(row.inputs);
  const price = pickPrice(row.inputs);

  let photoUrl: string | null = null;
  if (photoPath) {
    const admin = createAdminClient();
    photoUrl = admin.storage.from(PHOTOS_BUCKET).getPublicUrl(photoPath).data.publicUrl;
  }

  const href = `/deals/${row.slug}`;

  return (
    <li>
      <Link
        href={href}
        style={{
          display: "block",
          textDecoration: "none",
          background: "var(--mkt-cream-dim)",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.05)",
          transition: "transform 200ms ease, box-shadow 200ms ease",
        }}
        className="lpv2-deal-card"
      >
        <div
          className="lpv2-deal-photo"
          style={{
            width: "100%",
            overflow: "hidden",
            background: "rgba(0,0,0,0.04)",
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={row.address}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              loading="lazy"
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontStyle: "italic",
                fontSize: 18,
                color: "var(--mkt-olive-light)",
              }}
            >
              Photo coming soon
            </div>
          )}
        </div>
        <div className="lpv2-deal-body">
          <p
            className="lpv2-deal-address"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 500,
              color: "var(--mkt-text-on-light)",
              margin: 0,
            }}
          >
            {row.address}
          </p>
          {price && (
            <p
              className="lpv2-deal-price"
              style={{
                color: "var(--mkt-olive)",
                fontWeight: 600,
                letterSpacing: "0.02em",
                margin: 0,
              }}
            >
              {price}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
