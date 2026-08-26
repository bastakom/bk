import { notFound } from "next/navigation";
import { getStoryblokApi } from "@storyblok/react/rsc";
import CaseOverview from "@/components/NewCase/CaseOverview";

interface PageProps {
  params: {
    lang: string;
  };
}

interface StoryblokLink {
  id?: string;
  url?: string;
  cached_url?: string;
}

interface OverviewItem {
  [key: string]: any;
  _uid: string;
  component: string;
  case_link?: StoryblokLink;
  title?: string;
}

interface LinkedCaseStory {
  uuid: string;
  name: string;
  full_slug: string;
  tag_list?: string[];
  content?: {
    Kategori?: string | string[];
    categoriesen?: string | string[];
    [key: string]: any;
  };
}

const getStoryblokVersion = () =>
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === "true"
    ? "draft"
    : "published";

const normalizeTags = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(/[\n,]/))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const getCaseTags = (story: LinkedCaseStory | undefined, lang: string) => {
  const storyTags = normalizeTags(story?.tag_list);

  if (storyTags.length > 0) return storyTags;

  const legacyTags =
    lang === "en"
      ? story?.content?.categoriesen
      : story?.content?.Kategori;

  return normalizeTags(legacyTags);
};

const resolveHref = (
  link: StoryblokLink | undefined,
  story: LinkedCaseStory | undefined,
  lang: string,
) => {
  const rawHref = link?.cached_url || link?.url || story?.full_slug || "";

  if (!rawHref) return "";

  if (/^(https?:\/\/|mailto:|tel:|#)/i.test(rawHref)) return rawHref;

  const cleanHref = rawHref.replace(/^\/+/, "");

  if (cleanHref === lang || cleanHref.startsWith(`${lang}/`)) {
    return `/${cleanHref}`;
  }

  return `/${lang}/${cleanHref}`;
};

const fetchOverview = async (lang: string) => {
  const storyblokApi = getStoryblokApi();

  try {
    const { data } = await storyblokApi.get(
      "cdn/stories/case-overview",
      {
        version: getStoryblokVersion(),
        language: lang,
      },
      { cache: "no-store" },
    );

    return data.story;
  } catch {
    return null;
  }
};

const fetchLinkedCases = async (items: OverviewItem[], lang: string) => {
  const storyblokApi = getStoryblokApi();
  const uuids = Array.from(
    new Set(
      items
        .map((item) => item.case_link?.id)
        .filter((uuid): uuid is string => Boolean(uuid)),
    ),
  );

  if (uuids.length === 0) return [];

  try {
    const { data } = await storyblokApi.get(
      "cdn/stories",
      {
        version: getStoryblokVersion(),
        language: lang,
        by_uuids: uuids.join(","),
        per_page: 100,
      },
      { cache: "no-store" },
    );

    return (data.stories || []) as LinkedCaseStory[];
  } catch {
    return [];
  }
};

const CasesPage = async ({ params }: PageProps) => {
  const story = await fetchOverview(params.lang);

  if (!story) notFound();

  const items = Array.isArray(story.content?.items)
    ? (story.content.items as OverviewItem[])
    : [];
  const linkedCases = await fetchLinkedCases(items, params.lang);
  const casesByUuid = new Map(
    linkedCases.map((linkedCase) => [linkedCase.uuid, linkedCase]),
  );

  const enrichedItems = items.map((item) => {
    const linkedCase = item.case_link?.id
      ? casesByUuid.get(item.case_link.id)
      : undefined;

    return {
      ...item,
      _resolvedHref: resolveHref(item.case_link, linkedCase, params.lang),
      _resolvedTitle: item.title || linkedCase?.name || "",
      _resolvedTags: getCaseTags(linkedCase, params.lang),
    };
  });

  return (
    <CaseOverview
      blok={story.content}
      items={enrichedItems}
      lang={params.lang}
    />
  );
};

export default CasesPage;
