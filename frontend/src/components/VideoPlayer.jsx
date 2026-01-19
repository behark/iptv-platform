import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

const VideoPlayer = ({ streamUrl, streamType = 'HLS', title }) => {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

    if (streamType === 'HLS') {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true
        })
        hls.loadSource(streamUrl)
        hls.attachMedia(video)
        hlsRef.current = hls

        return () => {
          if (hlsRef.current) {
            hlsRef.current.destroy()
          }
        }
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = streamUrl
      }
    } else {
      // Direct video URL
      video.src = streamUrl
    }
  }, [streamUrl, streamType])

  return (
    <div className="w-full bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        controls
        autoPlay
        className="w-full h-auto"
        playsInline
      >
        Your browser does not support the video tag.
      </video>
      {title && (
        <div className="p-4 bg-slate-800">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
      )}
    </div>
  )
}

export default VideoPlayer
