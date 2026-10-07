import type { HydratedDocument } from "mongoose";
import type { SiteContentDoc, SiteImage } from "./site-content.model";

export interface SiteContentDTO {
  id: string;
  section: string;
  data: Record<string, unknown>;
  images: SiteImage[];
  isPublished: boolean;
  notes?: string;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertSiteContentInput {
  data?: Record<string, unknown>;
  isPublished?: boolean;
  notes?: string;
}

/**
 * Demo / fallback content baked into the backend so the customer site always
 * has something to render even if the DB has not been seeded. Admins override
 * each section from the panel. Frontend section keys map 1:1 to these keys.
 *
 * Conventions:
 *   - Every landing-page block lives under its own key (hero, stats, cta, faq,
 *     contact).
 *   - About-page blocks share the "about_*" prefix.
 *   - Site-wide brand / contact / footer text lives under "site_settings".
 */
export const SITE_CONTENT_DEFAULTS: Record<string, Record<string, unknown>> = {
  site_settings: {
    brand: "Nepal Yatra",
    brandFull: "Nepal Yatra Tours & Travels",
    legalName: "Nepal Yatra Tours Pvt. Ltd.",
    tagline: "Trusted Nepal Trekking & Tour Operator",
    email: "info@nepalyatratours.com",
    phone: "+977 985-1411830",
    whatsapp: "9779841906050",
    location: "Kathmandu, Nepal",
    address: "Shorakhutte, Kathmandu, Nepal",
    postal: "Nepal · 44600",
    social: {
      facebook: "https://www.facebook.com/himalayasmountainworld",
      instagram: "",
      tripadvisor:
        "https://www.tripadvisor.com/Attraction_Review-g293890-d15594374-Reviews-Himalayas_Mountain_Pvt_Ltd.html",
      youtube: "",
    },
    footerTagline:
      "A Kathmandu-based trekking and tour operator running guided treks, peak climbing, tours and helicopter trips across the Nepal Himalayas.",
    copyrightSuffix: "All rights reserved",
  },

  /**
   * Site-wide SEO fallbacks — the last tier in every page's metadata
   * fallback chain (see `frontend/src/lib/seo.ts#resolveMetadata`). Admins
   * edit this through the same `/content/seo_defaults` UI as any other
   * section; no dedicated "settings" model was added for it.
   */
  seo_defaults: {
    siteUrl: "https://nepalyatratours.com",
    siteName: "Nepal Yatra Tours & Travels",
    defaultMetaTitle: "Nepal Yatra — Tours & Travels in Nepal",
    defaultMetaDescription:
      "Nepal Yatra Tours and Travels — trekking, tours and tailor-made Himalayan adventures across Everest, Annapurna, Langtang, Manaslu and Mustang.",
    defaultKeywords: "Nepal trekking, Everest Base Camp, Annapurna, Himalaya tours",
    defaultOgImage: "",
    defaultTwitterImage: "",
    defaultTwitterCard: "summary_large_image",
    defaultRobots: "index,follow",
    organizationSameAs:
      "https://www.facebook.com/himalayasmountainworld, https://www.tripadvisor.com/Attraction_Review-g293890-d15594374-Reviews-Himalayas_Mountain_Pvt_Ltd.html",
  },

  /**
   * Admin-panel-only UI preferences for the SEO section — never read by the
   * public frontend (kept separate from `seo_defaults`, which the frontend
   * DOES consume, so the two don't get confused). Backed by the same
   * SiteContent infra so the setting is shared across every admin/browser
   * instead of living in a single browser's localStorage.
   */
  seo_admin_preferences: {
    /** When true, clicking a record in the SEO list, or "View live page" in the editor, opens in a new tab. */
    openLinksInNewTab: false,
  },

  hero: {
    eyebrow: "Nepal Himalaya · Since the first footprint",
    title: "Walk where the Himalaya",
    titleAccent: "touches the sky.",
    subtitle: "Explore Nepal's iconic trails with local guides who know every path.",
    ctaPrimaryLabel: "Explore expeditions",
    ctaPrimaryHref: "/tours",
    ctaSecondaryLabel: "Why travel with us",
    ctaSecondaryHref: "/about",
    rotationIntervalMs: 6000,
    autoplay: true,
    overlayOpacity: 0.35,
    align: "left",
  },

  stats: {
    travellers: "1,200+",
    recommend: "98%",
    countries: "40+",
    rating: "4.9",
  },

  faq: {
    eyebrow: "Common Questions",
    title: "Everything you need to know before you trek.",
    items: [
      {
        question: "When is the best time to trek in Nepal?",
        answer:
          "The two main seasons are spring (March–May) and autumn (September–November), with stable weather and clear mountain views.",
      },
      {
        question: "Do I need a guide and permits?",
        answer:
          "Most trekking regions require permits (TIMS, national park / conservation area), and a licensed guide is now mandatory in many areas. We arrange everything.",
      },
      {
        question: "How fit do I need to be?",
        answer:
          "Most teahouse treks need a good level of general fitness — if you can walk 5–6 hours a day on hilly terrain, you can do it. We grade every trip by difficulty.",
      },
    ],
  },

  contact: {
    title: "Plan Your Himalayan Adventure",
    description:
      "Tell us where you'd like to go and we'll build an itinerary around you. We usually reply within 24 hours.",
    email: "info@nepalyatratours.com",
    phone: "+977 985-1411830",
    whatsapp: "+977 984-1906050",
    addressLine1: "Shorakhutte, Kathmandu",
    addressLine2: "Nepal · 44600",
    hours: "Sun – Fri, 9:00 – 18:00 NPT",
    mapEmbedUrl: "",
  },

  about_hero: {
    eyebrow: "About Nepal Yatra",
    accent: "born in the mountains.",
    title: "A Nepal trekking company,",
    description:
      "Nepal Yatra Tours & Travels is a Kathmandu-based, government-licensed operator. Our guides are born in the high valleys we trek, and we run every trip with local porters, fair wages and a deep respect for the mountains.",
  },

  featured_trips: {
    eyebrow: "Pick from the best",
    title: "Top-rated Himalayan treks.",
    description: "Top-rated, customizable trips our travelers love.",
    filters: [
      { key: "all", label: "All Treks" },
      { key: "everest", label: "Everest" },
      { key: "annapurna", label: "Annapurna" },
      { key: "langtang", label: "Langtang" },
      { key: "manaslu", label: "Manaslu" },
    ],
  },

  top10: {
    items: [
      {
        name: "Everest Base Camp Trek",
        days: "14 Days",
        price: "1,390",
        url: "/trek/everest-base-camp-trek",
        img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_181836_f85fe75a-8623-48da-bb2a-afe59d622a14.png",
      },
      {
        name: "Everest View Trek",
        days: "7 Days",
        price: "990",
        url: "/trek/everest-view-trek",
        img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_181836_f85fe75a-8623-48da-bb2a-afe59d622a14.png",
      },
      {
        name: "Everest Base Camp Trek with Heli Return",
        days: "11 Days",
        price: "2,490",
        url: "/trek/everest-base-camp-trek-with-heli-return",
        img: "https://himalayasmountain.com/wp-content/uploads/2025/08/heli.jpg",
      },
      {
        name: "Annapurna Base Camp Trek",
        days: "12 Days",
        price: "990",
        url: "/trek/annapurna-base-camp",
        img: "https://himalayasmountain.com/wp-content/uploads/2025/04/WhatsApp-Image-2024-12-06-at-18.52.11.jpeg",
      },
      {
        name: "Annapurna Circuit Trek",
        days: "13 Days",
        price: "1,290",
        url: "/trek/annapurna-circuit-trek",
        img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_184148_04c593a8-7293-42be-a96d-231387f9caaa.jpeg",
      },
      {
        name: "Ghorepani Poon Hill Trek",
        days: "5 Days",
        price: "560",
        url: "/trek/ghodepani-poon-hill-trek",
        img: "https://himalayasmountain.com/wp-content/uploads/2025/04/a-6.jpg",
      },
      {
        name: "Ama Yangri Trek",
        days: "3 Days",
        price: "320",
        url: "/trek/ama-yangri-trek",
        img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_182854_95ca8d2c-79aa-420b-bcf0-5d4ef20097bf.png",
      },
      {
        name: "Manaslu Circuit Trek",
        days: "15 Days",
        price: "1,290",
        url: "/trek/manaslu-circuit-trek",
        img: "https://himalayasmountain.com/wp-content/uploads/2025/04/manaslu-circuit-trek.jpeg",
      },
      {
        name: "Langtang Valley Trek",
        days: "8 Days",
        price: "850",
        url: "/trek/langtang-valley-trek",
        img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_181847_8b012740-f4e1-4e67-97cf-205c2d9a3c0a.png",
      },
      {
        name: "Mardi Himal Trek",
        days: "8 Days",
        price: "720",
        url: "/trek/mardi-himal-trek",
        img: "https://himalayasmountain.com/wp-content/uploads/2025/04/mardi-himal-trek-1-scaled.jpg",
      },
    ],
  },

  categories: {
    eyebrow: "For every kind of traveller",
    destinations: [
      {
        word: "Nepal",
        description:
          "Snow-capped treks, white-water rivers, sacred temples and quiet mountain villages — pick the adventure that calls you.",
        cats: [
          {
            name: "Trekking",
            meta: "14 Routes",
            img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_181903_13ec6e10-19ac-4f0b-9ef5-cb2f708fc50d.png",
            tall: true,
          },
          {
            name: "Adventure Tours",
            meta: "Rafting & more",
            img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_181855_ea5feeba-70ce-4953-ac8c-e0f1cea12cb7.png",
          },
          {
            name: "Cultural Tours",
            meta: "Kathmandu & beyond",
            img: "https://images.unsplash.com/photo-1726802016078-5cfbf05b249d?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            tall: true,
          },
          {
            name: "Religious Tours",
            meta: "Muktinath & Lumbini",
            img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_181859_afdc27cf-6454-4bb3-bc66-de6b8b465966.png",
          },
          {
            name: "City Tours",
            meta: "Pokhara & Kathmandu",
            img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_181851_4c9b0020-fa7b-47fe-81d8-7693feb54586.png",
          },
          {
            name: "Student Tours",
            meta: "10 Trips",
            img: "https://d8j0ntlcm91z4.cloudfront.net/user_3DPbgTBNQA8uVZpwmAJg2wq3SQI/hf_20260605_182854_95ca8d2c-79aa-420b-bcf0-5d4ef20097bf.png",
          },
        ],
      },
      {
        word: "Thailand",
        description:
          "Turquoise islands, golden temples, floating markets and neon-lit streets — pick the adventure that calls you.",
        cats: [
          {
            name: "Island Hopping",
            meta: "12 Islands",
            img: "https://images.pexels.com/photos/17422290/pexels-photo-17422290.jpeg?auto=compress&cs=tinysrgb&w=1260",
            tall: true,
          },
          {
            name: "Diving & Snorkeling",
            meta: "Coral reefs & more",
            img: "https://images.pexels.com/photos/31387467/pexels-photo-31387467.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "Riverside Culture",
            meta: "Chao Phraya & beyond",
            img: "https://images.pexels.com/photos/20889795/pexels-photo-20889795.jpeg?auto=compress&cs=tinysrgb&w=1260",
            tall: true,
          },
          {
            name: "Temple Tours",
            meta: "Wat Arun & more",
            img: "https://images.pexels.com/photos/11392617/pexels-photo-11392617.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "City Tours",
            meta: "Bangkok & Phuket",
            img: "https://images.pexels.com/photos/20020757/pexels-photo-20020757.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "Student Tours",
            meta: "8 Trips",
            img: "https://images.pexels.com/photos/17014071/pexels-photo-17014071.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
        ],
      },
      {
        word: "Bali",
        description:
          "Cliffside beaches, emerald rice terraces, sea temples and soulful villages — pick the adventure that calls you.",
        cats: [
          {
            name: "Beach Escapes",
            meta: "9 Beaches",
            img: "https://images.pexels.com/photos/6827322/pexels-photo-6827322.jpeg?auto=compress&cs=tinysrgb&w=1260",
            tall: true,
          },
          {
            name: "Surf & Adventure",
            meta: "Nusa Penida & more",
            img: "https://images.pexels.com/photos/15922567/pexels-photo-15922567.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "Rice Terrace Tours",
            meta: "Tegallalang & beyond",
            img: "https://images.pexels.com/photos/32855804/pexels-photo-32855804.jpeg?auto=compress&cs=tinysrgb&w=1260",
            tall: true,
          },
          {
            name: "Temple Tours",
            meta: "Tanah Lot & more",
            img: "https://images.pexels.com/photos/34136174/pexels-photo-34136174.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "Island Tours",
            meta: "Kelingking & beyond",
            img: "https://images.pexels.com/photos/18021426/pexels-photo-18021426.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "Student Tours",
            meta: "6 Trips",
            img: "https://images.pexels.com/photos/4453153/pexels-photo-4453153.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
        ],
      },
      {
        word: "Malaysia",
        description:
          "Ancient rainforest, cave temples, glass towers and street-food cities — pick the adventure that calls you.",
        cats: [
          {
            name: "Rainforest Trekking",
            meta: "10 Trails",
            img: "https://images.pexels.com/photos/31387467/pexels-photo-31387467.jpeg?auto=compress&cs=tinysrgb&w=1260",
            tall: true,
          },
          {
            name: "Adventure Tours",
            meta: "River rafting & more",
            img: "https://images.pexels.com/photos/11183384/pexels-photo-11183384.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "Cultural Tours",
            meta: "Batu Caves & beyond",
            img: "https://images.pexels.com/photos/19734394/pexels-photo-19734394.jpeg?auto=compress&cs=tinysrgb&w=1260",
            tall: true,
          },
          {
            name: "Architecture Tours",
            meta: "Petronas & beyond",
            img: "https://images.pexels.com/photos/11475620/pexels-photo-11475620.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "City Tours",
            meta: "KL & Penang",
            img: "https://images.pexels.com/photos/9577175/pexels-photo-9577175.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "Student Tours",
            meta: "7 Trips",
            img: "https://images.pexels.com/photos/4453153/pexels-photo-4453153.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
        ],
      },
      {
        word: "Dubai",
        description:
          "Golden dunes, record-breaking towers, old souks and coastline drives — pick the adventure that calls you.",
        cats: [
          {
            name: "Desert Safaris",
            meta: "6 Safaris",
            img: "https://images.pexels.com/photos/8003136/pexels-photo-8003136.jpeg?auto=compress&cs=tinysrgb&w=1260",
            tall: true,
          },
          {
            name: "Dune Adventures",
            meta: "Dune bashing & more",
            img: "https://images.pexels.com/photos/33687795/pexels-photo-33687795.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "Heritage Tours",
            meta: "Old Dubai & beyond",
            img: "https://images.pexels.com/photos/29493118/pexels-photo-29493118.jpeg?auto=compress&cs=tinysrgb&w=1260",
            tall: true,
          },
          {
            name: "Skyline Tours",
            meta: "Burj Khalifa & more",
            img: "https://images.pexels.com/photos/29497729/pexels-photo-29497729.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "City Tours",
            meta: "Dubai & Abu Dhabi",
            img: "https://images.pexels.com/photos/33687811/pexels-photo-33687811.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
          {
            name: "Student Tours",
            meta: "5 Trips",
            img: "https://images.pexels.com/photos/17014071/pexels-photo-17014071.jpeg?auto=compress&cs=tinysrgb&w=1260",
          },
        ],
      },
    ],
  },
};

export const toSiteContentDTO = (doc: HydratedDocument<SiteContentDoc>): SiteContentDTO => {
  const dto: SiteContentDTO = {
    id: doc._id.toString(),
    section: doc.section,
    data: doc.data ?? {},
    images: doc.images ?? [],
    isPublished: doc.isPublished,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.notes !== undefined) dto.notes = doc.notes;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;
  return dto;
};

/** Public shape — `notes` are admin-only and must never reach the public site. */
export const toPublicSiteContentDTO = (doc: HydratedDocument<SiteContentDoc>): SiteContentDTO => {
  const { notes: _notes, ...dto } = toSiteContentDTO(doc);
  return dto;
};
