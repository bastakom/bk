"use client";

import { render } from "storyblok-rich-text-react-renderer";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IoMdArrowForward } from "react-icons/io";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useState } from "react";

interface Props {
  story: any;
  nextCaseSlug: string;
}

// Helper function to extract YouTube video ID from URL
const getYouTubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

// Helper function to check if URL is a YouTube URL
const isYouTubeUrl = (url: string): boolean => {
  return url.includes("youtube.com") || url.includes("youtu.be");
};

const FilmSlugPage = ({ story, nextCaseSlug }: Props) => {
  const [loading, isLoaded] = useState(false);
  const router = useRouter();
  const locale = useParams();

  const handleNextClick = () => {
    router.push(`${nextCaseSlug}`);
  };

  setTimeout(() => {
    isLoaded(true);
  }, 1000);

  // Check if main image is YouTube
  const mainImage = story?.content?.image;
  const isMainImageYouTube = mainImage?.is_external_url && isYouTubeUrl(mainImage?.filename);
  const mainImageYouTubeId = isMainImageYouTube ? getYouTubeVideoId(mainImage?.filename) : null;

  return (
    <>
      <div className="relative dark:bg-[#121212] pb-5 container m-auto">
        <div className="flex gap-5 mb-5 lg:mb-20 mt-16 flex-col items-center">
          {!loading ? (
            <div className="w-full h-[350px] lg:h-[600px]">
              <Skeleton className="h-full" />
            </div>
          ) : (
            <div className="w-full relative h-[300px] lg:h-[602px] overflow-hidden">
              {isMainImageYouTube && mainImageYouTubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${mainImageYouTubeId}?autoplay=1&mute=1&loop=1&playlist=${mainImageYouTubeId}&showinfo=0&rel=0&modestbranding=1&vq=hd1080`}
                  className="absolute top-1/2 left-1/2 border-0"
                  style={{
                    width: "100vw",
                    height: "56.25vw", // 16:9 aspect ratio
                    minHeight: "100%",
                    minWidth: "177.77vh", // 16:9 aspect ratio
                    transform: "translate(-50%, -50%)",
                  }}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : story?.content?.image?.filename.endsWith(".mp4") ? (
                <video autoPlay muted playsInline loop className="object-cover h-full w-full">
                  <source src={story.content.image?.filename || ""} />
                </video>
              ) : (
                <Image
                  src={story?.content?.image?.filename || ""}
                  fill
                  alt="placeholder"
                  quality={100}
                  className="object-cover bg-[-200px]"
                />
              )}
            </div>
          )}
          <div className="flex justify-start w-full gap-2 my-5 ml-0 lg:ml-[3.75rem]">
            <span className="font-light">{locale.lang === "en" ? "Client: " : "Kund: "}</span>
            <h1 className="font-bold">{story?.name}</h1>
          </div>
          <div className="flex container flex-col lg:flex-row mb-10 ml-0 lg:ml-[60px]">
            <div className="w-full lg:w-1/2 flex-col flex gap-5 container">
              <div className="flex gap-2 flex-col">
                <span className="text-[65px] lg:max-w-[80%] break-normal lg:text-[100px] leading-[70px] lg:leading-[100px]">
                  {render(story?.content?.title)}
                </span>
              </div>
              <span>{story?.content?.ingress}</span>
            </div>
            <div className="w-full lg:w-[47.6%] mt-5 lg:mt-0 flex flex-col gap-10 font-light-sofia text-[18px] lg:text-[25px] in_link">
              {render(story?.content?.content)}
            </div>
          </div>
        </div>
        <div className="w-full gap-5 container m-auto">
          {story.content &&
            Array.isArray(story.content.videos) &&
            story.content.videos.length > 0 &&
            story.content.videos.slice(0, 1).map((item: any) => {
              const isVideoYouTube = item?.is_external_url && isYouTubeUrl(item?.filename);
              const videoYouTubeId = isVideoYouTube ? getYouTubeVideoId(item?.filename) : null;

              return (
                <div
                  className={`object-cover relative ${story.content.sound ? "w-full lg:w-2/3 m-auto" : "w-full"} `}
                  key={item.filename}
                >
                  {isVideoYouTube && videoYouTubeId ? (
                    <div className="relative w-full pb-[56.25%]">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoYouTubeId}?vq=hd1080`}
                        className="absolute top-0 left-0 w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <video controls playsInline className="w-full">
                      <source src={item?.filename} />
                    </video>
                  )}
                </div>
              );
            })}
        </div>
        {story.content && Array.isArray(story.content.gallery) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-5 container m-auto">
            {story.content &&
              Array.isArray(story.content.gallery) &&
              story.content.gallery.length > 0 &&
              story.content.gallery.slice(0, 4).map((item: any) => {
                const isGalleryItemYouTube = item?.is_external_url && isYouTubeUrl(item?.filename);
                const galleryItemYouTubeId = isGalleryItemYouTube ? getYouTubeVideoId(item?.filename) : null;

                return (
                  <div className="h-[377px] relative w-full overflow-hidden" key={item.filename}>
                    {isGalleryItemYouTube && galleryItemYouTubeId ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${galleryItemYouTubeId}?autoplay=1&mute=1&loop=1&playlist=${galleryItemYouTubeId}&controls=1&vq=hd1080`}
                        className="absolute top-1/2 left-1/2 border-0"
                        style={{
                          width: "100vw",
                          height: "56.25vw",
                          minHeight: "100%",
                          minWidth: "177.77vh",
                          transform: "translate(-50%, -50%)",
                        }}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    ) : item.filename.endsWith(".mp4") || item.filename.endsWith(".mov") ? (
                      <video autoPlay muted controls playsInline loop className="object-cover h-full w-full">
                        <source src={item?.filename || ""} />
                      </video>
                    ) : (
                      <Image src={item?.filename || ""} fill alt="" className="object-cover" />
                    )}
                  </div>
                );
              })}
          </div>
        )}
        {!story.content.hide_content_under_gallery && (
          <div className="flex flex-col gap-5 text-[20px] container m-auto my-10 font-light-sofia">
            {story?.content?.title_columns && (
              <span className="text-[22px] font-normal">{story.content.title_columns}</span>
            )}
            {story.content.hide_content_under_gallery && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 font-light text-[18px] lg:text-[20px]">
                <span>{render(story?.content?.text_under_gallery)}</span>
                <span>{story.content?.two_column_text_2 && render(story?.content?.two_column_text_2)}</span>
              </div>
            )}
            {story.content.extrattitlecontent && (
              <div
                className="max-w-full lg:max-w-[40%] mt-20 flex flex-col gap-14 pb-10 mb-14"
                style={{ borderBottom: "1px solid #25364F" }}
              >
                <h3 className="text-[32px] lg:text-[50px] font-primary">{story.content.extrattitlecontent}</h3>
                <span className="text-[14px] font-normal font-primary">{story.content.extratitlecontentingress}</span>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-5 container m-auto">
          {story.content &&
            Array.isArray(story.content.gallery) &&
            story.content.gallery.length > 4 &&
            story.content.gallery.slice(4, 8).map((item: any) => {
              const isGalleryItemYouTube = item?.is_external_url && isYouTubeUrl(item?.filename);
              const galleryItemYouTubeId = isGalleryItemYouTube ? getYouTubeVideoId(item?.filename) : null;

              return (
                <div className="h-[377px] relative w-full overflow-hidden" key={item.filename}>
                  {isGalleryItemYouTube && galleryItemYouTubeId ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${galleryItemYouTubeId}?autoplay=1&mute=1&loop=1&playlist=${galleryItemYouTubeId}&controls=1&vq=hd1080`}
                      className="absolute top-1/2 left-1/2 border-0"
                      style={{
                        width: "100vw",
                        height: "56.25vw",
                        minHeight: "100%",
                        minWidth: "177.77vh",
                        transform: "translate(-50%, -50%)",
                      }}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  ) : item.filename.endsWith(".mp4") || item.filename.endsWith(".mov") ? (
                    <video autoPlay muted loop playsInline className="object-cover h-full w-full">
                      <source src={item?.filename || ""} />
                    </video>
                  ) : (
                    <Image src={item?.filename || ""} fill alt="" className="object-cover" />
                  )}
                </div>
              );
            })}
        </div>

        <div className="flex flex-col gap-2 text-[18px] lg:text-[20px] max-w-full lg:max-w-[40%] container font-light-sofia">
          {render(story.content.text_under_video)}
        </div>
        <div className="w-ful gap-5 container m-auto">
          {Array.isArray(story.content.gallery) &&
            story.content.videos.length === 2 &&
            story.content.videos.slice(1, 2).map((item: any, index: number) => {
              const isVideoYouTube = item?.is_external_url && isYouTubeUrl(item?.filename);
              const videoYouTubeId = isVideoYouTube ? getYouTubeVideoId(item?.filename) : null;

              return (
                <div className="object-cover relative w-full" key={index}>
                  {isVideoYouTube && videoYouTubeId ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${videoYouTubeId}?vq=hd1080`}
                      className="w-full aspect-video border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video controls playsInline className="w-full">
                      <source src={item.filename} />
                    </video>
                  )}
                </div>
              );
            })}
        </div>
      </div>
      {story?.content?.footer_image?.filename && (
        <div className="w-full relative h-[602px] mb-5 container m-auto">
          <Image
            src={story?.content?.footer_image?.filename || ""}
            fill
            alt="placeholder"
            quality={100}
            className="object-cover bg-[-200px]"
          />
        </div>
      )}
    </>
  );
};

export default FilmSlugPage;
