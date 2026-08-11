import { storyblokEditable } from "@storyblok/react/rsc";
import SmallHero from "../SmallHero";

interface CaseRendererProps {
  story: any;
}

const caseBlocks: Record<string, React.ComponentType<{ blok: any }>> = {
  smallhero: SmallHero,

  // Extra stöd om blockets tekniska namn använder stor bokstav.
  Smallhero: SmallHero,
};

const CaseRenderer = ({ story }: CaseRendererProps) => {
  const content = story?.content;
  const body = Array.isArray(content?.body) ? content.body : [];

  return (
    <div {...storyblokEditable(content)}>
      {body.map((blok: any) => {
        const Component = caseBlocks[blok.component];

        if (!Component) {
          console.warn(
            `Case-blocket "${blok.component}" är inte registrerat i CaseRenderer.`
          );

          return null;
        }

        return <Component blok={blok} key={blok._uid} />;
      })}
    </div>
  );
};

export default CaseRenderer;
