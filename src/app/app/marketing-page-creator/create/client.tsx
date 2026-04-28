"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getLead } from "@/actions/leads";
import {
  getListingPageUploadUrl,
  getListingPagePhotoUrl,
  createListingPage,
} from "@/actions/listing-pages";
import type { LeadWithAddress, LeadWithRelations, Property } from "@/lib/types";
import { Modal } from "@/components/Modal";

const COUNTY_URLS: Record<string, string> = {
  king: "https://blue.kingcounty.com/Assessor/eRealProperty/Dashboard.aspx?ParcelNbr=%s",
  pierce: "https://atip.piercecountywa.gov/#/app/propertyDetail/%s/summary",
  snohomish: "https://www.snoco.org/proptax/search.aspx?parcel_number=%s",
  thurston: "https://tcproperty.co.thurston.wa.us/propsql/basic.asp?pn=%s",
  kitsap: "https://psearch.kitsapgov.com/details.asp?RPID=%s",
  skagit: "https://www.skagitcounty.net/Search/Property/?id=%s",
};

function buildCountyUrl(county: string | null, apn: string | null): string {
  if (!county || !apn) return "";
  const template = COUNTY_URLS[county.toLowerCase()];
  if (!template) return "";
  return template.replace("%s", apn);
}

async function fetchPlaceholderPhoto(seed: number, label: string): Promise<{ file: File; preview: string }> {
  const url = `https://picsum.photos/seed/${seed}/500/400`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch placeholder: ${res.status}`);
  const blob = await res.blob();
  const file = new File([blob], `${label}.jpg`, { type: blob.type || "image/jpeg" });
  return { file, preview: URL.createObjectURL(blob) };
}

function parseCityFromAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  const candidate = parts[1];
  // Reject "WA 98404" style — that's state + ZIP, not a city
  if (/^[A-Z]{2}\s+\d{5}/.test(candidate)) return "";
  return candidate;
}

type PhotoSlot = {
  file: File | null;
  preview: string;
};

type FormFields = {
  address: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  lotSize: string;
  yearBuilt: string;
  zoning: string;
  occupancy: string;
  nearbySalesRange: string;
  countyPageLink: string;
  googleDriveLink: string;
};

const REQUIRED_FIELDS: (keyof FormFields)[] = [
  "address",
  "price",
  "beds",
  "baths",
  "sqft",
  "lotSize",
  "yearBuilt",
  "zoning",
  "nearbySalesRange",
  "countyPageLink",
  "googleDriveLink",
];

const FIELD_LABELS: Record<keyof FormFields, string> = {
  address: "Address",
  price: "Price",
  beds: "Beds",
  baths: "Baths",
  sqft: "Sqft",
  lotSize: "Lot Size",
  yearBuilt: "Year Built",
  zoning: "Zoning",
  occupancy: "Occupancy (optional)",
  nearbySalesRange: "Nearby Sales Range",
  countyPageLink: "County Page Link",
  googleDriveLink: "Google Drive Photos Link",
};

export function CreateListingPageClient({
  leads,
}: {
  leads: LeadWithAddress[];
}) {
  const router = useRouter();
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [leadData, setLeadData] = useState<LeadWithRelations | null>(null);
  const [selectedPropertyIdx, setSelectedPropertyIdx] = useState(0);
  const [loadingLead, setLoadingLead] = useState(false);

  const [fields, setFields] = useState<FormFields>({
    address: "",
    price: "",
    beds: "",
    baths: "",
    sqft: "",
    lotSize: "",
    yearBuilt: "",
    zoning: "",
    occupancy: "",
    nearbySalesRange: "",
    countyPageLink: "",
    googleDriveLink: "",
  });

  const [frontPhoto, setFrontPhoto] = useState<PhotoSlot>({
    file: null,
    preview: "",
  });
  const [satellitePhoto, setSatellitePhoto] = useState<PhotoSlot>({
    file: null,
    preview: "",
  });
  const [mapPhoto, setMapPhoto] = useState<PhotoSlot>({
    file: null,
    preview: "",
  });

  const frontRef = useRef<HTMLInputElement>(null);
  const satRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLInputElement>(null);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [pendingType, setPendingType] = useState<null | "webpage" | "html">(null);
  const [styleId, setStyleId] = useState("listing-page-v1");

  function updateField(key: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function prefillFromProperty(property: Property, lead: LeadWithRelations) {
    setFields({
      address: property.address || "",
      price: lead.asking_price || "",
      beds: property.bedrooms?.toString() || "",
      baths: property.bathrooms?.toString() || "",
      sqft: property.sqft?.toString() || "",
      lotSize: property.lot_size || "",
      yearBuilt: property.year_built?.toString() || "",
      zoning: property.zoning || "",
      occupancy: lead.occupancy_status || "",
      nearbySalesRange: "",
      countyPageLink: buildCountyUrl(property.county, property.apn),
      googleDriveLink: "",
    });
  }

  async function handleSelectLead(leadId: string) {
    setSelectedLeadId(leadId);
    if (!leadId) {
      setLeadData(null);
      return;
    }

    setLoadingLead(true);
    const result = await getLead(leadId);
    setLoadingLead(false);

    if (result.success) {
      setLeadData(result.data);
      setSelectedPropertyIdx(0);
      if (result.data.properties.length > 0) {
        prefillFromProperty(result.data.properties[0], result.data);
      }
    }
  }

  function handleSelectProperty(idx: number) {
    setSelectedPropertyIdx(idx);
    if (leadData && leadData.properties[idx]) {
      prefillFromProperty(leadData.properties[idx], leadData);
    }
  }

  function handlePhotoSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: PhotoSlot) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setter({ file, preview: URL.createObjectURL(file) });
    e.target.value = "";
  }

  const [prefilling, setPrefilling] = useState(false);

  async function handlePrefillMock() {
    setPrefilling(true);
    setError("");
    try {
      setFields({
        address: "12345 Mock Lane, Tacoma, WA 98404",
        price: "$385,000",
        beds: "3",
        baths: "2",
        sqft: "1450",
        lotSize: "7200 sqft",
        yearBuilt: "1978",
        zoning: "R-2",
        occupancy: "Vacant",
        nearbySalesRange: "$370k-$420k (similar size)",
        countyPageLink: "https://atip.piercecountywa.gov/#/app/propertyDetail/MOCK/summary",
        googleDriveLink: "https://drive.google.com/drive/folders/MOCK",
      });
      const [front, sat, map] = await Promise.all([
        fetchPlaceholderPhoto(1, "front"),
        fetchPlaceholderPhoto(2, "satellite"),
        fetchPlaceholderPhoto(3, "map"),
      ]);
      setFrontPhoto(front);
      setSatellitePhoto(sat);
      setMapPhoto(map);
    } catch (e) {
      setError("Mock prefill failed: " + (e as Error).message);
    } finally {
      setPrefilling(false);
    }
  }

  const allRequiredFilled =
    REQUIRED_FIELDS.every((k) => fields[k].trim() !== "") &&
    frontPhoto.file !== null &&
    satellitePhoto.file !== null &&
    mapPhoto.file !== null;

  async function uploadPhoto(
    listingPageId: string,
    fileName: string,
    file: File
  ): Promise<string> {
    const ext = file.name.split(".").pop() || "jpg";
    const storageName = `${fileName}.${ext}`;
    const urlResult = await getListingPageUploadUrl(listingPageId, storageName);
    if (!urlResult.success) throw new Error(urlResult.error);

    const uploadRes = await fetch(urlResult.data.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
    });
    if (!uploadRes.ok) throw new Error("Photo upload failed");

    const publicResult = await getListingPagePhotoUrl(urlResult.data.path);
    if (!publicResult.success) throw new Error(publicResult.error);
    return publicResult.data;
  }

  async function handleGenerate(pageType: "webpage" | "html") {
    if (!allRequiredFilled) {
      setAttempted(true);
      return;
    }

    const city = parseCityFromAddress(fields.address);

    setGenerating(true);
    setError("");

    const newTab = window.open("about:blank", "_blank");

    try {
      const listingPageId = crypto.randomUUID();

      const [frontUrl, satUrl, mapUrl] = await Promise.all([
        uploadPhoto(listingPageId, "front", frontPhoto.file!),
        uploadPhoto(listingPageId, "satellite", satellitePhoto.file!),
        uploadPhoto(listingPageId, "map", mapPhoto.file!),
      ]);

      const res = await fetch("/api/listing-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: fields.address,
          price: fields.price,
          beds: Number(fields.beds),
          baths: Number(fields.baths),
          sqft: Number(fields.sqft),
          lotSize: fields.lotSize,
          yearBuilt: Number(fields.yearBuilt),
          zoning: fields.zoning,
          occupancy: fields.occupancy || "",
          nearbySalesRange: fields.nearbySalesRange,
          countyPageLink: fields.countyPageLink,
          googleDriveLink: fields.googleDriveLink,
          frontPhotoUrl: frontUrl,
          satellitePhotoUrl: satUrl,
          mapPhotoUrl: mapUrl,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        if (newTab) newTab.close();
        setError(json.error || "Generation failed");
        return;
      }

      const saveResult = await createListingPage({
        id: listingPageId,
        lead_id: selectedLeadId || null,
        property_id: leadData?.properties[selectedPropertyIdx]?.id || null,
        address: fields.address,
        price: fields.price,
        city,
        page_type: pageType,
        style_id: styleId,
        html_content: json.html,
        inputs: fields as unknown as Record<string, unknown>,
      });

      if (!saveResult.success) {
        if (newTab) newTab.close();
        setError("HTML generated but could not save: " + saveResult.error);
        return;
      }

      const publicHref =
        pageType === "webpage"
          ? `/deals/${saveResult.data.slug}`
          : `/deals/html/${saveResult.data.slug}`;
      if (newTab) {
        newTab.location.href = publicHref;
      } else {
        // Popup was blocked; navigate this tab as a fallback
        window.location.href = publicHref;
        return;
      }
      router.push("/app/marketing-page-creator");
    } catch (e) {
      if (newTab) newTab.close();
      setError((e as Error).message);
    } finally {
      setGenerating(false);
      setPendingType(null);
    }
  }

  const filteredLeads = leadSearch
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
          (l.address &&
            l.address.toLowerCase().includes(leadSearch.toLowerCase()))
      )
    : leads;

  function isFieldEmpty(key: keyof FormFields) {
    return attempted && REQUIRED_FIELDS.includes(key) && fields[key].trim() === "";
  }

  return (
    <>
      {process.env.NODE_ENV !== "production" && (
        <button
          type="button"
          onClick={handlePrefillMock}
          disabled={prefilling || generating}
          className="fixed top-20 right-6 z-40 rounded-md border-2 border-yellow-600 bg-yellow-300 px-3 py-1.5 text-xs font-bold text-yellow-900 shadow-lg hover:bg-yellow-400 disabled:opacity-50"
        >
          {prefilling ? "Loading mock…" : "🧪 Pre-fill mock data"}
        </button>
      )}
      <div className="space-y-6">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Lead & Property Selection */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">Select Lead</h3>

        {/* Dropdown selector */}
        <select
          value={selectedLeadId}
          onChange={(e) => {
            const lead = leads.find((l) => l.id === e.target.value);
            setLeadSearch(lead?.name || "");
            handleSelectLead(e.target.value);
          }}
          className="w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm font-editable"
        >
          <option value="">Choose a lead...</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.name}{lead.address ? ` — ${lead.address}` : ""}
            </option>
          ))}
        </select>

        {/* Search filter */}
        <div className="relative">
          <input
            type="text"
            placeholder="Or search by name or address..."
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            className="w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm font-editable"
          />
          {leadSearch && !selectedLeadId && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border border-neutral-200 bg-white shadow-lg">
              {filteredLeads.length === 0 ? (
                <div className="px-3 py-2 text-xs text-neutral-400">
                  No leads found
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => {
                      setLeadSearch(lead.name);
                      handleSelectLead(lead.id);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                  >
                    <span className="font-medium">{lead.name}</span>
                    {lead.address && (
                      <span className="text-neutral-400 ml-2 text-xs">
                        {lead.address}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedLeadId && (
          <button
            type="button"
            onClick={() => {
              setSelectedLeadId("");
              setLeadData(null);
              setLeadSearch("");
              setFields({
                address: "",
                price: "",
                beds: "",
                baths: "",
                sqft: "",
                lotSize: "",
                yearBuilt: "",
                zoning: "",
                occupancy: "",
                nearbySalesRange: "",
                countyPageLink: "",
                googleDriveLink: "",
              });
            }}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            Clear selection
          </button>
        )}

        {loadingLead && (
          <p className="text-xs text-neutral-400 animate-pulse">
            Loading lead data...
          </p>
        )}

        {/* Property selector (if lead has multiple) */}
        {leadData && leadData.properties.length > 1 && (
          <div className="space-y-1">
            <span className="text-xs text-neutral-500">Select Property</span>
            <div className="flex gap-2">
              {leadData.properties.map((prop, idx) => (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => handleSelectProperty(idx)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    idx === selectedPropertyIdx
                      ? "border-neutral-800 bg-neutral-800 text-white"
                      : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {prop.address || `Property ${idx + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Property Details Form */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-medium text-neutral-700">
          Property Details
        </h3>

        {/* Address & Price */}
        <div className="grid gap-3 md:grid-cols-2">
          {(["address", "price"] as const).map((key) => (
            <label key={key} className="block">
              <span className="text-xs text-neutral-500">
                {FIELD_LABELS[key]}
              </span>
              <input
                value={fields[key]}
                onChange={(e) => updateField(key, e.target.value)}
                className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable ${
                  isFieldEmpty(key)
                    ? "border-red-300 bg-red-50"
                    : "border-neutral-300 bg-neutral-100"
                }`}
              />
            </label>
          ))}
        </div>

        {/* Property specs */}
        <div className="grid gap-3 md:grid-cols-3">
          {(
            ["beds", "baths", "sqft", "lotSize", "yearBuilt", "zoning"] as const
          ).map((key) => (
            <label key={key} className="block">
              <span className="text-xs text-neutral-500">
                {FIELD_LABELS[key]}
              </span>
              <input
                value={fields[key]}
                onChange={(e) => updateField(key, e.target.value)}
                className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable ${
                  isFieldEmpty(key)
                    ? "border-red-300 bg-red-50"
                    : "border-neutral-300 bg-neutral-100"
                }`}
              />
            </label>
          ))}
        </div>

        {/* Occupancy */}
        <label className="block">
          <span className="text-xs text-neutral-500">
            {FIELD_LABELS.occupancy}
          </span>
          <input
            value={fields.occupancy}
            onChange={(e) => updateField("occupancy", e.target.value)}
            className="mt-0.5 w-full rounded border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-sm font-editable"
          />
        </label>
      </section>

      {/* Links & Sales */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-medium text-neutral-700">
          Links & Nearby Sales
        </h3>

        <label className="block">
          <span className="text-xs text-neutral-500">
            {FIELD_LABELS.nearbySalesRange}
          </span>
          <input
            value={fields.nearbySalesRange}
            onChange={(e) => updateField("nearbySalesRange", e.target.value)}
            placeholder="$350k-$425k (similar size)"
            className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable placeholder:text-neutral-300 ${
              isFieldEmpty("nearbySalesRange")
                ? "border-red-300 bg-red-50"
                : "border-neutral-300 bg-neutral-100"
            }`}
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-500">
            {FIELD_LABELS.countyPageLink}
          </span>
          <input
            value={fields.countyPageLink}
            onChange={(e) => updateField("countyPageLink", e.target.value)}
            className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable ${
              isFieldEmpty("countyPageLink")
                ? "border-red-300 bg-red-50"
                : "border-neutral-300 bg-neutral-100"
            }`}
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-500">
            {FIELD_LABELS.googleDriveLink}
          </span>
          <input
            value={fields.googleDriveLink}
            onChange={(e) => updateField("googleDriveLink", e.target.value)}
            className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable ${
              isFieldEmpty("googleDriveLink")
                ? "border-red-300 bg-red-50"
                : "border-neutral-300 bg-neutral-100"
            }`}
          />
        </label>
      </section>

      {/* Photo Uploads */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-medium text-neutral-700">Photos</h3>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Front Photo */}
          <div>
            <span className="text-xs text-neutral-500">
              Front Photo (5:4)
            </span>
            <input
              ref={frontRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoSelect(e, setFrontPhoto)}
            />
            <div
              onClick={() => frontRef.current?.click()}
              className={`mt-1 cursor-pointer rounded-lg border-2 border-dashed aspect-[5/4] flex items-center justify-center overflow-hidden transition-colors ${
                frontPhoto.preview
                  ? "border-neutral-200"
                  : attempted
                    ? "border-red-300 bg-red-50 hover:border-neutral-400 hover:bg-neutral-50"
                    : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100"
              }`}
            >
              {frontPhoto.preview ? (
                <img
                  src={frontPhoto.preview}
                  alt="Front"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-neutral-400">
                  Click to upload
                </span>
              )}
            </div>
          </div>

          {/* Satellite Photo */}
          <div>
            <span className="text-xs text-neutral-500">
              Satellite Photo (5:4)
            </span>
            <input
              ref={satRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoSelect(e, setSatellitePhoto)}
            />
            <div
              onClick={() => satRef.current?.click()}
              className={`mt-1 cursor-pointer rounded-lg border-2 border-dashed aspect-[5/4] flex items-center justify-center overflow-hidden transition-colors ${
                satellitePhoto.preview
                  ? "border-neutral-200"
                  : attempted
                    ? "border-red-300 bg-red-50 hover:border-neutral-400 hover:bg-neutral-50"
                    : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100"
              }`}
            >
              {satellitePhoto.preview ? (
                <img
                  src={satellitePhoto.preview}
                  alt="Satellite"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-neutral-400">
                  Click to upload
                </span>
              )}
            </div>
          </div>

          {/* Map Photo */}
          <div>
            <span className="text-xs text-neutral-500">
              Map Photo (5:4)
            </span>
            <input
              ref={mapRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoSelect(e, setMapPhoto)}
            />
            <div
              onClick={() => mapRef.current?.click()}
              className={`mt-1 cursor-pointer rounded-lg border-2 border-dashed aspect-[5/4] flex items-center justify-center overflow-hidden transition-colors ${
                mapPhoto.preview
                  ? "border-neutral-200"
                  : attempted
                    ? "border-red-300 bg-red-50 hover:border-neutral-400 hover:bg-neutral-50"
                    : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100"
              }`}
            >
              {mapPhoto.preview ? (
                <img
                  src={mapPhoto.preview}
                  alt="Map"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-neutral-400">
                  Click to upload
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Generation buttons */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            if (!allRequiredFilled) {
              setAttempted(true);
              return;
            }
            if (!parseCityFromAddress(fields.address)) {
              setError(
                "Address must include a city — e.g., '12345 Main St, Tacoma'."
              );
              return;
            }
            setError("");
            setPendingType("html");
          }}
          disabled={generating}
          className="rounded-md border border-neutral-300 bg-white px-5 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate HTML
        </button>
        <button
          type="button"
          onClick={() => {
            if (!allRequiredFilled) {
              setAttempted(true);
              return;
            }
            if (!parseCityFromAddress(fields.address)) {
              setError(
                "Address must include a city — e.g., '12345 Main St, Tacoma'."
              );
              return;
            }
            setError("");
            setPendingType("webpage");
          }}
          disabled={generating}
          className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-5 py-2 text-sm font-medium hover:bg-[#dce3cb] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate Webpage
        </button>
      </div>

      {/* Style picker modal */}
      <Modal
        open={pendingType !== null}
        onClose={() => {
          if (!generating) setPendingType(null);
        }}
        title="Choose a design style"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingType(null)}
              disabled={generating}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => pendingType && handleGenerate(pendingType)}
              disabled={generating}
              className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb] disabled:opacity-50"
            >
              {generating ? "Generating…" : "Confirm"}
            </button>
          </>
        }
      >
        <label className="block text-xs text-neutral-500 mb-1">Style</label>
        <select
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
          disabled={generating}
          className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="listing-page-v1">Listing Page v1</option>
        </select>
        <p className="mt-2 text-xs text-neutral-400">
          {pendingType === "webpage"
            ? "Will publish a live page at /deals/[slug]."
            : "Will publish a code + preview view at /deals/html/[slug]."}
        </p>
      </Modal>
    </div>
    </>
  );
}
