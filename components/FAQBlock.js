import { storyblokEditable, StoryblokComponent } from '@storyblok/react/rsc'

const FAQBlock = ({ blok }) => {
  return (
    <section
      className="w-full py-20 px-6 lg:px-20"
      {...storyblokEditable(blok)}
    >
      <div className="max-w-[1100px] mx-auto">
        {blok?.title && (
          <h2 className="text-4xl lg:text-6xl font-bold mb-12">
            {blok.title}
          </h2>
        )}

        <div className="flex flex-col border-t border-black">
          {blok?.questions?.map((nestedBlok) => (
            <StoryblokComponent blok={nestedBlok} key={nestedBlok._uid} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default FAQBlock
