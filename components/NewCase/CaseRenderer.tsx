import { storyblokEditable } from "@storyblok/react/rsc";
import CaseHeroMedia from "./blocks/CaseHeroMedia";
import CaseMediaRow from "./blocks/CaseMediaRow";
import CaseMixedMediaRow from "./blocks/CaseMixedMediaRow";
import CaseInfo from "./blocks/CaseInfo";
import CaseBlockQuote from "./blocks/CaseBlockQuote";

interface CaseRendererProps {
  story: any;
}

const caseBlocks: Record<string, React.ComponentType<{ blok: any }>> = {
  case_hero_media: CaseHeroMedia,
  case_media_row: CaseMediaRow,
  case_mixed_media_row: CaseMixedMediaRow,
  case_info: CaseInfo,
  case_block_quote: CaseBlockQuote,
};

const CaseRenderer = ({ story }: CaseRendererProps) => {
  const content = story?.content;

  const body = Array.isArray(content?.body)
    ? content.body
    : Array.isArray(content?.Body)
      ? content.Body
      : [];

  return (
    <div {...storyblokEditable(content)} className="pt-[82px]">
      {body.map((blok: any) => {
        const componentName = String(blok?.component || "").toLowerCase();
        const Component = caseBlocks[componentName];

        if (!Component) {
          console.warn(`Case-blocket "${blok?.component}" är inte registrerat.`);
          return null;
        }

        const blokWithCaseData =
          componentName === "case_info"
            ? {
                ...blok,
                _caseTags: Array.isArray(story?.tag_list)
                  ? story.tag_list
                  : [],
              }
            : blok;

        return <Component blok={blokWithCaseData} key={blok._uid} />;
      })}
    </div>
  );
};

export default CaseRenderer;
