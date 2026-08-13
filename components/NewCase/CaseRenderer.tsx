import { storyblokEditable } from "@storyblok/react/rsc";
import CaseHeroMedia from "./blocks/CaseHeroMedia";
import CaseMediaRow from "./blocks/CaseMediaRow";
import CaseInfo from "./blocks/CaseInfo";

interface CaseRendererProps {
  story: any;
}

const caseBlocks: Record<string, React.ComponentType<{ blok: any }>> = {
  case_hero_media: CaseHeroMedia,
  case_media_row: CaseMediaRow,
  case_info: CaseInfo,
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

        return <Component blok={blok} key={blok._uid} />;
      })}
    </div>
  );
};

export default CaseRenderer;
