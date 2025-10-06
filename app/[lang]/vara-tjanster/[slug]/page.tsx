import { getStoryblokApi } from "@storyblok/react";
import Image from "next/image";
import { render } from "storyblok-rich-text-react-renderer";
import Button from "../../components/Button/Button";
import CasesReelComponent from "../../components/Cases/CaseReelComponent";
import FilmCases from "../../components/Cases/filmcases";
import ExpandableContent from "../../components/ExpandableContent/ExpandableContent";

const fetchCases = async (locale: string) => {
  let sbParams = {
    version: "draft" as const,
    starts_with: "cases/",
    language: locale,
  };

  const storyblokApi = getStoryblokApi();
  try {
    const response = await storyblokApi.get(
      `cdn/stories/`,
      sbParams,
      {
        cache: "no-store",
      }
    );
    return response;
  } catch (error) {
    console.error("Error fetching cases:");
    return { data: { stories: [] } };
  }
};

const getFilm = async () => {
  let sbParams = {
    version: "draft" as const,
    starts_with: "filmproduction/",
  };

  const storyblokApi = getStoryblokApi();

  const res = await storyblokApi.get(
    `cdn/stories/`,
    sbParams,
    {
      cache: "no-store",
    }
  );
  return res.data.stories;
};

const fetchConfig = async (locale: string) => {
  let sbParams = {
    version: "draft" as const,
    language: locale,
  };

  const storyblokApi = getStoryblokApi();
  const config = await storyblokApi.get(
    `cdn/stories/config`,
    sbParams,
    {
      cache: "no-store",
    }
  );
  return config.data.story.content;
};

const getSlugData = async (slug: string) => {
  let sbParams = { version: "draft" as const };

  const storyblokApi = getStoryblokApi();
  return await storyblokApi.get(
    `cdn/stories/vara-tjanster/${slug}`,
    sbParams
  );
};

const page = async ({
  params,
}: {
  params: { slug: string; lang: string };
}) => {
  const pathname = params.slug;

  const res = await getSlugData(pathname);
  const cases = await fetchCases(params.lang);
  const filmprod = await getFilm();
  const config = await fetchConfig(params.lang);

  const {
    data: { story },
  } = res;

  const filteredStories = cases.data.stories.filter(
    (item: any) => {
      const categories = item.content.Kategori;
      const storyNameLower = story.name.toLowerCase();

      if (Array.isArray(categories)) {
        return categories.some(
          (category: string) =>
            category.toLowerCase() === storyNameLower
        );
      }

      return (
        categories.toString().toLowerCase() ===
        storyNameLower
      );
    }
  );

  return story.content.filmproductionsida ? (
    <div className="">
      <div className="w-full relative h-[90vh]">
        <video
          autoPlay
          muted
          playsInline
          loop
          className="object-cover h-full w-full"
        >
          <source
            src={story.content.video?.filename || ""}
          />
        </video>
      </div>
      <div>
        <div className="py-14 text-center flex flex-col gap-5 lg:gap-10 justify-center">
          {story.content.title && (
            <div className="text-[30px] lg:text-[65px] mx-auto lg:text-[100px] max-w-[80%] xl:max-w-[70%] leading-[70px] text-[#25364f] lg:leading-[120px]">
              {render(story.content.title)}
            </div>
          )}
          {story.content.sub_title && (
            <h2 className="lg:text-[28px] lg:text-[30px] leading-[35px]">
              {story.content.sub_title}
            </h2>
          )}
          {story.content.content && (
            <ExpandableContent
              content={story.content.content}
            />
          )}
        </div>
      </div>

      <FilmCases
        props={filmprod}
        config={config}
        locale={params.lang}
      />
    </div>
  ) : (
    <div
      className={`full-width-element pt-32 no-padding-bottom pb-20 px-1`}
      style={{
        background: `${
          story.content.background
            ? story.content.background
            : "none"
        }`,
      }}
    >
      <div className="container m-auto px-2 lg:px-0">
        <div className="text-left lg:text-center flex flex-col gap-5 lg:gap-10 justify-center">
          <h1 className="text-[20px] uppercase text-black">
            {story.name}
          </h1>
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
          <div className="w-full relative h-[400px] lg:h-[500px]">
            {story.content.show_video ? (
              <video
                controls
                autoPlay
                loop
                muted
                className="w-full h-full object-contain"
              >
                <source
                  src={story?.content?.video?.filename}
                />
              </video>
            ) : (
              <Image
                src={story.content.image.filename}
                fill
                alt=""
                className="object-cover"
              />
            )}
          </div>
        </div>
      </div>
      {story.content.text_block_title && (
        <div className="flex container flex-col lg:flex-row my-20 m-auto max-auto justify-center p-2 lg:p-0">
          <div className="w-full lg:w-1/2 flex-col flex gap-5 container">
            <div className="flex gap-2 flex-col lg:-ml-5">
              <h2 className="text-[65px] lg:max-w-[80%] break-normal lg:text-[80px] leading-[70px] lg:leading-[100px]">
                {story.content.text_block_title}
              </h2>
            </div>
          </div>
          <div className="w-full lg:w-[47.6%] mt-5 lg:mt-0 flex flex-col gap-10 font-light-sofia text-[18px] lg:text-[25px] in_link">
            {render(story?.content?.text_block_content)}
          </div>
        </div>
      )}
      <div className="grid lg:grid-cols-2 mx-auto justify-start container gap-10 p-2 lg:p-0">
        {story.content.text_block_repeater &&
          story.content.text_block_repeater.map(
            (item: any) => {
              return (
                <div className="m-auto">
                  <span className="text-[35px]">
                    {render(item.title)}
                  </span>
                  <span>{render(item.content)}</span>
                </div>
              );
            }
          )}
      </div>

      <div className="pl-2 px-1 lg:px-0 lg:pl-14 py-14">
        <h2 className="py-10 text-center uppercase text-[20px]">
          {params.lang === "en"
            ? "Selection case"
            : "Urval case"}
        </h2>
        {filteredStories &&
          Array.isArray(filteredStories) && (
            <CasesReelComponent props={filteredStories} />
          )}
      </div>
    </div>
  );
};

export default page;
