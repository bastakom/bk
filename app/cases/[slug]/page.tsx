// import { getStoryblokApi } from '@storyblok/react'
// import { render } from 'storyblok-rich-text-react-renderer'
// import placeholder from '@/public/placeholder.png'
// import Image from 'next/image'

// const getSlugData = async (slug: string) => {
//   let sbParams = { version: 'draft' as const }

//   const storyblokApi = getStoryblokApi()
//   return await storyblokApi.get(`cdn/stories/cases/${slug}`, sbParams)
// }

// const page = async ({ params }: { params: { slug: string } }) => {
//   const pathname = params.slug

//   const {
//     data: { story },
//   } = await getSlugData(pathname)
//   return (
//     <>
//       <div className="relative">
//         <div className="mt-20 flex flex-col gap-2">
//           <h2 className="text-8xl font-bold">{story.content.title}</h2>
//           <div className="max-w-[80%]">{render(story.content.content)}</div>
//           <Image
//             src={placeholder}
//             className="ml-44 mt-10"
//             height={500}
//             width={800}
//             alt="placeholder"
//           />
//         </div>
//       </div>
//     </>
//   )
// }

// export default page

const page = () => {
  return <div>page</div>
}

export default page
