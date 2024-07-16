'use client'

import { motion, SVGMotionProps } from 'framer-motion'
import { FC, useState } from 'react'

const LoadingLogo: FC = () => {
  const [loaded, isSetLoading] = useState(false)
  const pathVariants: SVGMotionProps<SVGPathElement>['variants'] = {
    hidden: { pathLength: 0 },
    visible: {
      pathLength: 1,
      transition: {
        duration: 1,
      },
    },
  }

  setTimeout(() => {
    isSetLoading(true)
  }, 2700)

  return (
    !loaded && (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 2, duration: 0.5 }}
        className="flex flex-col gap-2 justify-center fixed h-screen w-full top-0 bg-[#F4E9E6] items-center z-50"
      >
        <div className="w-full justify-center bg-[#F4E9E6] flex z-10">
          <svg
            version="1.0"
            xmlns="http://www.w3.org/2000/svg"
            width="128.000000pt"
            height="84.000000pt"
            viewBox="0 0 128.000000 84.000000"
            preserveAspectRatio="xMidYMid meet"
          >
            <g
              transform="translate(0.000000,84.000000) scale(0.100000,-0.100000)"
              fill="none"
              stroke="#000000"
              strokeWidth="15"
            >
              <motion.path
                d="M0 421 c0 -366 2 -421 15 -421 13 0 15 54 17 402 l3 403 245 -1 c273 -2 288 -5 358 -69 57 -51 82 -107 82 -183 0 -35 -7 -78 -14 -97 -13 -31 -13 -39 1 -72 21 -52 19 -141 -5 -194 -11 -24 -37 -61 -58 -81 -60 -57 -102 -70 -239 -74 -101 -3 -121 -7 -123 -20 -4 -15 11 -16 130 -12 119 4 138 7 183 30 128 67 187 198 151 337 -13 50 -13 67 -4 84 7 12 12 54 12 92 1 119 -62 217 -173 269 -43 19 -66 21 -313 24 l-268 3 0 -420z"
                variants={pathVariants}
                initial="hidden"
                animate="visible"
              />
              <motion.path
                d="M891 636 c-61 -112 -111 -209 -111 -216 0 -20 213 -412 227 -417 8 -3 16 -3 19 0 3 3 -44 98 -105 211 l-110 206 109 201 c61 111 110 205 110 210 0 5 -6 9 -14 9 -9 0 -61 -86 -125 -204z"
                variants={pathVariants}
                initial="hidden"
                animate="visible"
              />
              <motion.path
                d="M971 634 c-61 -113 -111 -210 -111 -215 0 -22 220 -414 234 -417 9 -2 16 0 16 4 0 4 -47 96 -105 204 -58 109 -105 203 -105 210 0 7 47 100 105 206 58 107 105 198 105 204 0 5 -6 10 -14 10 -8 0 -63 -91 -125 -206z"
                variants={pathVariants}
                initial="hidden"
                animate="visible"
              />
              <motion.path
                d="M1050 629 c-110 -205 -113 -212 -98 -237 8 -15 59 -109 112 -209 57 -106 104 -183 112 -183 8 0 14 4 14 9 0 5 -47 97 -105 205 -58 107 -105 200 -105 206 0 6 42 88 94 183 137 253 130 237 108 237 -13 0 -48 -55 -132 -211z"
                variants={pathVariants}
                initial="hidden"
                animate="visible"
              />
              <motion.path
                d="M1132 630 l-113 -210 112 -210 c62 -116 118 -210 126 -210 7 0 13 5 13 11 0 6 -47 99 -105 207 -58 107 -105 198 -105 202 0 4 50 98 110 209 61 111 110 205 110 207 0 2 -8 4 -17 4 -13 0 -51 -61 -131 -210z"
                variants={pathVariants}
                initial="hidden"
                animate="visible"
              />
              <motion.path
                d="M77 764 c-4 -4 -7 -178 -7 -386 0 -356 1 -379 18 -376 16 3 17 30 20 366 l2 362 199 0 c212 0 238 -4 285 -48 59 -55 72 -142 35 -220 l-22 -44 22 -38 c37 -67 26 -157 -27 -213 -44 -47 -61 -52 -192 -57 -102 -4 -125 -8 -125 -20 0 -13 20 -15 120 -14 129 0 174 13 221 66 59 64 76 166 40 241 -18 37 -18 39 0 79 36 79 14 188 -48 244 -60 55 -78 59 -313 62 -121 2 -223 0 -228 -4z"
                variants={pathVariants}
                initial="hidden"
                animate="visible"
              />
              <motion.path
                d="M150 355 c0 -184 0 -338 -1 -342 0 -5 7 -9 15 -11 14 -3 16 34 16 327 l0 331 158 0 c136 0 161 -3 188 -19 60 -37 69 -124 18 -172 -23 -22 -36 -24 -142 -29 -95 -4 -117 -8 -117 -20 0 -12 22 -16 117 -20 110 -5 119 -7 144 -31 35 -36 42 -94 15 -137 -28 -44 -55 -52 -177 -52 -86 0 -104 -3 -104 -15 0 -12 20 -15 118 -15 129 0 155 9 193 66 36 55 19 152 -33 188 l-22 16 22 16 c74 51 67 185 -13 234 -29 18 -49 20 -214 20 l-181 0 0 -335z"
                variants={pathVariants}
                initial="hidden"
                animate="visible"
              />
              <motion.path
                d="M220 310 c0 -269 2 -310 15 -310 13 0 15 39 15 295 l0 295 114 0 c91 0 118 -3 130 -16 19 -18 19 -20 6 -45 -10 -17 -22 -19 -115 -19 -87 0 -105 -3 -105 -15 0 -12 19 -15 110 -15 99 0 111 2 130 22 27 29 25 64 -5 93 -23 24 -29 25 -160 25 l-135 0 0 -310z"
                variants={pathVariants}
                initial="hidden"
                animate="visible"
              />
              <motion.path
                d="M280 345 c0 -12 18 -15 103 -15 102 0 127 -7 127 -36 0 -34 -30 -44 -131 -44 -81 0 -99 -3 -99 -15 0 -12 19 -15 108 -15 100 0 110 2 130 23 27 29 28 71 2 97 -18 18 -33 20 -130 20 -91 0 -110 -3 -110 -15z"
                variants={pathVariants}
                initial="hidden"
                animate="visible"
              />
            </g>
          </svg>
        </div>
        <div>
          <motion.h2
            initial={{ transform: 'translateY(-80px)' }}
            animate={{ transform: 'translateY(0px)' }}
            transition={{ delay: 0.5, duration: 1 }}
            className="text-[20px] font-light uppercase z-0"
          >
            Bästa Kompisar
          </motion.h2>
        </div>
      </motion.div>
    )
  )
}

export default LoadingLogo
