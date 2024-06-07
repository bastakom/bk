'use client'
import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

interface IframeProps {
  src: string
}

const IframeComponent: React.FC<IframeProps> = ({ src }) => {
  return (
    <div>
      <iframe
        id="myframe"
        src={src}
        allowFullScreen
        style={{ colorScheme: 'normal' }}
      />
    </div>
  )
}

export default IframeComponent
