// src/components/listing-pages/ListingPageV2.tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { neighborhoodPresetPhotoPath } from '@/lib/listing-pages/neighborhoods'
import type { ListingPageV2InputsType } from '@/lib/validations/listing-page-v2'
import { MarketingNav } from '@/components/marketing/MarketingNav'

const PHONE_DISPLAY = '(425) 971-2331'
const PHONE_SMS = 'sms:+14259712331'
const PHOTOS_BUCKET = 'listing-page-photos'

function publicPhotoUrl(storagePath: string): string {
  const admin = createAdminClient()
  return admin.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

function fallbackSubtitle(inputs: ListingPageV2InputsType): string {
  const parts: string[] = []
  if (inputs.beds != null && inputs.baths != null) {
    parts.push(`${inputs.beds} bed / ${inputs.baths} bath`)
  }
  if (inputs.sqft != null) parts.push(`${inputs.sqft.toLocaleString()} sf`)
  parts.push(`${inputs.lotSize} lot`)
  if (inputs.yearBuilt != null) parts.push(`built ${inputs.yearBuilt}`)
  return parts.join(' · ')
}

// Strip city/state/zip from the address for the big headline — the
// eyebrow above already shows the city, so repeating it reads awkward.
// "525 Main St, Seattle, WA 98101" -> "525 Main St"
function streetOnly(address: string): string {
  const first = address.split(',')[0]?.trim()
  return first || address
}

// Inline CSS for hover effects on the diligence buttons and the fade-up
// load animation. Co-located with the component so the whole page is
// self-contained.
const LPV2_CSS = `
.lpv2-link {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--mkt-olive);
  color: #fff;
  text-decoration: none;
  border-radius: 12px;
  transition: background 180ms ease, transform 180ms ease, box-shadow 180ms ease;
  box-shadow: 0 1px 0 rgba(0,0,0,0.04);
}
.lpv2-link:hover {
  background: var(--mkt-olive-light);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(88,87,50,0.18);
}
.lpv2-link .lpv2-link-ic {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.18);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.lpv2-link .lpv2-link-lbl {
  display: block;
  font-size: 9.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.7);
  font-weight: 600;
}
.lpv2-link .lpv2-link-ttl {
  display: block;
  font-family: var(--font-cormorant), Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  margin-top: 2px;
  color: #fff;
}

@keyframes lpv2FadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lpv2FadeIn {
  from { opacity: 0; transform: scale(0.985); }
  to   { opacity: 1; transform: scale(1); }
}
.lpv2-fade   { animation: lpv2FadeUp 0.7s cubic-bezier(.22,1,.36,1) backwards; }
.lpv2-fade-img { animation: lpv2FadeIn 0.9s cubic-bezier(.22,1,.36,1) backwards; }
`

function neighborhoodPhotoUrl(
  neighborhood: ListingPageV2InputsType['neighborhood'],
): string | null {
  if (neighborhood.mode === 'hidden') return null
  if (neighborhood.mode === 'preset') {
    return neighborhoodPresetPhotoPath(neighborhood.slug)
  }
  return publicPhotoUrl(neighborhood.photoPath)
}

export function ListingPageV2({ inputs }: { inputs: ListingPageV2InputsType }) {
  const frontUrl = publicPhotoUrl(inputs.frontPhotoPath)
  const satelliteUrl = publicPhotoUrl(inputs.satellitePhotoPath)
  const mapUrl = inputs.mapPhotoPath ? publicPhotoUrl(inputs.mapPhotoPath) : null
  // Hero photo can be its own upload; falls back to the front photo so
  // legacy v2 rows (and admins who skip the optional slot) still render.
  const heroUrl = inputs.heroPhotoPath ? publicPhotoUrl(inputs.heroPhotoPath) : frontUrl
  const subtitle = inputs.customSubtitle?.trim() || fallbackSubtitle(inputs)
  const headlineAddress = streetOnly(inputs.address)
  const nbhdUrl = neighborhoodPhotoUrl(inputs.neighborhood)
  const nbhdLabel =
    inputs.neighborhood.mode === 'hidden' ? null : inputs.neighborhood.label

  return (
    <div className="marketing-scope" style={{ background: 'var(--mkt-cream)', minHeight: '100vh' }}>
      <style>{LPV2_CSS}</style>
      <MarketingNav />
      <div style={styles.page}>
        {/* NAV */}
        <div className="lpv2-fade" style={{ ...styles.miniNav, animationDelay: '0s' }}>
          <span style={styles.wordmark}>
            BT<span style={styles.wordmarkInvest}>Investments</span>
          </span>
          <span style={styles.navStatus}>Off-Market Opportunity</span>
        </div>

        {/* HERO */}
        <div style={styles.hero}>
          <div className="lpv2-fade" style={{ ...styles.eyebrow, animationDelay: '0.08s' }}>{inputs.cityEyebrow}</div>
          <h1 className="lpv2-fade" style={{ ...styles.address, animationDelay: '0.18s' }}>{headlineAddress}</h1>
          <p className="lpv2-fade" style={{ ...styles.sub, animationDelay: '0.28s' }}>{subtitle}</p>
          <div className="lpv2-fade" style={{ ...styles.meta, animationDelay: '0.38s' }}>
            <MetaItem label="Price" value={inputs.price} accent />
            <MetaItem label="EMD" value="$10,000" />
            <MetaItem label="Close" value="ASAP" />
          </div>
        </div>

        {/* HERO PHOTO */}
        <div className="lpv2-fade-img" style={{ ...styles.heroPhotoFrame, animationDelay: '0.48s' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroUrl} alt={inputs.address} style={styles.fillPhoto} />
        </div>

        {/* TEXT-US BAND */}
        <div className="lpv2-fade" style={{ ...styles.textBand, animationDelay: '0.62s' }}>
          <div style={styles.textBandLeft}>
            <span style={styles.textBandIcon}>
              <MessageIcon />
            </span>
            <div style={styles.textBandCopy}>
              <span style={styles.textBandTop}>Interested? Text us</span>
              <span style={styles.textBandBot}>Fastest way to lock this deal</span>
            </div>
          </div>
          <a href={PHONE_SMS} style={styles.textBandCta}>{PHONE_DISPLAY}</a>
        </div>

        {/* PROPERTY HIGHLIGHTS */}
        <section style={styles.section}>
          <div style={styles.sectEyebrow}>{inputs.highlightsEyebrow}</div>
          <h2 style={styles.sectTitle}>Property Highlights</h2>
          <div style={styles.sectRule} />
          <div style={styles.pills}>
            {inputs.beds != null && inputs.baths != null ? (
              <Pill><strong style={styles.pillStrong}>{inputs.beds} Bed</strong> · {inputs.baths} Bath</Pill>
            ) : null}
            {inputs.sqft != null ? (
              <Pill><strong style={styles.pillStrong}>{inputs.sqft.toLocaleString()}</strong> sq ft</Pill>
            ) : null}
            <Pill><strong style={styles.pillStrong}>{inputs.lotSize}</strong> lot</Pill>
            {inputs.yearBuilt != null ? (
              <Pill>Built <strong style={styles.pillStrong}>{inputs.yearBuilt}</strong></Pill>
            ) : null}
            <Pill>Zoning <strong style={styles.pillStrong}>{inputs.zoning}</strong> <span style={{ color: 'var(--mkt-muted-light)' }}>(verify)</span></Pill>
            {inputs.occupancy ? <Pill>{inputs.occupancy}</Pill> : null}
            {(inputs.highlightBullets ?? []).map((b) => <Pill key={b}>{b}</Pill>)}
          </div>

          <div style={styles.photoGrid}>
            <div style={styles.photoFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frontUrl} alt="Front" style={styles.fillPhoto} />
            </div>
            <div style={styles.photoFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={satelliteUrl} alt="Satellite" style={styles.fillPhoto} />
            </div>
          </div>

          {/* DILIGENCE LINKS */}
          <div style={styles.links}>
            <a href={inputs.countyPageLink} target="_blank" rel="noopener noreferrer" className="lpv2-link">
              <span className="lpv2-link-ic"><HouseIcon /></span>
              <span>
                <span className="lpv2-link-lbl">County Records</span>
                <span className="lpv2-link-ttl">View Parcel Page →</span>
              </span>
            </a>
            <a href={inputs.googleDriveLink} target="_blank" rel="noopener noreferrer" className="lpv2-link">
              <span className="lpv2-link-ic"><DownloadIcon /></span>
              <span>
                <span className="lpv2-link-lbl">Google Drive</span>
                <span className="lpv2-link-ttl">Photos & Documents →</span>
              </span>
            </a>
          </div>
        </section>

        {/* ARV DARK BAND */}
        <section style={styles.arv}>
          <div style={styles.arvEyebrow}>Comparable Sales</div>
          <h2 style={styles.arvTitle}>Estimated ARV based off nearby sales</h2>
          <div style={styles.arvRangeRow}>
            <span style={styles.arvRange}>{inputs.arvRange}</span>
          </div>
          <p style={styles.arvNote}>
            Range pulled from comparable sales within ~0.5 miles in the last three months.
            Buyer to verify with their own comps and underwriting.
          </p>
        </section>

        {/* NEIGHBORHOOD */}
        {nbhdUrl && nbhdLabel ? (
          <section style={styles.section}>
            <div style={styles.sectEyebrow}>The Neighborhood</div>
            <h2 style={styles.nbhdName}>{nbhdLabel}</h2>
            <div style={styles.nbhdPhotoFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={nbhdUrl} alt={nbhdLabel} style={styles.fillPhoto} />
            </div>
          </section>
        ) : null}

        {/* AREA MAP */}
        {mapUrl ? (
          <section style={styles.section}>
            <div style={styles.sectEyebrow}>Location</div>
            <h2 style={styles.sectTitle}>Area Map</h2>
            <div style={styles.mapPhotoFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mapUrl} alt="Area map" style={styles.fillPhoto} />
            </div>
          </section>
        ) : null}

        {/* FOOTER */}
        <footer style={styles.footer}>
          <div style={styles.footerEyebrow}>Make a Move</div>
          <h2 style={styles.footerTitle}>Lock this deal — text us.</h2>
          <a href={PHONE_SMS} style={styles.footerCta}>{PHONE_DISPLAY}</a>
          <p style={styles.footerDisc}>
            Buyer to verify all information, zoning/uses, and compliance requirements with the City.
            As-Is; buyer responsible for compliance after closing. BT Investments LLC — Local · Simple · Direct.
          </p>
          <div style={styles.footerBrand}>BT INVESTMENTS</div>
        </footer>
      </div>
    </div>
  )
}

function MetaItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={{ ...styles.metaValue, color: accent ? 'var(--mkt-olive)' : 'var(--mkt-text-on-light)' }}>{value}</span>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={styles.pill}>{children}</span>
}

function MessageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function HouseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: '0 auto', padding: '0 20px 80px', fontFamily: 'var(--font-inter), system-ui, sans-serif', color: 'var(--mkt-text-on-light)', lineHeight: 1.5 },
  miniNav: { padding: '56px 4px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 24, fontWeight: 500, letterSpacing: '0.01em' },
  wordmarkInvest: { fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: 9.5, letterSpacing: '0.42em', textTransform: 'uppercase', color: '#76794c', marginLeft: 10, verticalAlign: 'middle', fontWeight: 500 },
  navStatus: { fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--mkt-muted-light)', fontWeight: 600 },

  hero: { padding: '28px 4px 36px' },
  eyebrow: { fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: '#76794c', fontWeight: 500, marginBottom: 18 },
  address: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 'clamp(36px, 6.4vw, 64px)', fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.01em', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip' },
  sub: { fontSize: 14.5, color: 'var(--mkt-muted-light)', marginTop: 18, maxWidth: 520, lineHeight: 1.55 },
  meta: { marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 42, paddingTop: 24, borderTop: '1px dashed rgba(0,0,0,.18)' },
  metaLabel: { fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mkt-muted-light)', fontWeight: 600 },
  metaValue: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 'clamp(36px, 5vw, 48px)', fontWeight: 500, lineHeight: 1 },

  heroPhotoFrame: { position: 'relative', aspectRatio: '5/3', borderRadius: 14, overflow: 'hidden', marginTop: 8, background: 'var(--mkt-cream-dim)' },
  fillPhoto: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },

  textBand: { marginTop: 24, padding: '18px 22px', background: 'var(--mkt-cream-dim)', border: '1px dashed rgba(88,87,50,.4)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' },
  textBandLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  textBandIcon: { width: 38, height: 38, borderRadius: '50%', background: 'var(--mkt-olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 },
  textBandCopy: { display: 'flex', flexDirection: 'column' },
  textBandTop: { fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--mkt-muted-light)', fontWeight: 600 },
  textBandBot: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 21, color: 'var(--mkt-text-on-light)', fontWeight: 500, lineHeight: 1.1, marginTop: 2 },
  textBandCta: { fontSize: 15, fontWeight: 600, color: '#fff', background: 'var(--mkt-olive)', padding: '12px 20px', borderRadius: 999, textDecoration: 'none', letterSpacing: '0.02em' },

  section: { marginTop: 56 },
  sectEyebrow: { fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'var(--mkt-olive)', fontWeight: 600, marginBottom: 10 },
  sectTitle: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 38, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0 },
  sectRule: { height: 1, background: 'rgba(0,0,0,.12)', marginTop: 22 },

  pills: { marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 },
  pill: { fontSize: 12, letterSpacing: '0.06em', padding: '9px 14px', border: '1px solid rgba(0,0,0,.15)', borderRadius: 999, background: 'var(--mkt-cream)', color: 'var(--mkt-text-on-light)', fontWeight: 500 },
  pillStrong: { color: 'var(--mkt-olive)', fontWeight: 700 },

  photoGrid: { marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  photoFrame: { position: 'relative', aspectRatio: '5/4', borderRadius: 12, overflow: 'hidden', background: 'var(--mkt-cream-dim)' },

  links: { marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },

  arv: { marginTop: 40, background: 'var(--mkt-dark)', color: 'var(--mkt-text-on-dark)', borderRadius: 18, padding: 40 },
  arvEyebrow: { fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'var(--mkt-olive-pale)', fontWeight: 600, marginBottom: 14 },
  arvTitle: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 32, fontWeight: 500, lineHeight: 1.05, maxWidth: 540, margin: 0 },
  arvRangeRow: { marginTop: 28, display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' },
  arvRange: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 60, fontWeight: 500, color: 'var(--mkt-olive-pale)', lineHeight: 1, letterSpacing: '-0.015em' },
  arvNote: { fontSize: 12.5, color: 'var(--mkt-muted-dark)', marginTop: 18, maxWidth: 560, lineHeight: 1.55 },

  nbhdName: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 54, fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.01em', marginTop: 6 },
  nbhdPhotoFrame: { position: 'relative', aspectRatio: '16/9', borderRadius: 14, overflow: 'hidden', background: 'var(--mkt-cream-dim)', marginTop: 24 },
  mapPhotoFrame: { position: 'relative', aspectRatio: '5/4', borderRadius: 14, overflow: 'hidden', background: 'var(--mkt-cream-dim)', marginTop: 24 },

  footer: { marginTop: 80, background: 'var(--mkt-dark)', color: 'var(--mkt-text-on-dark)', borderRadius: 18, padding: '44px 40px', textAlign: 'center' },
  footerEyebrow: { fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'var(--mkt-olive-pale)', fontWeight: 600 },
  footerTitle: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 34, fontWeight: 500, marginTop: 14 },
  footerCta: { display: 'inline-block', marginTop: 24, fontSize: 16, fontWeight: 600, color: '#fff', background: 'var(--mkt-olive)', padding: '14px 26px', borderRadius: 999, textDecoration: 'none', letterSpacing: '0.04em' },
  footerDisc: { marginTop: 32, fontSize: 11.5, color: 'var(--mkt-muted-dark)', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 },
  footerBrand: { marginTop: 24, fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'var(--mkt-muted-dark)', fontWeight: 500 },
}
