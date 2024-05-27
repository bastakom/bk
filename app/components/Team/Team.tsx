import { getStoryblokApi } from '@storyblok/react'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'

const getTeam = async () => {
  let sbParams = {
    version: 'draft' as const,
    starts_with: 'team',
  }

  const storyblokApi = getStoryblokApi()
  const data = await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })

  return data.data.stories
}

const Team = async () => {
  const res = await getTeam()
  console.log(res)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {res.map((member: any) => (
        <div key={member.id} className="relative group hover:cursor-pointer">
          <div className="relative">
            {member?.content?.content === '' ? null : (
              <div
                className="absolute top-0 h-full text-black w-full p-5 flex items-center bg-white opacity-0 group-hover:opacity-90
            group-hover:translate-x-0 transform translate-x-full transition-all duration-300 ease-in-out text-[16px] hover:cursor-pointer"
              >
                {render(member?.content?.content)}
              </div>
            )}
            <Image
              className="h-[593px] lg:max-h-[420px] object-cover"
              src={member.content.image.filename}
              width={500}
              height={500}
              alt={member.name}
            />
          </div>
          <h2 className="text-[24px] font-bold-sofia mt-2">{member.name}</h2>
          <span className="font-light-sofia text-[14px]">
            {member.content.yrkesroll} <br />
            {member.content.email}
            {member.content.telefon && (
              <span>
                <br />
                {member.content.telefon}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

export default Team
