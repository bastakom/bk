import { getStoryblokApi } from '@storyblok/react'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'
import Button from '../../components/Button/Button'
import CasesReelComponent from '../../components/Cases/CaseReelComponent'

const fetchCases = async (locale: string) => {
  let sbParams = {
    version: 'draft' as const,
    starts_with: 'cases/',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  try {
    const response = await storyblokApi.get(`cdn/stories/`, sbParams, {
      cache: 'no-store',
    })
    return response
  } catch (error) {
    console.error('Error fetching cases:')
    return { data: { stories: [] } } // Return an empty array as a fallback
  }
}

const getSlugData = async (slug: string) => {
  let sbParams = { version: 'draft' as const }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/vara-tjanster/${slug}`, sbParams)
}

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const pathname = params.slug

  const res = await getSlugData(pathname)
  const cases = await fetchCases(params.lang)

  const {
    data: { story },
  } = res

  const filteredStories = cases.data.stories.filter((item: any) => {
    const categories = item.content.Kategori
    if (Array.isArray(categories)) {
      return categories.includes(story.name)
    }
    return categories.toString() === story.name
  })

  return (
    <div
      className={`full-width-element pt-32 no-padding-bottom pb-20 px-1`}
      style={{
        background: `${
          story.content.background ? story.content.background : 'none'
        }`,
      }}
    >
      <div className="container m-auto px-2 lg:px-0">
        <div className="text-left lg:text-center flex flex-col gap-5 lg:gap-10 justify-center">
          <h1 className="text-[20px] uppercase text-black">{story.name}</h1>
          {story.content.title && (
            <div className="text-[65px] lg:text-[100px] leading-[70px] text-[#25364f] lg:leading-[120px]">
              {render(story.content.title)}
            </div>
          )}
          {story.content.sub_title && (
            <h2 className="text-[28px] lg:text-[30px] leading-[35px]">
              {story.content.sub_title}
            </h2>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 mt-5 lg:mt-24">
          <div className="lg:max-w-[80%] flex flex-col gap-5 my-8 lg:mb-0 lg:gap-14 ">
            {story.content.single_content && (
              <span className="text-[20px] font-normal leading-[32px] text-left">
                {render(story.content.single_content)}
              </span>
            )}
            {story.content.link_text && (
              <Button
                text={story.content.link_text}
                href={`/${story?.content.link?.cached_url}`}
              />
            )}
          </div>
          <div className="w-full relative h-[400px] lg:h-[600px]">
            <Image
              src={story.content.image.filename}
              fill
              alt=""
              className="object-cover"
            />
          </div>
        </div>
      </div>
      <div className="pl-2 px-1 lg:px-0 lg:pl-14 py-14">
        <h2 className="py-10 text-center uppercase text-[20px]">
          {params.lang === 'en' ? 'Selection case' : 'Urval case'}
        </h2>
        {filteredStories && Array.isArray(filteredStories) && (
          <CasesReelComponent props={filteredStories} />
        )}
      </div>
    </div>
  )
}

export default page
