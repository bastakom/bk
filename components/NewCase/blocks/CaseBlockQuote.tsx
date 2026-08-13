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
          <p className="max-w-[42ch] whitespace-pre-line text-[2rem] font-normal leading-[1.15] text-[#25364F] lg:text-[3.125rem]">
            {blok.primary_text}
          </p>
        )}

        {blok.secondary_text && (
          <p className="max-w-[40ch] whitespace-pre-line text-base font-normal leading-[1.3] text-[#25364F] lg:text-xl">
            {blok.secondary_text}
          </p>
        )}
      </blockquote>
    </section>
  );
};

export default CaseBlockQuote;
