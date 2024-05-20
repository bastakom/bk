import { getStoryblokApi } from '@storyblok/react'
import Staplar from './Staplar'

async function getTjanster() {
  let sbParams = { version: 'draft' as const, starts_with: 'tjanster/' }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
}

const TjansterComponent = async () => {
  const res = await getTjanster()
  const {
    data: { stories },
  } = res

  console.log(stories)
  return (
    <div className="h-screen flex items-center">
      {stories.map((item: any) => (
        <h2>{item.name}</h2>
      ))}
    </div>
  )
}

export default TjansterComponent
