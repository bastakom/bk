import { getStoryblokApi } from '@storyblok/react'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'

const getTeam = async () => {
  let sbParams = {
    version: 'published' as const,
    starts_with: 'team',
  }

  const storyblokApi = getStoryblokApi()
  const data = await storyblokApi.get(`cdn/stories/`, sbParams)

  return data.data.stories
}

const Team = async () => {
  const res = await getTeam()
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
      id="dinakompisar"
    >
      {res.map((member: any) => (
        <div key={member.id} className="relative group">
          <div className="relative max-h-[520px] xl:max-h-[800px]">
            {member?.content?.content === '' ? null : (
              <div
                className="absolute top-0 h-full text-white w-full p-5 flex items-center bg-[#25364F] opacity-0 group-hover:opacity-90
            transition-all duration-300 ease-in-out text-[16px]"
              >
                {render(member?.content?.content)}
              </div>
            )}
            <Image
              className="object-cover min-h-[520px] xl:max-h-[800px]"
              style={{ objectPosition: '50% 50%' }}
              src={member.content.image.filename}
              width={800}
              height={520}
              alt={member.name}
            />
          </div>
          <h2 className="text-[24px] font-bold-sofia mt-2 text-black">{member.name}</h2>
          <span className="font-light-sofia text-[14px]">
            <span className="uppercase"> {member.content.yrkesroll}</span>{' '}
            <br />
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
