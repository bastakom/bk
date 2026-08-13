import { storyblokEditable } from "@storyblok/react/rsc";

interface CaseBlockQuoteBlok {
  [key: string]: any;
  _uid: string;
  component: string;
  primary_text?: string;
  secondary_text?: string;
}

interface CaseBlockQuoteProps {
  blok: CaseBlockQuoteBlok;
}

const CaseBlockQuote = ({ blok }: CaseBlockQuoteProps) => {
  if (!blok.primary_text && !blok.secondary_text) return null;

  return (
    <section
      {...storyblokEditable(blok)}
      className="full-width-element px-5 py-10 lg:py-20"
    >
      <blockquote className="mx-auto flex w-full flex-col items-center gap-5 text-center lg:gap-10">
        {blok.primary_text && (
          <p className="max-w-[20ch] whitespace-pre-line text-[clamp(2.5rem,5vw,4.6875rem)] font-bold-sofia leading-[1.08] text-[#25364F]">
            {blok.primary_text}
          </p>
        )}

        {blok.secondary_text && (
          <p className="max-w-[30ch] whitespace-pre-line text-[clamp(1.375rem,2.65vw,2.5rem)] font-normal leading-[1.2] text-[#25364F]">
            {blok.secondary_text}
          </p>
        )}
      </blockquote>
    </section>
  );
};

export default CaseBlockQuote;
